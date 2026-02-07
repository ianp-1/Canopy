# Troubleshooting Guide

Common issues and solutions for Canopy developers.

## 🔐 Authentication Issues

### "Redirect to localhost:3000 implies a misconfiguration"
- **Cause:** Supabase Auth URL configuration mismatch.
- **Fix:** Ensure `NEXT_PUBLIC_APP_URL` in `.env` matches your Supabase Project -> Authentication -> URL Configuration -> Site URL and Redirect URLs.

### "User role not updating"
- **Cause:** Sync issue between Supabase Auth and Prisma `User` table.
- **Fix:** Check the `User` table in Prisma Studio (`npx prisma studio`). The `role` field works independently of Supabase metadata. Ensure your Server Actions are updating the Prisma record.

## ⛓️ XRPL & Wallet Issues

### "Account not found" on Testnet
- **Cause:** XRPL Testnet accounts get reset or the seed is invalid.
- **Fix:** Generate a new funded wallet using [XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html) and update `.env`.

### "Escrow creation failed"
- **Cause:** Insufficient balance or previous sequence mismatch.
- **Fix:** Ensure the Insurer wallet has at least 2020 XRP (2000 for escrow + 20 for reserve/fees).

## 🗄️ Database

### "Schema drift detected"
- **Cause:** Changes made directly to the DB without migration.
- **Fix:** Run `pnpm prisma migrate dev` to realign your local schema with the database.

### "Connection terminated"
- **Cause:** Connection pooling issues with Supabase Transaction mode.
- **Fix:** For migrations, use the `DIRECT_URL` (Session mode, port 5432). For the app, use `DATABASE_URL` (Transaction mode, port 6543).
