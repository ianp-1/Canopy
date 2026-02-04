# AgriSure: Site & App Design Specification

**Project ID:** `12338449975890287120`
**Style:** Premium Startup Aesthetic, Dark Mode, Deep Forest Void (#0a2518), Neon Cyber Lime (#11d452), Glassmorphism.
**Typography:** Space Grotesk.

## 1. Landing Page (Public)
**Purpose:** Conversion and education.
**Hero:**
-   **Headline:** "Insurance That Pays Automatically."
-   **Subheadline:** "Parametric crop insurance powered by XRPL and real-time weather oracles."
-   **CTAs:** "Launch App" (Primary), "Explore Protocol" (Secondary).
**Sections:**
-   **Value Grid:** Data-Driven Triggers, Instant Payouts, Total Transparency.
-   **How It Works:** 4-step horizontal process (Policy -> Escrow -> Oracle -> Payout).
-   **Trust:** Powered by XRPL, Xaman, OpenWeather.

## 2. Farmer Dashboard (Authenticated)
**Purpose:** Overview of active policies and risk status.
**Navigation:** Sidebar (Dashboard, My Policies, Purchase, Weather, Governance).
**Key Metrics:**
-   **Total Value Locked (TVL):** Protocol liquidity.
-   **Active Risk Coverage:** Total $ value of user's insured assets.
-   **Next Payout Trigger:** Distance to nearest threshold breach.
**Main Content:**
-   **Active Policies:** List of active contracts with status (Monitoring, Triggered, Payout Ready).
-   **Live Weather Feed:** Widget showing real-time oracle data for insured locations.

## 3. Purchase Coverage (Wizard)
**Purpose:** Creation of new insurance policies.
**Flow:**
1.  **Crop & Location:** Select crop type (Corn, Soy, Wheat) and pinpoint field on map.
2.  **Risk Configuration:** Set parametric triggers (e.g., < 2 inches of rain) via sliders.
3.  **Quote:** Real-time calculation of premium in XRP based on risk probability.
4.  **Confirm:** Summary of terms and "Confirm & Pay" (Xaman wallet signature).

## 4. Weather Analytics
**Purpose:** Transparency and data verification.
**Features:**
-   **Charts:** Historical Rainfall vs. Policy Thresholds; Temperature Trends; Soil Moisture.
-   **Oracle Health:** Status indicator (Online/Offline).
-   **Data Log:** Stream of recent on-chain data pushes with transaction hashes.

## 5. Governance (HIDDEN/DEPRECATED)
*Note: Governance screen requirements have been removed for MVP.*
