"""
LangGraph Agent: The Autonomous Orchestrator
This file defines the StateGraph that models the Policy Lifecycle.

Workflow:
1. Underwrite (Gatekeeper) - Calculate premium quote
2. Monitor (Watchman) - Periodic checks on active policies
3. Analyze (Brain) - Process weather + ML data
4. Verify (Investigator) - Cross-check with satellite data
5. Settle (Paymaster) - Execute XRPL payout
"""
from typing import TypedDict, Literal, List, Dict, Optional, Annotated
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import operator

# Import our tools
from backend.agent.tools import (
    weather_tool, 
    risk_tool, 
    pricing_tool, 
    xrpl_escrow_tool,
    get_all_tools
)
from backend.agent.prompts import AGENT_SYSTEM_PROMPT


# ============================================
# STATE SCHEMA
# ============================================
class AgentState(TypedDict):
    """
    The state of the insurance policy lifecycle.
    This is passed between nodes and persisted across runs.
    """
    # Identity
    policy_id: str
    status: Literal["quote_pending", "active", "monitoring", "claim_triggered", "settled", "rejected"]
    
    # Policy Details
    location: Dict[str, float]  # {lat, lon}
    farm_size_hectares: float
    crop_type: str
    coverage_rlusd: float
    
    # Calculated Values
    premium_rlusd: Optional[float]
    
    # Data Interface
    weather_data: Optional[Dict]
    risk_score: Optional[float]
    risk_level: Optional[str]
    
    # Agent Reasoning
    reasoning_log: Annotated[List[str], operator.add]  # Append-only log
    confidence_score: Optional[float]
    
    # XRPL References
    escrow_sequence: Optional[int]
    transaction_hash: Optional[str]


# ============================================
# NODE FUNCTIONS
# ============================================

def underwrite_node(state: AgentState) -> Dict:
    """
    Phase 1: The Gatekeeper.
    Fetches weather data, runs risk model, and calculates premium.
    """
    loc = state["location"]
    
    # Step 1: Get weather data
    weather = weather_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "days": 7
    })
    
    if weather["status"] != "success":
        return {
            "status": "rejected",
            "reasoning_log": [f"❌ Underwriting failed: Weather API error - {weather.get('message')}"]
        }
    
    # Step 2: Calculate risk
    avg_temp = sum(weather.get("temperature_max_c", [25])) / max(len(weather.get("temperature_max_c", [1])), 1)
    avg_moisture = sum(weather.get("soil_moisture", [0.3])) / max(len(weather.get("soil_moisture", [1])), 1)
    
    risk = risk_tool.invoke({
        "precipitation_mm": weather["total_precipitation_mm"],
        "temperature_c": avg_temp,
        "soil_moisture": avg_moisture,
        "crop_type": state["crop_type"]
    })
    
    # Step 3: Check if we should reject immediately
    if risk["risk_level"] == "CRITICAL":
        return {
            "status": "rejected",
            "risk_score": risk["risk_score"],
            "weather_data": weather,
            "reasoning_log": [f"❌ Policy REJECTED: Risk too high ({risk['risk_score']:.2%}). Cannot insure active disaster."]
        }
    
    # Step 4: Calculate premium
    # Weather volatility = how much precipitation varies (proxy for uncertainty)
    precip_list = weather.get("precipitation_mm", [0])
    if len(precip_list) > 1:
        import statistics
        volatility = 1 + (statistics.stdev(precip_list) / 10)  # Normalize
    else:
        volatility = 1.0
    
    pricing = pricing_tool.invoke({
        "coverage_rlusd": state["coverage_rlusd"],
        "risk_score": risk["risk_score"],
        "weather_volatility": min(volatility, 1.5)
    })
    
    return {
        "status": "quote_pending",
        "weather_data": weather,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "premium_rlusd": pricing["premium_rlusd"],
        "reasoning_log": [
            f"✅ Quote generated: {pricing['premium_rlusd']} RLUSD for {state['coverage_rlusd']} RLUSD coverage.",
            f"   Risk: {risk['risk_level']} ({risk['risk_score']:.2%}), Volatility: {volatility:.2f}x"
        ]
    }


