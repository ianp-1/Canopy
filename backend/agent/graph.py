"""
LangGraph Agent: The Autonomous Orchestrator
=============================================

The AI agent is the "Manager" of the platform.  While the XGBoost model
(the "Worker") provides a raw probability score, the agent provides
context, reasoning, and agency to act on that score.

It operates as a 24/7 digital insurance adjuster managing the full
lifecycle of every policy through four phases:

  1. **Underwrite (Gatekeeper)** – Land verification, predictive
     blocking, storm-event awareness, dynamic pricing.

  2. **Monitor (Guardian)** – Multimodal data fusion across weather,
     storm events, and ML risk.  The LLM brain reasons over conflicting
     signals rather than blindly trusting a single threshold.

  3. **Verify (Investigator)** – Cross-checks weather-based risk
     against xWeather storm events.  Resolves conflicts with explicit
     reasoning.

  4. **Settle (Paymaster)** – The agent is the *only* entity that can
     trigger EscrowFinish.  It generates a Claim Summary, records an
     audit entry with evidence hash, and executes the payout.

**Explainability**: Every node produces a structured Chain-of-Thought
block in the reasoning_log so judges / insurers can see exactly *why*
the agent made each decision.
"""
from typing import TypedDict, Literal, List, Dict, Optional, Any, Annotated
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import json
import operator
import os
from datetime import datetime, timezone

