# Aegis

Aegis is a Next.js DeFi risk monitoring dashboard. Its core workflow is simple: research a protocol, save it for monitoring, create rule-based alerts, and review triggered risk events.

## Onboarding Modes

- Guest mode (default): saved protocols are stored locally in the browser and work without wallet connection.
- Wallet-connected mode: scopes saved protocols and research history to a wallet, and unlocks alert automation endpoints when configured.
- Optional advanced tools include generated explanations, notifications, simulation, and Solana-native on-chain watchlist experiments.

## Storage Model

The production UX is off-chain first:

- Saved protocols use browser storage by default, scoped by chain/environment and wallet address when connected.
- Alert rules and events use the database when `DATABASE_URL` is configured, with local browser fallback when the database is unavailable.
- The Anchor program under `anchor/` is optional infrastructure for a Solana-native watchlist experiment.

On-chain watchlist advantages:

- Wallet-owned state can move across browsers and devices.
- State can be inspected by other Solana clients.
- It demonstrates a Solana-native persistence path for future integrations.

On-chain watchlist disadvantages:

- Users need a wallet signature and enough SOL for rent and fees.
- The program must be deployed on the selected cluster.
- RPC, cluster, and account availability can block a simple monitoring workflow.
- Public on-chain state is less private than browser/database-backed app state.

For this reason, Aegis keeps the practical monitoring workflow off-chain by default and treats on-chain storage as an advanced lab path.

## AI Usage

AI is optional and disabled by default. The primary product path uses deterministic live-data flows:

- Research briefs can be generated from DeFiLlama/CoinGecko/chain data without an AI provider.
- Alert evaluation is rule-based and does not require AI.
- Generated alert explanations are optional enrichment after an event is already triggered.

Enable AI only when you want generated prose on top of the deterministic data path.

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

Set `AEGIS_RESEARCH_AI_ENABLED=true` to allow Groq-backed research generation, and set `AEGIS_ALERT_AI_SUMMARIES_ENABLED=true` to automatically generate alert explanations after rule-based triggers.

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

The `anchor/` workspace is optional infrastructure for Solana-native watchlist experiments. The production saved-protocol UX uses browser/database-backed state first, so app setup does not require building or deploying the Anchor program.

Use these commands only when working on the on-chain watchlist path:

```shell
npm run anchor-build
npm run anchor-localnet
npm run anchor-test
```

Optional program IDs can be supplied with `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID`, or the cluster-specific `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_DEVNET`, `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_TESTNET`, and `NEXT_PUBLIC_WATCHLIST_PROGRAM_ID_MAINNET`.

## Package Managers

The app uses npm as the primary package manager and keeps `package-lock.json` as the source of truth. Bun is still used by the worker scripts and Docker Compose image, so `bun.lock` is retained for that runtime path.
