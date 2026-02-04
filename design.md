# Design System: AgriSure
**Project ID:** 12338449975890287120

## 1. Visual Theme & Atmosphere
AgriSure embodies a **"Friendly Soft-Tech"** aesthetic that bridges the gap between trusted agriculture and transparent blockchain technology.
-   **Mood:** Grounded, Transparent, Optimistic, and Professional. The interface feels like a helpful digital partner—clean but not sterile, warm but efficiently organized.
-   **Density:** Airy and spacious for Farmer flows (low cognitive load), compact and data-dense for Insurer dashboards (high utility).
-   **Philosophy:** "Trust through Clarity." High roundness (`rounded-2xl` to `rounded-full`) softens the technical edge, while precise data viz builds confidence.

## 2. Color Palette & Roles
*   **Fresh Sprout Green (#2E7D32):** The primary brand anchor. Used for high-priority actions (Main Buttons), active states, and "Protected" badges. It communicates growth and safety.
*   **Warm Earth (#F5F5F7):** The application canvas. A subtle, natural off-white that reduces eye strain and provides a warm foundation, contrasting with sterile capabilities.
*   **Clean White (#FFFFFF):** The container surface. Used for cards and panels to lift content off the background with distinct clarity.
*   **Deep Soil (#1B3A2B):** The primary ink. A rich, dark organic green-black used for headings and body text to ensure high contrast without the harshness of pure black.
*   **Morning Sky Blue (#E3F2FD):** A secondary accent used for subtle highlights, active fields, or information backgrounds.
*   **Alert Red (#D32F2F):** Used sparingly for "Risk" zones, "Payout Triggered" states, or "Danger Zone" actions.

## 3. Typography Rules
**Font Family:** `Inter` (UI/Body) + `Space Grotesk` (Data/Numbers).
*   **Headings:** Friendly, rounded sans-serif (Inter) with tight tracking for a modern feel.
*   **Data & Numerals:** `Space Grotesk` is used for all financial values (XRP, TVL) and environmental metrics (Rainfall). Its quirky, technical character emphasizes the "algorithmic" nature of the insurance.
*   **Body:** Clean, legible Inter for maximum readability.

## 4. Component Stylings
*   **Buttons:**
    *   *Primary:* **Pill-shaped (`rounded-full`)**. Filled with **Fresh Sprout Green (#2E7D32)**. White text. Soft, diffused shadow (`shadow-lg`).
    *   *Secondary:* Outlined in Deep Soil or Soft Grey. Transparent background.
*   **Cards/Containers:**
    *   *Shape:* Generously rounded corners (**`rounded-2xl`**).
    *   *Surface:* Clean White (#FFFFFF) with a "Whisper-soft" diffused shadow (`shadow-sm` or `shadow-md`) to separate from the Warm Earth background.
*   **Inputs/Forms:**
    *   *Style:* Pill-shaped or highly rounded (`rounded-xl`).
    *   *State:* Light grey border updates to Fresh Sprout Green on focus.
*   **Badges/Tags:**
    *   *Style:* Solid colors with white text, fully rounded (`rounded-full`).

## 5. Layout Principles
*   **Split-Screen ("The Wizard"):** For complex flows, use a fixed 30% "Summary Panel" on the left and a 70% "Action Canvas" on the right. This keeps context (Price/Risk) always visible.
*   **Dashboard Grid:** Modular bento-grid layout. Critical alerts (Weather) take full width; secondary metrics share 50/50 or 33/33/33 rows.
*   **Whitespace:** Generous padding (AT LEAST `p-6` or `p-8`) inside cards to prevent clutter.

## Stitch Prompts (Reference)

### Landing Page
```text
Create a friendly, approachable landing page for "AgriSure".
**Design Style:** "Soft Tech" aesthetic. Light mode. White cards, soft shadows, warm light-grey background. Rounded corners (`rounded-2xl`). Colors: Dark Green (#2E7D32) buttons.
**Headline:** "Crop Insurance Made Simple."
**Hero:** Welcoming illustration of a lush farm.
```

### Dashboard
```text
Create a clean, user-friendly dashboard for "AgriSure".
**Design Style:** "Soft Tech" light mode. Clean White backgrounds. Typography: Dark Grey/Green. Rounded corners.
**Components:** "Good Morning" greeting, Bright Weather Widget, Active Policy Cards with Green badges.
```

### Purchase Wizard (V3 Split)
```text
Create the "Purchase Coverage Wizard" (V3 Side-by-Side Variant) for "AgriSure".
**DESIGN SYSTEM:**
- Theme: Light Mode, Friendly, "Soft Tech".
- Background: Warm Earth (#F5F5F7).
- Primary Accent: Fresh Sprout Green (#2E7D32) <-- IMPORTANT: DARK GREEN buttons.
**Layout:** Split-screen. Left Panel (30%) fixed summary. Right Panel (70%) interactive steps.
**Left Panel:** "Live Quote" header. Large Price Tag "100 XRP" (Space Grotesk, #2E7D32).
**Right Panel:**
   - Step 1: Location (Bright map).
   - Step 2: Crop (3D illustrations).
   - Step 3: Risk (Split-slider).
   - Step 4: Action (Large "Protect My Farm" Pill Button in #2E7D32).
```

### Policy Details (Advanced Farmer)
```text
Create the "Deep Policy Analytics" screen for "AgriSure".
**DESIGN SYSTEM:**
- Theme: Light Mode, Friendly "Soft Tech".
- Background: Warm Earth (#F5F5F7).
- Accent: Fresh Sprout Green (#2E7D32) <-- STRICT DARK GREEN.
- Cards: White, Rounded-2xl.
- Typography: Inter (Body), Space Grotesk (Numbers/Headers).

**Page Structure:**
1. **Header:** Breadcrumb "< Back" + Title "Soy Field #4" + Large Solid Pill Badge "Protected" (#2E7D32).
2. **Key Metrics (Data-Rich):** 4-Column Grid.
   - **Coverage:** "50,000 XRP" (Large Space Grotesk).
   - **Probability:** "12% Chance" (Trend arrow up).
   - **Days Left:** "84 Days".
   - **Premium:** "150 XRP".
3. **Analytics Cluster (Main):**
   - **Chart (Left, 60%):** "Moisture Variance". Line chart showing "Actual" (Blue) vs "Trigger" (Red) vs "Historical Avg" (Grey dotted). High data density.
   - **Oracle Live (Right, 40%):** "Real-Time Monitor".
     - Gauge: "Current: 12mm".
     - Status: "Check in 15m".
     - Source: "NOAA-4829" (Green Dot).
4. **Contract DNA (Technical):**
   - **NFT ID:** "0008...289a" (Copy).
   - **Ledger Seq:** "#882910".
   - **Condition:** "Rain < 45mm @ Station 29".
```

### Insurer Command Center (Admin)
```text
Create the "Insurer Command Center" for "AgriSure".
**DESIGN SYSTEM:**
- Theme: Light Mode, Friendly but Professional "Soft Tech".
- Background: Warm Earth (#F5F5F7).
- Accent: Fresh Sprout Green (#2E7D32).
- Density: Higher density than Farmer view, but still clean.

**Page Structure:**
1. **Overview Cards (Top):**
   - "Total Value Locked": 1.5M XRP (Space Grotesk).
   - "Active Policies": 1,240 NFTs.
   - "Predicted Payouts": Low Risk (Green).
2. **Main Layout (Grid):**
   - **Left (Map):** Large "Risk Heatmap" showing geographic exposure.
   - **Right (Control):** "Oracle Health" monitor with "Force Trigger" button.
3. **Data Table (Bottom):** "Policy Registry".
   - Columns: Token ID (XLS-20), Farmer, Condition, Escrow Status (Pill badges).
```
