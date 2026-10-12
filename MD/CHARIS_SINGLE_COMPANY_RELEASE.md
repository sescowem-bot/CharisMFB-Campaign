# Charis Campaign Communications — Single-company release

Prepared from the uploaded `Sesco-Campaign-main(1).zip`, dated 10 October 2026.
This is a UI simplification and recipient-group extension of the EXISTING Next.js/Supabase system. It retains the prior multi-tenant database tables internally; enabling single-company mode presents Charis as the sole client workspace rather than destroying existing data or re-architecting the entire database.

## What was changed

1. `SINGLE_COMPANY_MODE=true` enables a focused Charis dashboard with shortcuts, summary counts and fewer navigation choices. Company switching, customer billing and platform-plan administration are not in the staff workflow. Staff still authenticate normally; there is no public backdoor.
2. New campaigns support *one or several individually selected customers* (up to 500 per manual selection), as well as existing *all eligible*, *saved lists* and *segments*. Searching supports names, email addresses and phone numbers. The picker returns only eligible, opted-in, non-suppressed EMAIL contacts scoped to that company.
3. Selected recipient IDs are validated again server-side, written to a private contact list and used to save the campaign **atomically** in a single RPC transaction, protecting against cross-company selection and partial saves.
4. CSV/Excel imports can create a *named group* or add to an existing list. Imports retain existing deduplication, idempotency and consent rules. Lists are available to the campaign composer after import.
5. An approved campaign now shows a direct queue-for-sending form on the campaign detail page. The existing delivery worker, provider restrictions, usage limits, unsubscribe and approval workflow remain in force. Only verified senders and consented contacts can be queued.
6. For the named single-company org, authorized dispatch staff can run a controlled **one-recipient-at-a-time** worker action in the Delivery page for acceptance testing. This is not a bulk dispatch replacement.
7. A standalone mock **pitch demo** is provided in `demo/Charis-Pitch-Demo.html`. It is presentation-only, uses fictional addresses and **does not send messages, use Supabase or save campaigns**.

## Deployment to an EXISTING database (do not drop your data)

- Back up the current database and deployed source first. Verify that migrations `001` through `014` are already installed; do not repeat completed migrations blindly.
- Apply **only** `supabase/migrations/015_charis_simplified_campaigns.sql` using your project's Supabase SQL Editor. It adds three guarded SQL functions, without deleting any earlier company or customer data.
- Copy `.env.charis.example` to `.env.local` for development, or set the same names as server environment variables in Vercel.
- Set `SINGLE_COMPANY_MODE=true` and `SINGLE_COMPANY_ORG_ID` to Charis's existing active organization UUID (from the `organizations` table). **Do not use the owner/SESCO demo workspace ID.**
- Confirm that the staff account is an authorized member of the Charis organization: company_admin or manager to manage recipients; designer can edit campaign drafts but cannot search private customer data. Company review uses the existing approver/company_admin permission rules.
- Set existing Supabase public/project URLs and anon key, and retain service-role key as server-only, never as `NEXT_PUBLIC_...`.
- Set up a verified domain/sender and enabled Resend or Brevo provider. Configure the delivery worker and independent request secret. Leave `EMAIL_DELIVERY_ENABLED=false` until your test plan has been accepted.
- Install under **Node 24**: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:smoke` (production build prerequisites may require the full original environment and service credentials). Deploy only after the checks succeed.
- After verified sender, correct audience, delivery quotas, worker, bounce/webhook and production policies are confirmed, deliberately turn on `EMAIL_DELIVERY_ENABLED=true`. Reconfirm workspace ID and test with authorized internal test addresses first.

> The global settings/plan pages are still present for maintainers in the source, but are removed from the single-company daily sidebar; database access controls remain enforced. Do not rebrand the entire platform or run its multi-company provisioning flow for each staff member. Assign staff to the ONE Charis organization.

## Acceptance walkthrough for the pitch

1. Open the standalone demo and select **New campaign**. Check a single mock contact, submit the simulated queue, then open **Reports**. No email is actually sent.
2. Return to campaign creation, select 2–3 mock people, then use **Select all shown** and **All eligible**.
3. Open **Import contacts**, download the sample CSV, upload it under a group name and inspect it in the **Customer directory**. New imported records remain ineligible pending consent review.
4. Select a saved group in the campaign composer, enter a subject and message, and check the live personalization preview.
5. In the real connected app, repeat using dedicated internal test addresses with documented permission, review and approve a saved campaign, queue it and watch provider status. No production send is accepted based solely on offline demo success.

## What still needs live acceptance (NOT tested in this artifact environment)

- Supabase migration execution against the actual project and RLS/RPC behavior with real company and role accounts.
- Auth, React hydration, deployed Next.js Node 24 build, custom sender/DNS verification, webhook, worker and actual email delivery.
- Consent evidence imported from a real approved bank source. Existing import deliberately stores new contacts with *unknown* email consent; those are not automatically sendable.
- Audit-log, backup, unsubscribe/suppression and rate-limit verification at production volume.

**Channel scope:** this build implements EMAIL delivery using existing providers. It stores phone numbers and can search on phone, but **does not actually send SMS or WhatsApp**. Those channels require separate verified providers, costs, consent handling and delivery/reporting integrations. Do not promise them in the pitch as already operational.

## Test status in this environment

- PASS: Existing CSV/contact-related test subset — 12/12 (`node --test tests/csv-parser.test.mjs tests/project-structure.test.mjs`).
- PASS: All changed TS/TSX files parsed with TypeScript parser.
- PASS: Standalone HTML demo clicked through in headless Chromium for one recipient, reports, CSV import, all eligible contacts and mobile width; no JavaScript errors.
- NOT RUN: Complete `npm ci`, full TypeScript typecheck, ESLint, Next.js production build or live dispatch because the container has Node 22, while package `engines` specifies Node 24 and not all dependencies were cached.

## Pitch positioning

"Charis Communications gives our team a simpler way to manage customer campaigns in one place. Staff can upload customer contacts, group them, send personalized email updates to one customer or an approved audience, and track delivery results. The workflow is easier to understand without removing authorization, approvals or delivery safeguards. The live channel requires final provider and compliance acceptance before bank-wide rollout."
