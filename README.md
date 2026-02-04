# AgriSure

**Insurance That Pays Automatically.**
AgriSure is a decentralized agricultural insurance platform built on the XRPL blockchain. It uses parametric triggers and real-time weather oracles to provide instant liquidity to farmers, removing claims, disputes, and delays.

## Core Features
*   **Data-Driven Triggers:** Policies activated by objective NOAA/NASA weather data.
*   **Instant Payouts:** Smart contracts on XRPL Escrow release funds immediately.
*   **Total Transparency:** Audited on-chain logic ensures guaranteed liquidity.

## Design System
*   **Theme:** Premium Startup Aesthetic (Dark Mode, Deep Forest Void, Neon Cyber Lime).
*   **Documentation:**
    *   [design.md](./design.md): Full semantic design system and Stitch prompts.
    *   [site.md](./site.md): Complete functional specification for the site and app.

## Agent Skills & Workflows
This project is equipped with specialized AI agent skills and workflows to accelerate development.

### Skills (`.agents/skills`)
Usage: These are "folders of instructions" the agent can use to perform complex tasks. 

| Skill Name | Description | When to Use |
| :--- | :--- | :--- |
| **design-md** | Analyzes Stitch projects to create a `DESIGN.md` system. | Use when you want to reverse-engineer a Stitch design into a reusable design system document. |
| **enhance-prompt** | Optimizes text prompts for better generation. | Use when your initial prompts aren't yielding high-quality results. |
| **react-components** | Generates React components. | Use when converting a design into functional React code. |
| **remotion** | Creates programmatic videos. | Use when generating video content or animations via code. |
| **shadcn-ui** | Integrates Shadcn UI components. | Use when building UI with the Shadcn library. |
| **stitch-loop** | Iterative design generation loop. | Use when refining designs through multiple feedback cycles. |

### Workflows (`.agent/workflows`)
Usage: These are step-by-step guides for specific technical implementations.

| Workflow Name | Description | When to Use |
| :--- | :--- | :--- |
| **nextauth-js** | Sets up NextAuth.js authentication. | Use when implementing user authentication (OAuth, Email, Credentials). |
| **supabase-rls** | Configures Supabase Row Level Security. | Use when setting up database permissions and security rules. |

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
