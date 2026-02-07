# CMU TartanHacks 2026: Agricultural Insurance on XRPL

## 1. Project Overview
**Concept**: Parametric agricultural insurance using blockchain smart contracts to automate payouts based on objective weather data.
**Problem**: Traditional insurance for small farmers is slow (months), and payouts are often disputed.
**Solution**: 
- **Trigger**: Objective data (weather, soil moisture) via "Oracles".
- **Execution**: Automated XRPL Escrow Release.
- **Verification**: Future plans for drone/satellite verification.

### Tracks
- **Polychrome Mosaic**: 2+ fields (Agriculture + FinTech).
- **Community Mural**: Product for societal impact.
- **Ripple**: RL (XRP Ledger) integration.

### References
- [Hackathon Docs](https://docs.google.com/document/d/1RLg7SqXPuZhxk_aycPPn9UffR3fPlr0O68XuokCfWKQ/edit?tab=t.0)
- [XRPL Escrow Docs](https://xrpl.org/docs/concepts/payment-types/escrow)
- [Inspiration (Charity)](https://devpost.com/software/give-xrp-charitable-donation-xapp?utm_source=chatgpt.com)

---

## 2. User Flow & Core Logic
### The Workflow
1.  **Deposit**: Insurer deposits funds into an **XRPL Escrow** (locked on-chain).
    *   Condition: Specific location, time window, weather threshold.
2.  **Purchase**: Farmer buys a **Policy** (Tokenized/NFT).
    *   Metadata: Region, coverage amount, trigger condition, payout wallet.
3.  **Monitor**: **Oracle** (External Data Source) continuously monitors real-world data (rainfall, temp, soil).
4.  **Trigger**: If data exceeds/drops below threshold (e.g., rainfall < X cm):
    *   Oracle signs the data/decision.
    *   Oracle submits `EscrowFinish` transaction (fulfilling the cryptographic condition).
5.  **Payout**: Funds are automatically released directly to the Farmer's wallet.

### Users
- **Insurers**: Sell policies (Tokens/NFTs), provide liquidity pool.
- **Farmers**: Buy policies for full coverage or pool participation.

---

## 3. Technical Stack & Data Sources

### Technology Stack
- **Frontend**: Next.js (App Router), Tailwind CSS.
- **Auth**: NextAuth.js (Wallet-based Authentication).
- **Database**: Supabase, Prisma.
- **Deployment**: Vercel.
- **Blockchain**: XRPL.js, Xaman SDK (Wallet).
- **Intelligence Layer**: Python (FastAPI).

### Data Oracles (APIs)
- **Weather**: [Open-Meteo](https://open-meteo.com/) (Rainfall, Drought).
- **Soil Moisture**: Open-Meteo, NASA POWER.
- **Vegetation (NDVI)**: *No APIs found yet (Research Required).*
- **Disaster (Flood/Tornado)**: xWeather.
- **IoT (Optional)**: Proxies for rain gauges/soil probes (mocked via regional aggregates for fraud prevention).

### System Architecture Layers
| Layer | Responsibility | Technology |
| :--- | :--- | :--- |
| **Frontend** | User Interface, Wallet Signing | Next.js (App Router), Xaman SDK |
| **Blockchain Bridge** | `EscrowCreate`, `NFTokenMint`, `EscrowFinish` | Next.js Server Actions (Node.js + xrpl.js) |
| **Intelligence** | ML Models, Loss Probability, Data Fusion | FastAPI (Python) |
| **Data Orchestrator** | Oracle Cron Jobs, DB Sync | Next.js API Routes |

---

## 4. AI & Data Intelligence (The "Smart" Oracle)
**Goal**: Move beyond simple linear thresholds to a **Multi-Source Loss Probability Index**.

### Data Fusion Pipeline
1.  **Input (Data Pipeline)**:
    *   Fetch hourly data: Precipitation, Soil Moisture, Evapotranspiration (Open-Meteo).
    *   Fetch visual data: Satellite Imagery (if available) for NDVI.
2.  **Processing (Inference Engine via FastAPI)**:
    *   **XGBoost/Random Forest**: Calculates "Smart Index" (Heat + Lack of Rain correlation to crop failure).
    *   **Computer Vision (ResNet-50/ViT)**: Analyzes NDVI for physical crop stress.
    *   **LSTM**: Time-series prediction for drought persistence.
3.  **Output (Payout Decision)**:
    *   Generates **Consensus Score** (0.0 - 1.0).
    *   **Trigger Logic**:
        *   Score > **0.85**: High confidence -> Trigger Payout (`true`).
        *   Score < **0.85**: No Payout (Reduces basis risk).
    *   *Parametric Scaling*: Score can map to partial payouts (e.g., 0.5 score = 50% payout).
4.  **Action (Blockchain Execution)**:
    *   Oracle receives `true` signal.
    *   Logs "Consensus Score" and evidence hash on-chain (`OracleSet`).
    *   Executes `EscrowFinish` with secret fulfillment key.

---

## 5. Development Plan

### 🏗️ Phase 1: Environment & Database Setup
**Goal**: Establish "Source of Truth" & XRPL Connection.
- [ ] Initialize Next.js (App Router + Tailwind).
- [ ] Setup Supabase & Prisma (`npx prisma init`).
- [ ] Define Schemas: `User`, `Policy`, `WeatherLog`.
- [ ] Generate XRPL Testnet Accounts:
    -   **Insurer (Issuer)**
    -   **Oracle Signer**

### 🏦 Phase 2: Tokenization, Auth & Escrow Logic
**Goal**: XRPL Native Feature Implementation & Security.
- [ ] **Authentication**: Implement "Login with Wallet" using Xaman & NextAuth.js.
- [ ] **Policy Minting**: Server action to mint **XLS-20 NFT** with policy metadata.
- [ ] **Escrow Logic**: Function to create `EscrowCreate` transaction with SHA-256 condition.
- [ ] **Payments**: Integrate Xaman SDK for user signing ("Buy Policy").

### 🌤️ Phase 3: The Oracle & Automation
**Goal**: Bridge Real-World Data.
- [ ] **API Route**: `/api/oracle/check`.
- [ ] **Logic**: Query active policies -> Fetch Weather/ML Score -> Compare.
- [ ] **Trigger**: If condition met -> Backend generates `EscrowFinish`.
- [ ] **Automation**: Cron Job (Vercel Cron) to ping Oracle route daily.

### 📱 Phase 4: Frontend Development
**Goal**: User Interface.
- [ ] **Marketplace**: Browse and configure insurance policies.
- [ ] **Farmer Dashboard**: View "My Policies", Live Weather Widget (Distance to Payout).
- [ ] **Insurer Dashboard**: Liquidity Pool TVL, Active Risk Map.
- [ ] **History**: Released vs. Expired Escrows.

---

## 6. Team Roles

### Person 1: Blockchain & Smart Contract Engineer ("Ledger Lead")
- **Focus**: XRPL Transaction Logic & Security.
- **Tasks**:
    - XRPL Testnet Setup.
    - `EscrowCreate` & `EscrowFinish` scripts.
    - NFT Minting (XLS-20) for policies.
    - Oracle Signer backend logic.

### Person 2: Backend & Integration Engineer ("Bridge Lead")
- **Focus**: Database, API, Wallet.
- **Tasks**:
    - Supabase/Prisma Schema.
    - Xaman SDK Payload logic (QR Code generation).
    - Automation Engine (`/api/oracle/check`).
    - OpenWeather API Integration.

### Person 3: Frontend & UI/UX Engineer ("Experience Lead")
- **Focus**: UI, Dashboards, Feedback.
- **Tasks**:
    - Marketplace & Configuration Forms.
    - Farmer Dashboard (Policies + Weather Widget).
    - Insurer Dashboard (Liquidity + Risk Map).
    - Loading States & Transaction Notifications.

---

## 7. Reproducibility Checklist
- [ ] `.env.example`: `DATABASE_URL`, `XRP_SEED`, `OPENWEATHER_API_KEY`, `XAMM_API_KEY`.
- [ ] `README.md`: Install instructions (`npm install`, `npx prisma generate`).
- [ ] `seed.ts`: Script to populate dummy policies for testing.