# Import our tools
from backend.agent.tools import (
    weather_tool,
    risk_tool,
    pricing_tool,
    land_verification_tool,
    satellite_tool,
    storm_events_tool,
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

def _get_llm() -> Optional[ChatOpenAI]:
    """Returns a ChatOpenAI instance, or None when the API key is not
    configured (unit-test / CI environments)."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    google_key = os.environ.get("GOOGLE_API_KEY", "")
    provider = os.environ.get("LLM_PROVIDER", "openai").lower()
    
    print(f"DEBUG: _get_llm provider={provider}, google_key_len={len(google_key)}")

    if provider == "gemini" and google_key:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=os.environ.get("GEMINI_MODEL", "gemini-pro"),
            google_api_key=google_key,
            temperature=0.1,
            convert_system_message_to_human=True # Gemini sometimes prefers this
        )

    if not api_key:
        return None
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
# CHAIN-OF-THOUGHT HELPER
# ============================================

def _build_cot(phase: str, steps: List[str], decision: str, confidence: float) -> Dict[str, Any]:
    """Build a structured Chain-of-Thought block.

    Returns a Dict object for the reasoning log.
    """
    import datetime

    return {
        "phase": phase,
        "steps": steps,
        "decision": decision,
        "confidence": round(confidence, 4),
        "formatted_confidence": f"{confidence:.2%}",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }


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
    storm_data: Optional[Dict]
    land_verification: Optional[Dict]

    # Agent Reasoning
    reasoning_log: Annotated[List[Dict[str, Any]], operator.add]  # Append-only log
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
    2. Check for active severe-weather events (xWeather).
    3. Fetch the 7-day weather forecast.
    4. Run the ML risk model.
    5. Ask the LLM whether to approve, reject, or adjust the premium.
    6. Calculate dynamic premium (incorporating storm surcharge).
    7. Record an audit entry with Chain-of-Thought.
    """
    loc = state["location"]
    policy_id = state["policy_id"]
    cot_steps: List[str] = []

    # ── Step 0: Signup Deadline Check ──────────────────────────────
    today = datetime.now(timezone.utc).date()
    # Deadlines for 2026 Crop Year
    deadlines = {
        "corn": datetime(2026, 3, 15).date(),
        "soy": datetime(2026, 3, 15).date(),
        "soybean": datetime(2026, 3, 15).date(),
        "spring_wheat": datetime(2026, 3, 15).date(),
        "wheat": datetime(2026, 3, 15).date(), # Default to spring wheat if ambiguous
        "winter_wheat": datetime(2025, 9, 30).date(),
        "other": datetime(2026, 3, 15).date(),
    }
    
    crop = state["crop_type"].lower()
    deadline = deadlines.get(crop, deadlines["other"])
    
    if today > deadline:
        cot = _build_cot(
            "Underwriting", 
            [f"Signup window for {crop} (2026) closed on {deadline}. Today is {today}."], 
            "REJECT — signup window closed", 0.0
        )
        return {
            "status": "rejected",
            "reasoning_log": [cot],
        }

    # ── Step 1: Land Verification (Satellite + OSM) ────────────────
    # Replaced pure OSM check with Satellite Tool (Earth Engine + OSM)
    land = satellite_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "analysis_type": "land_cover",
    })
    
    is_farmland = land.get("is_farmland", False)
    details = land.get("details", {})
    source_desc = land.get("source", "Unknown")

    cot_steps.append(
        f"Land check at ({loc['lat']}, {loc['lon']}): "
        f"status={land.get('status')}, "
        f"farmland={is_farmland}, "
        f"source={source_desc}"
    )

    # Fail if neither CDL nor OSM confirms it's farmland
    if land.get("status") == "success" and is_farmland is False:
        cot = _build_cot("Underwriting", cot_steps, "REJECT — not farmland", 0.95)
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "REJECT",
            "reasoning": cot,
            "confidence": 0.95,
        })
        return {
            "status": "rejected",
            "land_verification": land,
            "reasoning_log": [cot],
        }

    # ── Step 2: Storm Events ──────────────────────────────────────
    storms = storm_events_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
    })
    storm_count = storms.get("event_count", 0)
    cot_steps.append(
        f"Storm events ({storms.get('source', '?')}): "
        f"{storm_count} active event(s)"
        + (f" — {[e['type'] for e in storms.get('active_events', [])]}"
           if storm_count else "")
    )

    # ── Step 3: Weather Forecast ───────────────────────────────────
    weather = weather_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "days": 7,
    })

    if weather["status"] != "success":
        cot_steps.append(f"Weather API error: {weather.get('message')}")
        cot = _build_cot("Underwriting", cot_steps, "REJECT — data unavailable", 0.0)
        return {
            "status": "rejected",
            "reasoning_log": [cot],
        }

    cot_steps.append(
        f"Weather 7d: precip={weather.get('total_precipitation_mm')}mm, "
        f"temps={weather.get('temperature_max_c')}"
    )

    # ── Step 4: ML Risk Score ──────────────────────────────────────
    temp_list = weather.get("temperature_max_c") or [25]
    moisture_list = weather.get("soil_moisture") or [0.3]
    avg_temp = sum(temp_list) / max(len(temp_list), 1)
    avg_moisture = sum(moisture_list) / max(len(moisture_list), 1)

    risk = risk_tool.invoke({
        "precipitation_mm": weather["total_precipitation_mm"],
        "temperature_c": avg_temp,
        "soil_moisture": avg_moisture,
        "crop_type": state["crop_type"],
    })
    cot_steps.append(
        f"ML model: risk_score={risk.get('risk_score')}, "
        f"level={risk.get('risk_level')}"
    )

    # ── Step 5: LLM Reasoning ─────────────────────────────────────
    tool_summary = json.dumps({
        "land_verification": {
            "is_farmland": land.get("is_farmland"),
            "details": land.get("note"),
        },
        "storm_events": {
            "event_count": storm_count,
            "events": storms.get("active_events", []),
        },
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
    if llm_response:
        cot_steps.append(f"LLM reasoning: {llm_response[:200]}")

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
        cot = _build_cot(
            "Underwriting", cot_steps,
            "REJECT", risk.get("risk_score", 0.5),
        )
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "REJECT",
            "reasoning": cot,
            "confidence": risk.get("risk_score", 0.5),
            "evidence_data": tool_summary,
        })
        return {
            "status": "rejected",
            "risk_score": risk.get("risk_score"),
            "risk_level": risk.get("risk_level"),
            "weather_data": weather,
            "reasoning_log": [cot],
        }


    # ── Step 6: Dynamic Premium ────────────────────────────────────
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
        "crop_type": state["crop_type"],
        "weather_volatility": min(volatility, 1.5),
        "active_storm_events": storm_count,
        "farm_size_hectares": state.get("farm_size_hectares", 10.0),
    })
    cot_steps.append(f"Premium: {pricing['premium_xrp']} XRP — {pricing.get('explanation', '')}")

    cot = _build_cot(
        "Underwriting", cot_steps,
        f"APPROVE — {pricing['premium_xrp']} XRP",
        1.0 - risk.get("risk_score", 0.5),
    )

    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "APPROVE",
        "reasoning": cot,
        "confidence": 1.0 - risk.get("risk_score", 0.5),
        "evidence_data": tool_summary,
    })

    return {
        "status": "quote_pending",
        "weather_data": weather,
        "storm_data": storms,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "premium_xrp": pricing["premium_xrp"],
        "land_verification": land,
        "llm_reasoning": llm_response,
        "reasoning_log": [cot],
    }


