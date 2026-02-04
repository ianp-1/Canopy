CMU HACKATHON – TARTANHACKS 2026
https://docs.google.com/document/d/1RLg7SqXPuZhxk_aycPPn9UffR3fPlr0O68XuokCfWKQ/edit?tab=t.0 

Tracks
Polychrome Mosaic: 2+ fields
Community Mural: product/business for societal impact
Ripple: XRP

https://xrpl.org/docs/concepts/payment-types/escrow 


charity idea: https://devpost.com/software/give-xrp-charitable-donation-xapp?utm_source=chatgpt.com 

Ideation

Idea
agriculture insurance using blockchain contracts
problem: small farmers traditional insurance takes months, payouts are disputed by humans
claim trigger is objective data like weather etc (“parametric insurance”)
future plans: drones for verification palantir style with computer vision

Flow
insurer deposits funds in XRPL escrow (tied to location, time window, weather threshold) which are locked on-chain
farmers buy policies (tokenized insurance policy) which can be NFT or fungible token if pooling to many farmers
contains metadata – region, coverage amount, trigger condition, payout wallet
digital insurance contract on-chain
“oracle” (external data source) monitors real world data like rainfall, temperature, soil moisture; periodically submits signed data to XRPL
XRPL escrow automatic claim execution (releases funds) when oracle reports stuff (like rainfall < threshold during coverage period)
payment goes directly to farmer’s wallet
logic: oracle reads data → decides if condition is met → submits to EescrowFinish (oracles authorize escrow execution, not store raw data on-chain)
Users
insurance companies sell tokens etc which are policies
farmers buy policies for full payout or buy into a pool for escrow proportional pay

Oracle data tracked (* this is more than we need so choose a few)
rainfall/drought, weather – OpenWeather, NOAA, NASA 
soil moisture from satellites – NASA SMAP, ESA Corpernicus
vegetation health (NDVI)
flood detection
physical IoT sensors: rain gauges, soil moisture probes, temperature sensors
economic & market signals: commodity price feeds, government ag indices, fertilizer prices, fuel costs (!!! farmer income stabilization, not just disaster relief)
Fraud protection (fraudulent oracle system data that forces claim execution)
farmers may tamper with IoT sensors → use regional aggregated data instead of single local sensors
fake API calls (someone submits fake weather data pretending to be the oracle) → oracle transactions must be cryptographically signed, XRPL only accepts updated from pre-approved oracle wallet (hardcoded)
oracle data must contain timestamp, policy ID, location, etc to defend against reusing old drought data etc.

Hackathon presentation plan
buy insurance plan, show it on blockchain or whatever
manipulate data to make all crops die
show wallet insurance money paid out


Development

Stack
stack: nextjs, tailwind
db: supabase, prisma
deploy: vercel
Apis: OpenWeather API, NOAA Api, https://open-meteo.com/
other: XRP js
Features: * Escrow: EscrowCreate and EscrowFinish for trustless payouts.
NFTs (XLS-20): NFTokenMint to represent the insurance policy.
Testnet: XRPL Testnet Faucet for free XRP to test your smart logic.
Xaman SDK for wallets 


Development plan:
🏗️ Phase 1: Environment & Database Setup
Goal: Set up the "source of truth" and the connection to the XRPL Testnet.
Initialize Next.js: Create the project using npx create-next-app@latest with Tailwind CSS and App Router.
Supabase & Prisma: * Create a project on Supabase.
Initialize Prisma: npx prisma init.
Define the User, Policy, and WeatherLog models in schema.prisma.
Run npx prisma migrate dev to push your schema to Supabase.
XRPL Testnet Accounts: * Go to the XRPL Testnet Faucet.
Generate two credentials: Insurance Issuer (the pool) and Oracle Signer (the automated account that triggers payouts).

🏦 Phase 2: Tokenization & Escrow Logic
Goal: Implement the "Smart" part of the insurance using XRPL native features.
Policy Minting (NFTs): Write a server action using xrpl.js to mint an XLS-20 NFToken. The metadata should include the farmer's coordinates and the payout threshold.
Escrow Creation: * Create a function that takes the insurance premium and creates an EscrowCreate transaction.
Crucial: Set a Condition (a SHA-256 hash). The escrow can only be finished if the Oracle provides the matching "fulfillment" (the secret key).
Xaman Integration: Set up the Xaman SDK so when a user clicks "Buy Policy," a payload is sent to their phone to sign the transaction.

🌤️ Phase 3: The Oracle & Automation
Goal: Bridge real-world weather data to the blockchain.
OpenWeather Integration: Create a Next.js API route (/api/oracle/check) that:
Queries all ACTIVE policies from Supabase.
Fetches current rainfall/temp data from the OpenWeather API.
The Trigger Logic: * If the weather condition is met, the backend generates the EscrowFinish transaction.
The Oracle Signer account signs this transaction, providing the fulfillment to unlock the funds.
Cron Job: Use Vercel Cron or GitHub Actions to ping your /api/oracle/check route every 24 hours.

📱 Phase 4: Frontend Development
Goal: A clean UI for farmers to manage their risk.
Dashboard: Display the farmer's active NFTs (policies).
Real-time Stats: Show a weather widget using the OpenWeather data so the farmer can see how close they are to a payout.
History: A table showing "Released Escrows" vs. "Expired Escrows" (funds returned to the pool).

🛠️ Reproducibility Checklist
To make this easy for others to clone, your repository should include:
.env.example: List all necessary keys (DATABASE_URL, XRP_SEED, OPENWEATHER_API_KEY, XAMM_API_KEY).
README.md: Clear instructions on running npm install and npx prisma generate.
Seed Script: A seed.ts file that populates the database with some dummy "Active Policies" for testing.

