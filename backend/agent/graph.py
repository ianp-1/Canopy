"""
LangGraph Agent: The Autonomous Orchestrator
=============================================

The AI agent is the "Manager" of the platform.  While the XGBoost model
(the "Worker") provides a raw probability score, the agent provides
context, reasoning, and agency to act on that score.

It operates as a 24/7 digital insurance adjuster managing the full
lifecycle of every policy through four phases:

  1. **Underwrite (Gatekeeper)** – Land verification, predictive
     blocking, dynamic pricing.  The agent autonomously rejects
     applications for disasters that have already begun.

  2. **Monitor (Guardian)** – Multimodal data fusion across weather,
     satellite, and ML sources.  The LLM brain reasons over conflicting
     signals rather than blindly trusting a single threshold.

  3. **Verify (Investigator)** – Cross-checks weather-based risk
     against satellite crop-health data.  Resolves conflicts with
     explicit reasoning.

  4. **Settle (Paymaster)** – The agent is the *only* entity that can
     trigger EscrowFinish.  It generates a Claim Summary, records an
     audit entry, and executes the payout.

Each node gathers tool data and then passes it to the LLM for a
reasoned decision, rather than relying on hard-coded thresholds.
"""
from typing import TypedDict, Literal, List, Dict, Optional, Annotated
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import json
import operator
import os

# Import our tools
from backend.agent.tools import (
    weather_tool,
    risk_tool,
    pricing_tool,
    land_verification_tool,
    satellite_tool,
    xrpl_escrow_tool,
    audit_log_tool,
    get_all_tools,
)
from backend.agent.prompts import (
    AGENT_SYSTEM_PROMPT,
    UNDERWRITE_REASONING_PROMPT,
    MONITOR_REASONING_PROMPT,
    VERIFY_REASONING_PROMPT,
    SETTLE_REASONING_PROMPT,
    CHAT_SYSTEM_PROMPT,
)


# ============================================
# LLM CONFIGURATION
# ============================================