def monitor_node(state: AgentState) -> Dict:
    """
    Phase 2: The Guardian.

    Multimodal data fusion: weather + storm events + ML risk.  The LLM
    reasons over all sources before deciding whether to trigger a claim.
    """
    loc = state["location"]
    policy_id = state["policy_id"]
    cot_steps: List[str] = []

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

    cot_steps.append(
        f"Weather 7d: precip={weather.get('total_precipitation_mm')}mm"
    )

    storms = storm_events_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
    })
    storm_count = storms.get("event_count", 0)
    cot_steps.append(
        f"Storm events: {storm_count} active"
        + (f" — types: {[e['type'] for e in storms.get('active_events', [])]}"
           if storm_count else "")
    )

    temp_list = weather.get("temperature_max_c") or [25]
    moisture_list = weather.get("soil_moisture") or [0.3]
    avg_temp = sum(temp_list) / max(len(temp_list), 1)
    avg_moisture = sum(moisture_list) / max(len(moisture_list), 1)

    risk = risk_tool.invoke({
        "precipitation_mm": weather["total_precipitation_mm"],
        "temperature_c": avg_temp,
        "soil_moisture": avg_moisture,
        "crop_type": state["crop_type"],
    })
    cot_steps.append(
        f"ML model: risk_score={risk.get('risk_score')}, "
        f"level={risk.get('risk_level')}"
    )

    # ── LLM Reasoning over all sources ─────────────────────────────
    tool_summary = json.dumps({
        "weather_7d": {
            "total_precipitation_mm": weather.get("total_precipitation_mm"),
            "temperature_max_c": weather.get("temperature_max_c"),
            "soil_moisture": weather.get("soil_moisture"),
        },
        "storm_events": {
            "event_count": storm_count,
            "has_severe": storms.get("has_severe_events"),
            "events": storms.get("active_events", []),
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
    if llm_response:
        cot_steps.append(f"LLM reasoning: {llm_response[:200]}")

    # Determine action
    # Parse LLM decision: look for explicit TRIGGER or CLAIM at the start
    should_trigger = False
    if llm_response:
        # Normalize: strip and uppercase the first word
        first_word = llm_response.strip().split(":")[0].strip().upper()
        if first_word in ("TRIGGER", "CLAIM", "PAYOUT"):
            should_trigger = True
        # Also check for "TRIGGER CLAIM" or "INITIATE PAYOUT" patterns
        elif llm_response.strip().upper().startswith("TRIGGER"):
            should_trigger = True
    else:
        # Threshold fallback: high ML risk OR severe storm events
        should_trigger = (
            risk.get("risk_score", 0) >= 0.7  # Lowered from 0.8
            or (
                risk.get("risk_score", 0) >= 0.6
                and storms.get("has_severe_events") is True
            )
        )

    if should_trigger:
        cot = _build_cot(
            "Monitoring", cot_steps,
            "TRIGGER CLAIM", risk.get("risk_score", 0.5),
        )
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "TRIGGER_CLAIM",
            "reasoning": cot,
            "confidence": risk.get("risk_score", 0.5),
            "evidence_data": tool_summary,
        })
        return {
            "status": "claim_triggered",
            "weather_data": weather,
            "storm_data": storms,
            "risk_score": risk["risk_score"],
            "llm_reasoning": llm_response,
            "reasoning_log": [cot],
        }

    cot = _build_cot(
        "Monitoring", cot_steps,
        "SAFE — continue monitoring",
        1.0 - risk.get("risk_score", 0.5),
    )
    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "MONITOR_OK",
        "reasoning": cot,
        "confidence": 1.0 - risk.get("risk_score", 0.5),
        "evidence_data": tool_summary,
    })
    return {
        "weather_data": weather,
        "storm_data": storms,
        "risk_score": risk["risk_score"],
        "llm_reasoning": llm_response,
        "reasoning_log": [cot],
    }


