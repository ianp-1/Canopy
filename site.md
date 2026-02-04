# AgriSure: Site & App Design Specification

**Project ID:** `12338449975890287120`
**Style:** "Friendly Soft-Tech". Light Mode. Rounds-2xl.
**Primary Color:** Fresh Sprout Green (#2E7D32).
**Typography:** Inter (UI) + Space Grotesk (Data).
**Background:** Warm Earth (#F5F5F7).

## 1. Landing Page (Public)
**Purpose:** Welcoming and educational.
**Hero:**
-   **Headline:** "Crop Insurance Made Simple."
-   **Visual:** Warm photography or friendly illustrations.
-   **CTAs:** Pill-shaped Dark Green (#2E7D32).

## 2. Farmer Dashboard
**Purpose:** Clear, stress-free overview.
**Style:** High contrast text on light backgrounds.
**Nav:** Dashboard, Marketplace, Wizard, Claims.
**Key Features:**
-   **Weather Widget:** Prominent, easy to understand.
-   **Policy Cards:** Clear status indicators.

## 3. Purchase Wizard (Variant 3: Dark Green Split Layout)
**Style:** Side-by-Side "Soft Tech" layout.
**Left Panel (Persistent Summary):**
-   Fixed position.
-   **Live Quote:** Updates in real-time.
-   **Price:** Large "100 XRP" in Space Grotesk (Green #2E7D32).
-   **Visual:** Probability Gauge.
**Right Panel (Interactive Steps):**
1.  **Location:** Map selection.
2.  **Crop:** 3D Illustrative cards (Corn, Wheat, Soy).
3.  **Risk:** Split-slider interface.
4.  **Confirm:** Large "Protect My Farm" button (Solid Dark Green #2E7D32).

## 4. Policy Details (Advanced Farmer View)
**Purpose:** Deep transparency and reassurance.
**Style:** Data-rich but friendly.
**Sections:**
-   **Hero Status:** "Protected" badge, Payout Potential (50k XRP), Days Left.
-   **Live Monitor:** Oracle Status Gauge (Green/Red zones).
-   **Coverage Analytics:**
    -   **History Chart:** 30-day rainfall vs Threshold line.
    -   **Probability:** "Risk of Payout" trend over time.
-   **Contract DNA:**
    -   **NFT Metadata:** Token ID, Policy Hash.
    -   **Location:** Exact Coordinates.
    -   **Oracle Source:** "NOAA Station #4829".

## 5. Insurer Dashboard (Admin)
**Purpose:** Risk management and Oracle control.
**Nav (Unique):** Command Center, Liquidity, Oracle, Policies, Settings.
**Style:** Dense but consistent "Soft Tech" aesthetic.

### 5a. Command Center (Overview)
-   **Liquidity:** TVL (1.5M XRP), Risk Heatmap.
-   **Oracle:** Health Monitor.
-   **Policies:** High-level registry.

### 5b. Liquidity Manager
-   **Purpose:** Manage capitalization of the pool.
-   **Controls:** "Add XRP to Pool", "Withdraw", "Rebalance".
-   **Charts:** "Capital Utilization Rate" (Line chart).
-   **List:** History of Escrow Creations.

### 5c. Oracle Console
-   **Purpose:** Deep technical logs & manual triggers.
-   **Logs:** Rolling feed of API calls ("GET /weather/iowa -> 200 OK").
-   **Health:** "Signer 1: Active", "Signer 2: Active".
-   **Actions:** "Force Check", "Emergency Pause".

### 5d. Policy Admin
-   **Purpose:** Searchable database of all contracts.
-   **Table:** Advanced filtering (by Crop, Region, Risk Level).
-   **Detail View:** Raw JSON metadata viewer for debugging.
