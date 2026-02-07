# Merge Conflict Resolution Guide

## Problem
When merging branch `copilot/convert-to-rlusd-xrpl-testnet` into `main`, conflicts arise in:
- `backend/agent/graph.py`
- `backend/agent/tools.py`

## Root Cause
The feature branch converted the application from using XRP to RLUSD:
- **Main branch (old)**: Uses `coverage_xrp` and `premium_xrp`
- **Feature branch (new)**: Uses `coverage_rlusd` and `premium_rlusd`

## Resolution Instructions

### For backend/agent/graph.py

#### Conflict Lines 45-48 (State Schema)
**Choose: Feature branch (OURS)**
```python
# Policy Details
location: Dict[str, float]  # {lat, lon}
farm_size_hectares: float
crop_type: str
coverage_rlusd: float  # ← Use this (not coverage_xrp)

# Calculated Values
premium_rlusd: Optional[float]  # ← Use this (not premium_xrp)
```

#### Conflict Lines 118-131 (underwrite_node pricing call)
**Choose: Feature branch (OURS)**
```python
pricing = pricing_tool.invoke({
    "coverage_rlusd": state["coverage_rlusd"],  # ← Use this
    "risk_score": risk["risk_score"],
    "weather_volatility": min(volatility, 1.5)
})

return {
    "status": "quote_pending",
    "weather_data": weather,
    "risk_score": risk["risk_score"],
    "risk_level": risk["risk_level"],
    "premium_rlusd": pricing["premium_rlusd"],  # ← Use this
    "reasoning_log": [
        f"✅ Quote generated: {pricing['premium_rlusd']} RLUSD for {state['coverage_rlusd']} RLUSD coverage.",  # ← Use this
        f"   Risk: {risk['risk_level']} ({risk['risk_score']:.2%}), Volatility: {volatility:.2f}x"
    ]
}
```

#### Conflict Line 229 (settle_node)
**Choose: Feature branch (OURS)**
```python
reasoning_log": [
    f"💰 PAYOUT EXECUTED for Policy {state['policy_id']}",
    f"   Amount: {state['coverage_rlusd']} RLUSD",  # ← Use this (not coverage_xrp)
    f"   Final Confidence: {state.get('confidence_score', 0):.2%}"
]
```

### For backend/agent/tools.py

#### Conflict Lines 163-198 (pricing_tool function)
**Choose: Feature branch (OURS)**
```python
@tool
def pricing_tool(
    coverage_rlusd: float,  # ← Use this parameter name
    risk_score: float,
    weather_volatility: float = 1.0
) -> Dict[str, Any]:
    """
    Calculates the dynamic premium based on coverage and risk.
    Formula: Premium = (Coverage * BaseRate) * (1 + ModelScore) * VolatilityMultiplier
    
    Args:
        coverage_rlusd: The coverage amount in RLUSD.  # ← Update docstring
        risk_score: The ML model's risk prediction (0.0-1.0).
        weather_volatility: Multiplier for weather uncertainty (default 1.0).
    
    Returns:
        Dictionary with calculated premium_rlusd and breakdown.  # ← Update docstring
    """
    BASE_RATE = 0.05  # 5% base rate
    
    # Calculate premium
    base_premium = coverage_rlusd * BASE_RATE  # ← Use this variable
    risk_multiplier = 1 + risk_score
    volatility_multiplier = max(1.0, min(weather_volatility, 2.0))  # Cap at 2x
    
    final_premium = base_premium * risk_multiplier * volatility_multiplier
    
    return {
        "status": "success",
        "premium_rlusd": round(final_premium, 2),  # ← Use this key
        "coverage_rlusd": coverage_rlusd,  # ← Use this key
        "breakdown": {
            "base_rate": BASE_RATE,
            "base_premium": round(base_premium, 2),
            "risk_multiplier": round(risk_multiplier, 4),
            "volatility_multiplier": round(volatility_multiplier, 2),
        }
    }
```

## Verification Steps

After resolving conflicts:

1. **Check for consistency**:
   ```bash
   grep -n "coverage_xrp\|premium_xrp" backend/agent/graph.py backend/agent/tools.py
   # Should return no results
   
   grep -n "coverage_rlusd\|premium_rlusd" backend/agent/graph.py backend/agent/tools.py
   # Should show all the correct references
   ```

2. **Verify the changes are correct**:
   - All `coverage_xrp` → `coverage_rlusd`
   - All `premium_xrp` → `premium_rlusd`
   - All "XRP" in messages → "RLUSD"
   
3. **Test imports**:
   ```bash
   cd backend
   python -c "from agent.graph import underwriting_app, monitoring_app; print('✓ Imports work')"
   python -c "from agent.tools import get_all_tools; print('✓ Tools import')"
   ```

## Summary

**Resolution Strategy: Accept ALL changes from feature branch (OURS)**

The feature branch has been carefully converted to use RLUSD throughout. The main branch is outdated with XRP references. When resolving conflicts:

```bash
# If using git command line:
git checkout --ours backend/agent/graph.py
git checkout --ours backend/agent/tools.py
git add backend/agent/graph.py backend/agent/tools.py
```

Or in a merge conflict editor, choose "Accept Incoming Changes" (from feature branch).

