# Charis Campaign Centre

An internal staff application for **Charis Microfinance Bank** covering customer communications, email templates, authorised sending, delivery outcomes, loan follow-up workflows and staff administration.

The application is designed for one bank organisation. It is **not** a public SaaS product and is not a replacement for the bank's core banking system.

## Technology

- **Frontend / server:** Next.js 15 App Router, React 19, TypeScript
- **Data and authentication:** Supabase Auth, PostgreSQL, row-level security and permission-controlled database functions
- **Deployment:** Vercel, connected to the GitHub default branch
- **Delivery:** Provider-specific email integrations and webhook reconciliation
- **Email design:** Template Studio with saved designs and staff preview
- **Runtime:** Node.js 24

## Staff workflows

1. An authorised bank administrator invites a staff member using the **Team** module.
2. The staff member accepts the invitation and sets a personal password. The sign-in screen also supports password recovery.
3. Role and action permissions determine which sections of the application the staff member can see and use.
4. Authorised staff manage contacts, import CSV/XLSX contact records, create or reuse templates and prepare campaigns.
5. The bank's approved sender identity and message purpose determine the permitted email delivery route.
6. Staff monitor provider acknowledgements, callbacks, suppressions and exceptions from campaign history and reports.
7. Credit staff view loan accounts, create repayment follow-ups and prepare reminders after reconciling balances with bank records.

**Important:** Provider acceptance is not proof of inbox delivery. Opens and clicks, if reported, may include automated traffic and are not proof of customer conversion.

## Credit operations

Current source includes:

- An internal loan register and manual repayment updates.
- Staff follow-up tasks and private in-app notifications.
- Loan reminder preparation, review and held delivery records.
- A due-date candidate scan that can be run on a schedule **when configured and enabled**.
- A protected, individually triggered loan-service email action using the bank's permitted provider and authorisation flags.
- A **monthly loan CSV/XLSX review page** for checking references, balances, dates, missing contact details and duplicate rows.

The monthly review page is **preview-only**. It does not update loan balances or automatically send messages. There is **no live core-banking integration or production-certified fully automatic borrower delivery** in this repository. Any future bulk import must reconcile source files against approved loan accounts and record authorised changes in an auditable transaction.

## Authentication and staff account setup

- Supabase Auth remains responsible for invitation/recovery tokens and sessions.
- Charis provides branded staff-facing setup, recovery and password-change screens.
- The bank's Supabase Auth configuration must allow the official application URLs used for invitation and recovery redirects.
- Production invitations and password reset messages require an approved, authenticated sender (custom SMTP or secured email hook), configured by IT. Default Supabase email sending is **not** the bank's final branded setup.
- Every staff member uses an individual login. A product owner should never share personal credentials with bank administrators.
- Bank administrators manage allowed staff privileges. Technical service credentials are server-only.

## Development setup

Use Node.js **24** and an authorised copy of the application environment.

    npm ci
    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run test:smoke

Start a local development server with:

    npm run dev

Do not put secret credentials in the repository or expose privileged service keys through browser-prefixed environment variables.

## Operational safeguards

- Apply only **missing** database migrations after backup and staging tests; never rerun a historical installer over customer data.
- Verify role permissions at database/API level. Hiding a button alone does not provide security.
- Configure verified bank sender domains, SPF/DKIM/DMARC as applicable, rate limits and authentic provider callbacks.
- Send promotional email only where customer preferences and the chosen provider permit it. Service messages are governed separately.
- Keep bulk sending and unattended credit messages disabled until bank IT, Credit, Risk/Compliance and management sign off.
- Reconcile uncertain provider outcomes before attempting another send. Avoid duplicate customer notices.
- Validate restore procedures, privileged access and audit logs before production acceptance.

## Release verification

The GitHub **Quality checks** workflow runs lint, type checking, tests, build, smoke checks and package auditing. A successful push does **not** by itself certify production readiness. Read the latest Actions run and resolve failures before relying on the changes in the bank.

The application's actual implementation and live configuration are the technical sources of truth. Older project notes may describe earlier prototypes or features that have not been enabled, verified or deployed.

## Ownership and access

Source access, software licensing, bank data ownership, hosting responsibilities, maintenance and technical handover should be addressed under a separate written agreement. Avoid uploading real customer files, secrets or authentication tokens to this repository.