def verify_node(state: AgentState) -> Dict:
    """
    Phase 3: The Investigator.

    Cross-checks the triggered claim using a fresh storm-events query
    and LLM reasoning.  Resolves conflicts between weather-based risk
    and storm data.
    """
    loc = state["location"]
    risk_score = state.get("risk_score", 0)
    policy_id = state["policy_id"]
    cot_steps: List[str] = []

    cot_steps.append(f"Triggered risk_score: {risk_score}")

    # Fetch fresh storm data for independent verification
    storms = storm_events_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
    })
    storm_count = storms.get("event_count", 0)
    cot_steps.append(
        f"Verification storm check: {storm_count} event(s)"
        + (f" — {[e['type'] for e in storms.get('active_events', [])]}"
           if storm_count else "")
    )

    # ── Satellite Crop Health Check (NDVI) ─────────────────────────
    # Verify crop health during claim period
    ndvi_data = satellite_tool.invoke({
        "latitude": loc["lat"],
        "longitude": loc["lon"],
        "analysis_type": "ndvi",
    })
    
    mean_ndvi = ndvi_data.get("mean_ndvi", 0.0)
    cot_steps.append(
        f"Satellite Verification: Mean NDVI={mean_ndvi} "
        f"({ndvi_data.get('platform', 'Unknown')})"
    )

    tool_summary = json.dumps({
        "triggered_risk_score": risk_score,
        "weather_data": state.get("weather_data", {}),
        "storm_verification": {
            "event_count": storm_count,
            "has_severe": storms.get("has_severe_events"),
            "events": storms.get("active_events", []),
        },
        "satellite_verification": {
            "mean_ndvi": mean_ndvi,
            "image_date": ndvi_data.get("image_date"),
            "status": ndvi_data.get("status")
        }
    }, indent=2)

    llm_response = _llm_decide(VERIFY_REASONING_PROMPT, tool_summary)
    if llm_response:
        cot_steps.append(f"LLM reasoning: {llm_response[:200]}")

    # Determine verification result
    confirmed = False
    if llm_response:
        lower = llm_response.lower()
        confirmed = "confirm" in lower or "approve" in lower
    else:
        # Fallback Logic:
        # 1. Storm data corroborates (Severe Event)
        # 2. Risk is very high (> 0.85)
        # 3. Satellite shows vegetation stress (NDVI < 0.3 during growing season)
        #    Note: simplistic threshold; ideal would depend on crop/season
        
        is_stress_detected = (mean_ndvi < 0.35 and mean_ndvi > 0.0) # 0.0 often means clouds/no-data
        
        confirmed = (
            storms.get("has_severe_events") is True
            or risk_score >= 0.85
            or (risk_score >= 0.6 and is_stress_detected)
        )

    if confirmed:
        confidence = min(risk_score + 0.1, 1.0)
        cot = _build_cot("Verification", cot_steps, "CONFIRMED", confidence)
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "VERIFY_CONFIRMED",
            "reasoning": cot,
            "confidence": confidence,
            "evidence_data": tool_summary,
        })
        return {
            "storm_data": storms,
            "confidence_score": confidence,
            "llm_reasoning": llm_response,
            "reasoning_log": [cot],
        }

    cot = _build_cot("Verification", cot_steps, "CONFLICT — back to monitoring", 0.3)
    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "VERIFY_CONFLICT",
        "reasoning": cot,
        "confidence": 0.3,
        "evidence_data": tool_summary,
    })
    return {
        "status": "monitoring",
        "storm_data": storms,
        "llm_reasoning": llm_response,
        "reasoning_log": [cot],
    }


