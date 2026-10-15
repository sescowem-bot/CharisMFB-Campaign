# Charis Campaign Centre

**Internal customer-communications application for Charis Microfinance Bank Ltd.**

This repository contains the working Next.js application, Supabase migrations, campaign delivery code and automated tests. The bank's logo, premium purple/green styling and staff interface are included. The product is **single-company**, although some historical database structures remain for backwards compatibility.

## Latest continuation

Batch 4 credit reminders and held delivery staging: see [MD/CHARIS_BATCH_4_032_CREDIT_REMINDERS.md](MD/CHARIS_BATCH_4_032_CREDIT_REMINDERS.md). This complete source archive contains the earlier Batch 1–3 modules plus migrations through **032**. Apply only missing migrations in order, after backup and staging verification. This source is not a live-deployment certificate.

## Start here

- [System overview](MD/SYSTEM_OVERVIEW.md) — modules and what is implemented.
- [Architecture and workflows](MD/ARCHITECTURE_AND_WORKFLOWS.md) — the application, recipient eligibility and approval flow.
- [Brand and UI](MD/DESIGN_SYSTEM.md) — Charis colors and interface principles.
- [Set up and deploy](MD/SETUP_AND_DEPLOYMENT.md) — environment variables, migrations and release steps.
- [Security and communication preferences](MD/SECURITY_AND_COMMUNICATION_PREFERENCES.md) — promotions, unsubscribes and account notices.
- [Testing and release](MD/TESTING_AND_RELEASE.md) — quality gates and changes.
- [Email provider routing](MD/EMAIL_DELIVERY_ROUTING.md) — migration 025, credentials, provider policy, queue and webhooks.
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

Migrations are kept in **`supabase/migrations/` (001–032)** and must be reviewed/applied sequentially on an existing database. **Do not rerun the fresh-install SQL on a database containing customers or campaigns.** This source is not a production acceptance certificate: database authorisation, staff access, approved sender, background delivery worker, suppression rules and live sending must all pass hosted tests before use.

SMS pilot is implemented for controlled staff tests; live account-service broadcasts are not implemented. Promotional sending must respect documented consent, unsubscribe preferences and independent approval. See `MD/SECURITY_AND_COMMUNICATION_PREFERENCES.md`.


SMS pilot: see [MD/SMS_AND_SENDGRID.md](MD/SMS_AND_SENDGRID.md). Apply migration 023 after 022.

Provider-aware email delivery: migration 025 is required before using the new worker. Both live sending gates default to **off**. Read [MD/EMAIL_DELIVERY_ROUTING.md](MD/EMAIL_DELIVERY_ROUTING.md) before any customer sending.


## Department workspaces and visual templates

See `MD/DEPARTMENTS_AND_REMINDERS.md` for Migration 026, internal reminders, department access and bank-approved image/shape email design.


## Batch 3 continuation (SQL 031)

This source archive adds the Loan Register and a separate **account-service notice draft and review** workflow. Install only missing migrations in sequence, with `031_charis_loan_register.sql` after 030. This batch does not send loan or account notices. Read [Batch 3 rollout and permissions](MD/CHARIS_BATCH_3_031_COMMUNICATIONS_AND_LOANS.md) before using.


## Batch 4 continuation (SQL 032)

Credit Reminder Centre now prepares authorised loan reminder drafts, enforces independent or expressly delegated review, and stages approved batches as **HELD ONLY** delivery records. No Batch 4 worker dispatches these records. Use the [Batch 4 release and operations notes](MD/CHARIS_BATCH_4_032_CREDIT_REMINDERS.md) before staging.


## Batch 5 — internal follow-ups and staff notifications (Migration 033)

Migration `033_charis_credit_followups_notifications.sql` adds scoped loan-linked staff follow-ups and a private in-app notification inbox. The source also improves the customer workspace filters. See `MD/CHARIS_BATCH_5_033_FOLLOWUPS_AND_CUSTOMER_FILTERS.md`. Customer messages are **not** sent by this module. Run Migration 033 only after the corrected 032 is already installed. For a read-only database check, run `supabase/verification/033_charis_credit_followups_verify.sql`.


## Batch 6 — Operational insights and audit (Migration 034)

See [`MD/CHARIS_BATCH_6_034_OPERATIONS_REPORTING.md`](MD/CHARIS_BATCH_6_034_OPERATIONS_REPORTING.md) for permission-scoped credit oversight, auditing and installation. Migration 033 is required before applying 034. These reports do not activate customer email or SMS.

## Final source hardening (035 — no database migration)

See [`MD/CHARIS_FINAL_RELEASE_HARDENING_035.md`](MD/CHARIS_FINAL_RELEASE_HARDENING_035.md) for the scoped sender-test and provider-admin safeguards, Node 24 quality gates, and release-readiness verification. This release requires **no new SQL migration**. Confirm whether migrations 033–034 were previously applied; do not repeat them without checking. Live customer sending remains disabled pending acceptance.
