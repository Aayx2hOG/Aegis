# Aegis

Aegis is a Next.js Solana DeFi research workspace. It combines a watchlist, live protocol briefs, alert rules, and war-room simulations in one app.

## Setup

Install dependencies:

```shell
pnpm install
```

Create a `.env.local` file with:

```shell
GROQ_API_KEY=your_groq_key
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
```

`DATABASE_URL` enables persistent research history and alert rules/events. If you use Vercel Postgres, you can point it at `POSTGRES_PRISMA_URL`.

## Database

After setting `DATABASE_URL`, generate the Prisma client and apply migrations:

```shell
pnpm prisma:generate
pnpm prisma:migrate --name init_history_alerts
```

For production deploys, use:

```shell
pnpm prisma:migrate:deploy
```

## Commands

```shell
pnpm dev
pnpm build
pnpm lint
pnpm format
```

## Anchor Program

The `anchor/` workspace contains the Solana program and generated client used by the app's on-chain watchlist flow.

```shell
pnpm anchor-build
pnpm anchor-localnet
pnpm anchor-test
```
