# Contributing to Canopy

Welcome to the Canopy project! This guide will help you set up your development environment and understand the project structure.

## 🛠️ Technology Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS
- **Authentication**: Supabase Auth (Email + Xaman Wallet Support)
- **Database**: PostgreSQL (via Supabase), Prisma ORM
- **Blockchain**: XRPL Ledger (Testnet), `xrpl.js`
- **Wallet Integration**: Xaman (Xumm) SDK

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended)
- Docker (optional, if you want local DB)
- Git

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-org/canopy.git
    cd canopy
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Environment Setup:**
    Duplicate `.env.example` to `.env` and fill in the required variables (Supabase, XRPL seeds, Xumm credentials).
    ```bash
    cp .env.example .env
    ```

4.  **Database Setup:**
    Sync the Prisma schema with your database.
    ```bash
    pnpm prisma migrate dev
    ```

5.  **Run the Development Server:**
    ```bash
    pnpm dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📂 Project Structure

```
src/
├── app/                # Next.js App Router pages and API routes
│   ├── actions/        # Server Actions (Backend Logic)
│   ├── admin/          # System Admin Portal
│   ├── dashboard/      # Farmer Dashboard
│   └── ...
├── components/         # Reusable React components
├── lib/                # Utilities and Libraries
│   ├── xrpl/           # XRPL interaction logic (Escrow, NFT)
│   └── ...
└── prisma/             # Database schema and migrations
```

## 🧪 Testing

- **XRPL Verification Scripts:**
  located in `scripts/`. Use `tsx` to run them.
  ```bash
  npx tsx scripts/verify-phase1.ts
  ```

## 📝 Code Style

- We use TypeScript for type safety.
- Follow the "Soft Tech" design system (see `design.md`).
- Use Server Actions for data mutations.

Thank you for contributing!