def _get_llm() -> ChatOpenAI:
    """Returns a ChatOpenAI instance, falling back to None when the
    API key is not configured (unit-test / CI environments)."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None  # type: ignore[return-value]
    return ChatOpenAI(
        model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.1,
    )


def _llm_decide(system: str, user_data: str) -> str:
    """Ask the LLM to reason about *user_data* under *system* prompt.
    Returns the raw text response, or an empty string when the LLM is
    unavailable."""
    llm = _get_llm()
    if llm is None:
        return ""
    response = llm.invoke([
        SystemMessage(content=system),
        HumanMessage(content=user_data),
    ])
    return response.content if hasattr(response, "content") else str(response)


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
    status: Literal[
        "quote_pending", "active", "monitoring",
        "claim_triggered", "settled", "rejected",
    ]

    # Policy Details
    location: Dict[str, float]  # {lat, lon}
    farm_size_hectares: float
    crop_type: str
    coverage_xrp: float

    # Calculated Values
    premium_xrp: Optional[float]

    # Data Interface
    weather_data: Optional[Dict]
    risk_score: Optional[float]
    risk_level: Optional[str]
    satellite_data: Optional[Dict]
    land_verification: Optional[Dict]

    # Agent Reasoning
    reasoning_log: Annotated[List[str], operator.add]  # Append-only log
    confidence_score: Optional[float]
    llm_reasoning: Optional[str]

    # XRPL References
    escrow_sequence: Optional[int]
    transaction_hash: Optional[str]


# ============================================
# NODE FUNCTIONS
# ============================================

def underwrite_node(state: AgentState) -> Dict:
    """
    Phase 1: The Gatekeeper.

    1. Verify the coordinates are actual farmland.
    2. Fetch the 7-day weather forecast.
    3. Run the ML risk model.
    4. Ask the LLM whether to approve, reject, or adjust the premium.
    5. Record an audit entry.
    """
    loc = state["location"]
    policy_id = state["policy_id"]

    # ── Step 1: Land Verification ──────────────────────────────────
    land = land_verification_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
    })

    if land.get("status") == "success" and land.get("is_farmland") is False:
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "REJECT",
            "reasoning": (
                f"Land verification failed. No agricultural features "
                f"detected at ({loc['lat']}, {loc['lon']}). "
                f"OSM features found: {land.get('osm_features_found', 0)}."
            ),
            "confidence": 0.95,
        })
        return {
            "status": "rejected",
            "land_verification": land,
            "reasoning_log": [
                f"❌ Policy REJECTED: Location ({loc['lat']}, {loc['lon']}) "
                f"is not verified farmland."
            ],
        }

    # ── Step 2: Weather Forecast ───────────────────────────────────
    weather = weather_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "days": 7,
    })

    if weather["status"] != "success":
        return {
            "status": "rejected",
            "reasoning_log": [
                f"❌ Underwriting failed: Weather API error – "
                f"{weather.get('message')}"
            ],
        }

    # ── Step 3: ML Risk Score ──────────────────────────────────────
    avg_temp = (
        sum(weather.get("temperature_max_c", [25]))
        / max(len(weather.get("temperature_max_c", [1])), 1)
    )
    avg_moisture = (
        sum(weather.get("soil_moisture", [0.3]))
        / max(len(weather.get("soil_moisture", [1])), 1)
    )

    risk = risk_tool.invoke({
        "precipitation_mm": weather["total_precipitation_mm"],
        "temperature_c": avg_temp,
        "soil_moisture": avg_moisture,
        "crop_type": state["crop_type"],
    })

    # ── Step 4: LLM Reasoning ─────────────────────────────────────
    tool_summary = json.dumps({
        "land_verification": land,
        "weather_7d": {
            "total_precipitation_mm": weather.get("total_precipitation_mm"),
            "temperature_max_c": weather.get("temperature_max_c"),
            "soil_moisture": weather.get("soil_moisture"),
        },
        "ml_risk": {
            "risk_score": risk.get("risk_score"),
            "risk_level": risk.get("risk_level"),
        },
        "policy": {
            "crop_type": state["crop_type"],
            "coverage_xrp": state["coverage_xrp"],
            "farm_size_hectares": state.get("farm_size_hectares"),
        },
    }, indent=2)

    llm_response = _llm_decide(UNDERWRITE_REASONING_PROMPT, tool_summary)

    # Parse the LLM decision (fallback to threshold-based if no LLM)
    decision = "approve"
    if llm_response:
        lower = llm_response.lower()
        if "reject" in lower:
            decision = "reject"
    else:
        # Threshold fallback when LLM is unavailable
        if risk.get("risk_level") == "CRITICAL":
            decision = "reject"

    if decision == "reject":
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "REJECT",
            "reasoning": llm_response or f"Risk too high: {risk.get('risk_score')}",
            "confidence": risk.get("risk_score", 0.5),
            "evidence_data": tool_summary,
        })
        return {
            "status": "rejected",
            "risk_score": risk.get("risk_score"),
            "weather_data": weather,
            "land_verification": land,
            "llm_reasoning": llm_response,
            "reasoning_log": [
                f"❌ Policy REJECTED by agent: "
                f"{llm_response or 'Risk score ' + str(risk.get('risk_score'))}"
            ],
        }

    # ── Step 5: Dynamic Premium ────────────────────────────────────
    import statistics
    precip_list = weather.get("precipitation_mm", [0])
    volatility = (
        1 + (statistics.stdev(precip_list) / 10)
        if len(precip_list) > 1
        else 1.0
    )

    pricing = pricing_tool.invoke({
        "coverage_xrp": state["coverage_xrp"],
        "risk_score": risk["risk_score"],
        "weather_volatility": min(volatility, 1.5),
    })

    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "APPROVE",
        "reasoning": (
            llm_response
            or f"Approved. Premium {pricing['premium_xrp']} XRP, "
               f"risk {risk['risk_level']} ({risk['risk_score']:.2%})."
        ),
        "confidence": 1.0 - risk.get("risk_score", 0.5),
        "evidence_data": tool_summary,
    })

    return {
        "status": "quote_pending",
        "weather_data": weather,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "premium_xrp": pricing["premium_xrp"],
        "land_verification": land,
        "llm_reasoning": llm_response,
        "reasoning_log": [
            f"✅ Quote generated: {pricing['premium_xrp']} XRP "
            f"for {state['coverage_xrp']} XRP coverage.",
            f"   Risk: {risk['risk_level']} ({risk['risk_score']:.2%}), "
            f"Volatility: {volatility:.2f}x",
            f"   Land verified: {land.get('is_farmland', 'N/A')}",
        ],
    }


def monitor_node(state: AgentState) -> Dict:
    """
    Phase 2: The Guardian.

    Multimodal data fusion: fetches weather *and* satellite data, runs
    the ML model, then asks the LLM to reason over all sources before
    deciding whether to trigger a claim.
    """
    loc = state["location"]
    policy_id = state["policy_id"]

    # ── Gather Data ────────────────────────────────────────────────
    weather = weather_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "days": 7,
    })

    if weather["status"] != "success":
        return {
            "reasoning_log": [
                f"⚠️ Monitor check failed: {weather.get('message')}"
            ],
        }

    sat = satellite_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
    })

    avg_temp = (
        sum(weather.get("temperature_max_c", [25]))
        / max(len(weather.get("temperature_max_c", [1])), 1)
    )
    avg_moisture = (
        sum(weather.get("soil_moisture", [0.3]))
        / max(len(weather.get("soil_moisture", [1])), 1)
    )

    risk = risk_tool.invoke({
        "precipitation_mm": weather["total_precipitation_mm"],
        "temperature_c": avg_temp,
        "soil_moisture": avg_moisture,
        "crop_type": state["crop_type"],
    })

    # ── LLM Reasoning over all sources ─────────────────────────────
    tool_summary = json.dumps({
        "weather_7d": {
            "total_precipitation_mm": weather.get("total_precipitation_mm"),
            "temperature_max_c": weather.get("temperature_max_c"),
            "soil_moisture": weather.get("soil_moisture"),
        },
        "satellite": {
            "health_score": sat.get("health_score"),
            "crop_damage_detected": sat.get("crop_damage_detected"),
            "moisture_trend": sat.get("moisture_trend"),
        },
        "ml_risk": {
            "risk_score": risk.get("risk_score"),
            "risk_level": risk.get("risk_level"),
        },
        "policy": {
            "policy_id": policy_id,
            "crop_type": state["crop_type"],
            "coverage_xrp": state["coverage_xrp"],
        },
    }, indent=2)

    llm_response = _llm_decide(MONITOR_REASONING_PROMPT, tool_summary)

    # Determine action
    should_trigger = False
    if llm_response:
        lower = llm_response.lower()
        if "trigger" in lower or "claim" in lower:
            should_trigger = True
    else:
        # Threshold fallback
        should_trigger = (
            risk.get("risk_score", 0) >= 0.8
            or (
                risk.get("risk_score", 0) >= 0.6
                and sat.get("crop_damage_detected") is True
            )
        )

    if should_trigger:
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "TRIGGER_CLAIM",
            "reasoning": (
                llm_response
                or f"Risk {risk.get('risk_score')}, satellite confirms damage."
            ),
            "confidence": risk.get("risk_score", 0.5),
            "evidence_data": tool_summary,
        })
        return {
            "status": "claim_triggered",
            "weather_data": weather,
            "satellite_data": sat,
            "risk_score": risk["risk_score"],
            "llm_reasoning": llm_response,
            "reasoning_log": [
                f"🚨 CLAIM TRIGGERED for Policy {policy_id}",
                f"   ML Risk: {risk['risk_score']:.2%}",
                f"   Satellite health: {sat.get('health_score')}",
                f"   Precip 7d: {weather.get('total_precipitation_mm')}mm",
            ],
        }

    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "MONITOR_OK",
        "reasoning": (
            llm_response
            or f"Risk {risk.get('risk_score'):.2%}, no action needed."
        ),
        "confidence": 1.0 - risk.get("risk_score", 0.5),
        "evidence_data": tool_summary,
    })
    return {
        "weather_data": weather,
        "satellite_data": sat,
        "risk_score": risk["risk_score"],
        "llm_reasoning": llm_response,
        "reasoning_log": [
            f"✓ Monitor check: Risk {risk['risk_score']:.2%} (Safe). "
            f"Satellite health {sat.get('health_score')}. Next check scheduled."
        ],
    }


def verify_node(state: AgentState) -> Dict:
    """
    Phase 3: The Investigator.

    Cross-checks the triggered claim using satellite data and LLM
    reasoning.  Resolves conflicts between weather and satellite signals.
    """
    loc = state["location"]
    risk_score = state.get("risk_score", 0)
    policy_id = state["policy_id"]

    # Fetch fresh satellite data for verification
    sat = satellite_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
    })

    tool_summary = json.dumps({
        "triggered_risk_score": risk_score,
        "weather_data": state.get("weather_data", {}),
        "satellite_verification": {
            "health_score": sat.get("health_score"),
            "crop_damage_detected": sat.get("crop_damage_detected"),
            "moisture_trend": sat.get("moisture_trend"),
            "details": sat.get("details"),
        },
    }, indent=2)

    llm_response = _llm_decide(VERIFY_REASONING_PROMPT, tool_summary)

    # Determine verification result
    confirmed = False
    if llm_response:
        lower = llm_response.lower()
        confirmed = "confirm" in lower or "approve" in lower
    else:
        # Fallback: confirm if satellite also shows damage
        confirmed = (
            sat.get("crop_damage_detected") is True
            or risk_score >= 0.75
        )

    if confirmed:
        confidence = min(risk_score + 0.05, 1.0)
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "VERIFY_CONFIRMED",
            "reasoning": (
                llm_response
                or f"Satellite confirms crop stress. Confidence {confidence:.2%}."
            ),
            "confidence": confidence,
            "evidence_data": tool_summary,
        })
        return {
            "satellite_data": sat,
            "confidence_score": confidence,
            "llm_reasoning": llm_response,
            "reasoning_log": [
                f"🛰️ Satellite verification CONFIRMED crop stress.",
                f"   Health score: {sat.get('health_score')}",
                f"   Confidence: {confidence:.2%}",
            ],
        }

    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "VERIFY_CONFLICT",
        "reasoning": (
            llm_response
            or "Satellite data conflicts with weather data."
        ),
        "confidence": 0.3,
        "evidence_data": tool_summary,
    })
    return {
        "status": "monitoring",
        "satellite_data": sat,
        "llm_reasoning": llm_response,
        "reasoning_log": [
            f"🛰️ Satellite data CONFLICTS with weather data.",
            f"   Health score: {sat.get('health_score')}",
            f"   Returning to monitoring mode. Manual review recommended.",
        ],
    }


def settle_node(state: AgentState) -> Dict:
    """
    Phase 4: The Paymaster.

    The agent is the *only* entity authorised to trigger EscrowFinish.
    It generates a Claim Summary, asks the LLM for a final confirmation,
    records an audit entry, and executes the payout via the XRPL tool.
    """
    policy_id = state["policy_id"]
    confidence = state.get("confidence_score", 0)

    # ── Final LLM Confirmation ─────────────────────────────────────
    summary = json.dumps({
        "policy_id": policy_id,
        "coverage_xrp": state["coverage_xrp"],
        "risk_score": state.get("risk_score"),
        "confidence_score": confidence,
        "satellite_data": state.get("satellite_data", {}),
        "weather_data": {
            k: state.get("weather_data", {}).get(k)
            for k in ("total_precipitation_mm", "temperature_max_c")
            if state.get("weather_data")
        },
    }, indent=2)

    llm_response = _llm_decide(SETTLE_REASONING_PROMPT, summary)

    should_settle = True
    if llm_response:
        lower = llm_response.lower()
        if "reject" in lower or "deny" in lower or "do not" in lower:
            should_settle = False

    if not should_settle:
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "SETTLE_DENIED",
            "reasoning": llm_response or "Agent denied settlement.",
            "confidence": confidence,
            "evidence_data": summary,
        })
        return {
            "status": "monitoring",
            "llm_reasoning": llm_response,
            "reasoning_log": [
                f"⛔ SETTLEMENT DENIED by agent for Policy {policy_id}.",
                f"   Reason: {llm_response}",
                f"   Returning to monitoring.",
            ],
        }

    # ── Execute EscrowFinish ───────────────────────────────────────
    result = xrpl_escrow_tool.invoke({
        "policy_id": policy_id,
        "agent_confidence": confidence,
    })

    if result.get("status") == "success":
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "SETTLE",
            "reasoning": (
                llm_response
                or f"Payout executed. Confidence {confidence:.2%}."
            ),
            "confidence": confidence,
            "evidence_data": summary,
        })
        return {
            "status": "settled",
            "transaction_hash": result.get("tx_hash"),
            "llm_reasoning": llm_response,
            "reasoning_log": [
                f"💰 PAYOUT EXECUTED for Policy {policy_id}",
                f"   Amount: {state['coverage_xrp']} XRP",
                f"   Tx Hash: {result.get('tx_hash')}",
                f"   Final Confidence: {confidence:.2%}",
            ],
        }

    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "SETTLE_FAILED",
        "reasoning": f"EscrowFinish failed: {result.get('message')}",
        "confidence": confidence,
        "evidence_data": summary,
    })
    return {
        "status": "settled",
        "llm_reasoning": llm_response,
        "reasoning_log": [
            f"⚠️ PAYOUT ATTEMPTED for Policy {policy_id} but "
            f"settlement returned: {result.get('message', 'unknown error')}",
            f"   The cron job will retry settlement on next cycle.",
        ],
    }


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
            "rejected": END,
        },
    )

    return graph.compile()


def build_monitoring_graph() -> StateGraph:
    """Builds the graph for monitoring active policies."""
    graph = StateGraph(AgentState)

    graph.add_node("monitor", monitor_node)
    graph.add_node("verify", verify_node)
    graph.add_node("settle", settle_node)

    graph.set_entry_point("monitor")

    # Monitor → Verify (if triggered) or END (if safe)
    graph.add_conditional_edges(
        "monitor",
        lambda x: x["status"],
        {
            "claim_triggered": "verify",
            "monitoring": END,
            "active": END,
        },
    )

    # Verify → Settle (if confirmed) or END (if conflict)
    graph.add_conditional_edges(
        "verify",
        lambda x: x["status"],
        {
            "claim_triggered": "settle",  # Remains triggered → confirmed
            "monitoring": END,  # Conflict → return to monitoring
        },
    )

    graph.add_edge("settle", END)

    return graph.compile()


# Compile the graphs
underwriting_app = build_underwriting_graph()
monitoring_app = build_monitoring_graph()
