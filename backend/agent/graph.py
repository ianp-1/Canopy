from typing import TypedDict, Literal, List, Dict
from langgraph.graph import StateGraph, END
# from backend.agent.prompts import get_agent_prompt
# from backend.services.weather import get_weather_data
# from backend.services.xrpl_service import mint_policy_nft, execute_payout

class AgentState(TypedDict):
    """
    The state of the insurance policy lifecycle.
    """
    policy_id: str
    status: Literal["applied", "active", "claim_triggered", "settled", "rejected"]
    
    # Inputs
    location: Dict[str, float] # {lat, lon}
    farm_size_hectares: float
    crop_type: str
    
    # Data Interface
    weather_history: List[Dict]
    forecast_data: List[Dict]
    model_score: float # From XGBoost
    
    # Agent Reasoning
    reasoning_log: List[str]
    confidence_score: float

def underwrite_node(state: AgentState):
    """
    Phase 1: The Gatekeeper.
    Checks land usage, forecast, and model score to approve/reject.
    """
    print(f"Underwriting Policy {state['policy_id']}...")
    # TODO: implementation
    # 1. Check Google Earth (is it a farm?)
    # 2. Check Open-Meteo Forecast (is disaster imminent?)
    # 3. Check XGBoost Model Score
    
    # Mock decision for now
    approved = True 
    if approved:
        # TODO: Call XRPL Mint Tool
        return {"status": "active", "reasoning_log": ["Policy approved based on clean forecast."]}
    else:
        return {"status": "rejected", "reasoning_log": ["Rejected due to active drought forecast."]}

def monitor_node(state: AgentState):
    """
    Phase 2: The Guardian.
    Periodically checks weather data.
    """
    print(f"Monitoring Policy {state['policy_id']}...")
    # TODO: Fetch live weather data
    # TODO: Compare against policy conditions
    
    trigger_met = False
    if trigger_met:
        return {"status": "claim_triggered"}
    return {"status": "active"}

def adjudicate_node(state: AgentState):
    """
    Phase 3: The Oracle.
    Final check and payout execution.
    """
    print(f"Adjudicating Claim for Policy {state['policy_id']}...")
    # TODO: Fusion Check (Weather + Satellite + Model)
    # TODO: Run LLM Reasoning Chain
    
    approved_payout = True
    if approved_payout:
        # TODO: Trigger XRPL EscrowFinish
        return {"status": "settled", "reasoning_log": ["Payout confirmed. Escrow released."]}
    return {"status": "active"} # Return to monitoring if false alarm?

# --- Graph Construction ---
flow = StateGraph(AgentState)

flow.add_node("underwrite", underwrite_node)
flow.add_node("monitor", monitor_node)
flow.add_node("adjudicate", adjudicate_node)

# Entry point
flow.set_entry_point("underwrite")

# Edges
flow.add_conditional_edges(
    "underwrite",
    lambda x: x["status"],
    {
        "active": "monitor",
        "rejected": END
    }
)

flow.add_conditional_edges(
    "monitor",
    lambda x: x["status"],
    {
        "active": END, # End of *this* run, but stays active in DB
        "claim_triggered": "adjudicate"
    }
)

flow.add_edge("adjudicate", END)

app = flow.compile()