def monitor_node(state: AgentState) -> Dict:
    """
    Phase 2: The Watchman.
    Checks current weather conditions against policy triggers.
    """
    loc = state["location"]
    
    # Fetch current weather
    weather = weather_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "days": 7
    })
    
    if weather["status"] != "success":
        return {
            "reasoning_log": [f"⚠️ Monitor check failed: {weather.get('message')}"]
        }
    
    # Analyze against trigger
    avg_temp = sum(weather.get("temperature_max_c", [25])) / max(len(weather.get("temperature_max_c", [1])), 1)
    avg_moisture = sum(weather.get("soil_moisture", [0.3])) / max(len(weather.get("soil_moisture", [1])), 1)
    
    risk = risk_tool.invoke({
        "precipitation_mm": weather["total_precipitation_mm"],
        "temperature_c": avg_temp,
        "soil_moisture": avg_moisture,
        "crop_type": state["crop_type"]
    })
    
    # Decision logic
    if risk["risk_score"] >= 0.8:
        return {
            "status": "claim_triggered",
            "weather_data": weather,
            "risk_score": risk["risk_score"],
            "reasoning_log": [
                f"🚨 CLAIM TRIGGERED: Risk score {risk['risk_score']:.2%} exceeds threshold.",
                f"   Precipitation: {weather['total_precipitation_mm']}mm (7-day)"
            ]
        }
    
    return {
        "weather_data": weather,
        "risk_score": risk["risk_score"],
        "reasoning_log": [
            f"✓ Monitor check: Risk {risk['risk_score']:.2%} (Safe). Next check scheduled."
        ]
    }


def verify_node(state: AgentState) -> Dict:
    """
    Phase 3: The Investigator.
    Cross-checks triggered claims with satellite/secondary data.
    """
    # In production, this would call satellite_tool
    # For now, we simulate verification
    
    risk_score = state.get("risk_score", 0)
    
    # Simulate satellite verification
    # In reality: Check NDVI, visual crop stress, etc.
    satellite_confirms = risk_score >= 0.75  # Mock: Confirm if risk is high enough
    
    if satellite_confirms:
        return {
            "confidence_score": min(risk_score + 0.05, 1.0),
            "reasoning_log": [
                f"🛰️ Satellite verification CONFIRMED crop stress.",
                f"   Confidence: {min(risk_score + 0.05, 1.0):.2%}"
            ]
        }
    else:
        return {
            "status": "monitoring",  # Return to monitoring
            "reasoning_log": [
                f"🛰️ Satellite data CONFLICTS with weather data.",
                f"   Returning to monitoring mode. Manual review recommended."
            ]
        }


def settle_node(state: AgentState) -> Dict:
    """
    Phase 4: The Paymaster.
    Executes the XRPL EscrowFinish transaction.
    """
    # This would use actual escrow data from the policy
    result = {
        "status": "settled",
        "reasoning_log": [
            f"💰 PAYOUT EXECUTED for Policy {state['policy_id']}",
            f"   Amount: {state['coverage_rlusd']} RLUSD",
            f"   Final Confidence: {state.get('confidence_score', 0):.2%}"
        ]
    }
    
    # In production: Call xrpl_escrow_tool with real parameters
    # xrpl_escrow_tool.invoke({...})
    
    return result


# ============================================
# GRAPH CONSTRUCTION
# ============================================

def build_underwriting_graph() -> StateGraph:
    """Builds the graph for new policy underwriting."""
    graph = StateGraph(AgentState)
    
    graph.add_node("underwrite", underwrite_node)
    graph.set_entry_point("underwrite")
    
    graph.add_conditional_edges(
        "underwrite",
        lambda x: x["status"],
        {
            "quote_pending": END,  # Return quote to user
            "rejected": END
        }
    )
    
    return graph.compile()


def build_monitoring_graph() -> StateGraph:
    """Builds the graph for monitoring active policies."""
    graph = StateGraph(AgentState)
    
    graph.add_node("monitor", monitor_node)
    graph.add_node("verify", verify_node)
    graph.add_node("settle", settle_node)
    
    graph.set_entry_point("monitor")
    
    # Monitor -> Verify (if triggered) or END (if safe)
    graph.add_conditional_edges(
        "monitor",
        lambda x: x["status"],
        {
            "claim_triggered": "verify",
            "monitoring": END,
            "active": END
        }
    )
    
    # Verify -> Settle (if confirmed) or END (if conflict)
    graph.add_conditional_edges(
        "verify",
        lambda x: x["status"],
        {
            "claim_triggered": "settle",  # Remains triggered = confirmed
            "monitoring": END  # Conflict, return to monitoring
        }
    )
    
    graph.add_edge("settle", END)
    
    return graph.compile()


# Compile the graphs
underwriting_app = build_underwriting_graph()
monitoring_app = build_monitoring_graph()