def settle_node(state: AgentState) -> Dict:
    """
    Phase 4: The Paymaster.

    The agent is the *only* entity authorised to trigger EscrowFinish.
    It generates a Claim Summary, asks the LLM for a final confirmation,
    records an audit entry with evidence hash, and executes the payout.
    """
    policy_id = state["policy_id"]
    confidence = state.get("confidence_score", 0)
    cot_steps: List[str] = []

    cot_steps.append(f"Policy {policy_id}, coverage {state['coverage_xrp']} XRP")
    cot_steps.append(f"Final confidence from verification: {confidence:.2%}")
    cot_steps.append(f"Risk score: {state.get('risk_score')}")

    # ── Final LLM Confirmation ─────────────────────────────────────
    summary = json.dumps({
        "policy_id": policy_id,
        "coverage_xrp": state["coverage_xrp"],
        "risk_score": state.get("risk_score"),
        "confidence_score": confidence,
        "storm_data": state.get("storm_data", {}),
        "weather_data": {
            k: state.get("weather_data", {}).get(k)
            for k in ("total_precipitation_mm", "temperature_max_c")
            if state.get("weather_data")
        },
    }, indent=2)

    llm_response = _llm_decide(SETTLE_REASONING_PROMPT, summary)
    if llm_response:
        cot_steps.append(f"LLM final check: {llm_response[:200]}")

    should_settle = True
    if llm_response:
        lower = llm_response.lower()
        if "reject" in lower or "deny" in lower or "do not" in lower:
            should_settle = False

    if not should_settle:
        cot = _build_cot("Settlement", cot_steps, "DENIED", confidence)
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "SETTLE_DENIED",
            "reasoning": cot,
            "confidence": confidence,
            "evidence_data": summary,
        })
        return {
            "status": "monitoring",
            "llm_reasoning": llm_response,
            "reasoning_log": [cot],
        }

    # ── Execute EscrowFinish ───────────────────────────────────────
    result = xrpl_escrow_tool.invoke({
        "policy_id": policy_id,
        "agent_confidence": confidence,
    })

    if result.get("status") == "success":
        cot_steps.append(f"EscrowFinish tx: {result.get('tx_hash')}")
        cot = _build_cot(
            "Settlement", cot_steps,
            f"SETTLED — {state['coverage_xrp']} XRP released",
            confidence,
        )
        audit_log_tool.invoke({
            "policy_id": policy_id,
            "action": "SETTLE",
            "reasoning": cot,
            "confidence": confidence,
            "evidence_data": summary,
        })
        return {
            "status": "settled",
            "transaction_hash": result.get("tx_hash"),
            "llm_reasoning": llm_response,
            "reasoning_log": [cot],
        }

    cot_steps.append(f"EscrowFinish failed: {result.get('message')}")
    cot = _build_cot("Settlement", cot_steps, "FAILED — will retry", confidence)
    audit_log_tool.invoke({
        "policy_id": policy_id,
        "action": "SETTLE_FAILED",
        "reasoning": cot,
        "confidence": confidence,
        "evidence_data": summary,
    })
    return {
        "status": "settled",
        "llm_reasoning": llm_response,
        "reasoning_log": [cot],
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
