# Aegis

Aegis is a Next.js Solana DeFi research workspace. It combines a watchlist, live protocol briefs, alert rules, and war-room simulations in one app.

## Onboarding Modes

- Guest mode (default): watchlist is stored locally in the browser and works without wallet connection.
- Wallet-connected mode: unlocks wallet-linked research history and alert automation endpoints.
- Optional on-chain watchlist setup remains available for advanced Solana-native flows.

## Setup

Install dependencies:

```shell
npm install
```

Create a `.env.local` file with:

```shell
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
AEGIS_AUTH_SECRET=long_random_auth_secret
AEGIS_ENCRYPTION_KEY=long_random_encryption_secret
AEGIS_REQUIRE_WALLET_AUTH=true
AEGIS_RESEARCH_AI_ENABLED=false
AEGIS_ALERT_AI_SUMMARIES_ENABLED=false
GROQ_API_KEY=your_optional_groq_key
```

`DATABASE_URL` enables persistent research history and alert rules/events. If you use Vercel Postgres, you can point it at `POSTGRES_PRISMA_URL`.

`AEGIS_REQUIRE_WALLET_AUTH=true` enforces signed-wallet sessions for wallet-scoped API routes. `AEGIS_ENCRYPTION_KEY` encrypts newly saved notification channel secrets while still allowing older plaintext configs to be read.

AI is optional. By default, research briefs and alert checks use deterministic live-data fallbacks. Set `AEGIS_RESEARCH_AI_ENABLED=true` to allow Groq-backed research generation, and set `AEGIS_ALERT_AI_SUMMARIES_ENABLED=true` to automatically generate alert explanations after rule-based triggers.

Email alert delivery has been removed in this branch; alerts still create events but delivery is disabled.

## Database

After setting `DATABASE_URL`, generate the Prisma client and apply migrations:

```shell
npm run prisma:generate
npm run prisma:migrate -- --name init_history_alerts
```

For production deploys, use:

```shell
npm run prisma:migrate:deploy
```

## Commands

```shell
npm run dev
npm run build
npm run lint
npm run format
```

## Anchor Program

The `anchor/` workspace is optional infrastructure for Solana-native watchlist experiments. The production watchlist UX uses browser/database-backed state first, so app setup does not require building or deploying the Anchor program.

Use these commands only when working on the on-chain watchlist path:

```shell
npm run anchor-build
npm run anchor-localnet
npm run anchor-test
```

Optional program IDs can be supplied with `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID`, or the cluster-specific `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_DEVNET`, `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_TESTNET`, and `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_MAINNET`.

## Package Managers

The app uses npm as the primary package manager and keeps `package-lock.json` as the source of truth. Bun is still used by the worker scripts and Docker Compose image, so `bun.lock` is retained for that runtime path.
