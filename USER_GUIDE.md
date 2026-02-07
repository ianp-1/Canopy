# Canopy User Guide

How to use the Canopy platform to protect your farm or manage insurance pools.

## 👨‍🌾 For Farmers

### 1. Account Setup

- **Sign Up:** Create an account using your email or Google.
- **Connect Wallet:** Go to **Settings > Wallet** and scan the QR code with your **Xaman (Xumm)** app to link your XRPL wallet. This is required to receive payouts.

### 2. Buying Coverage

1. Navigate to the **"Protect My Farm"** wizard.
2. **Select Crop:** Choose between Corn, Wheat, or Soy.
3. **Set Location:** Pin your field on the map.
4. **Confirm & Pay:**
    - Scan the payment QR code with Xaman.
    - Approve the specific XRP amount (Premium).
5. **Confirmation:** Once payment is confirmed on the blockchain, you will receive:
    - A digital **Policy NFT**.
    - A link to your transparent **XRPL Escrow** (where your payout funds are locked).

### 3. Claims & Payouts

- **Automatic Trigger:** You do NOT need to file a claim.
- **Monitoring:** Check your Dashboard to see live risk analysis tracking against your policy.
- **Payout:** If our AI Oracle detects a high-severity event (e.g., severe drought severity > 50%), the smart contract is automatically triggered, and funds are **instantly released** to your wallet.

---

## 💼 For Insurers (Admins)

### 1. Monitoring Liquidity

- Access the **Insurer Dashboard** to view Total Value Locked (TVL).
- Ensure the Liquidity Pool wallet remains funded to support new policies.

### 2. Policy Oversight

- View all active policies in the **Policy Registry**.
- Monitor Oracle health checks to ensure weather data is being signed and submitted correctly.

### 3. User Management (System Admins)

- Go to `/admin/users` to approve new Insurers or Admins.
- Manage access control for platform staff.

---

## 🤖 AI Assistant ("The Guardian")

Canopy features an integrated AI agent called "The Guardian" to help you navigate the platform and assess risk.

### 1. Chat with the Guardian

- Click the chat bubble icon in the bottom right corner.
- **Ask about policies:** "How does the parametric trigger work for corn?"
- **Ask about risk:** "What is the drought risk for my farm in Iowa?"

### 2. Land Verification

- The Agent can verify if a specific location is classified as farmland using OpenStreetMap data.
- Simply ask: "Check if coordinates 40.0, -80.0 are farmland."
- This is useful before purchasing a policy to ensure your land qualifies.

### 3. Real-time Weather & Risk

- The Agent has access to live tools.
- Ask: "What is the 7-day weather forecast for my field?" and it will pull data from Open-Meteo.
