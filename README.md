# Charis Campaign Centre

**Internal customer-communications application for Charis Microfinance Bank Ltd.**

This repository contains the working Next.js application, Supabase migrations, campaign delivery code and automated tests. The bank's logo, premium purple/green styling and staff interface are included. The product is **single-company**, although some historical database structures remain for backwards compatibility.

## Start here

- [System overview](MD/SYSTEM_OVERVIEW.md) — modules and what is implemented.
- [Architecture and workflows](MD/ARCHITECTURE_AND_WORKFLOWS.md) — the application, recipient eligibility and approval flow.
- [Brand and UI](MD/DESIGN_SYSTEM.md) — Charis colors and interface principles.
- [Set up and deploy](MD/SETUP_AND_DEPLOYMENT.md) — environment variables, migrations and release steps.
- [Security and communication preferences](MD/SECURITY_AND_COMMUNICATION_PREFERENCES.md) — promotions, unsubscribes and account notices.
- [Testing and release](MD/TESTING_AND_RELEASE.md) — quality gates and changes.
- [Maintainer instructions](MD/AGENTS.md) — development conventions.

## Run locally

Node.js **24** required:

```bash
npm ci
cp .env.charis.example .env.local
npm run typecheck
npm run lint
npm test
npm run build
```

Configure `.env.local` with actual non-public Supabase and email-provider credentials; never commit secrets. On Windows, copy the example file manually or run `copy .env.charis.example .env.local`.

## Database and production

Migrations are kept in **`supabase/migrations/` (001–022)** and must be reviewed/applied sequentially on an existing database. **Do not rerun the fresh-install SQL on a database containing customers or campaigns.** This source is not a production acceptance certificate: database authorisation, staff access, approved sender, background delivery worker, suppression rules and live sending must all pass hosted tests before use.

SMS and unrestricted account-service notice sending are not implemented. Promotional sending must respect documented consent, unsubscribe preferences and independent approval. See `MD/SECURITY_AND_COMMUNICATION_PREFERENCES.md`.


SMS pilot: see [MD/SMS_AND_SENDGRID.md](MD/SMS_AND_SENDGRID.md). Apply migration 023 after 022.
