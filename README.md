# Charis MFB Campaign Centre

Single-organisation email campaign system for Charis Microfinance Bank. Built on the Sesco campaign engine
(Next.js 15, React 19, TypeScript, Supabase Postgres + Auth with row-level security, Resend/Brevo delivery).

Version **0.15.0**. Source complete for single-system mode; live acceptance is still outstanding.
No live sends, payments or deployment have been performed.

## Start here

- **[MD/CHARIS_GO_LIVE.md](MD/CHARIS_GO_LIVE.md)** — install, roles, scheduling, capacity, go-live checklist.
- [MD/DEPLOYMENT_RUNBOOK.md](MD/DEPLOYMENT_RUNBOOK.md), [MD/BACKUP_RECOVERY.md](MD/BACKUP_RECOVERY.md), [MD/LIVE_ACCEPTANCE.md](MD/LIVE_ACCEPTANCE.md), [MD/ADMIN_CAMPAIGN_TESTING.md](MD/ADMIN_CAMPAIGN_TESTING.md).
- Earlier batch notes are kept in `MD/archive` for history; current documents take precedence.

## Quick start

```bash
nvm use 24            # Node 24 is required
cp .env.example .env.local
npm ci
npm run dev
```

Database: run `supabase/SESCO_Complete_Fresh_Install.sql` once, then `supabase/seed_charis.sql`.
Existing database at migration 014: run only `supabase/migrations/015_single_system.sql`.

## Modes

`APP_MODE=single` (default) is the Charis deployment: invite-only, no public site, billing or company switching,
maker-checker approval. `APP_MODE=multi` restores the original multi-company surface; the schema is the same.

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke`, `npm audit --omit=dev`.
CI runs the same gates on Node 24.
