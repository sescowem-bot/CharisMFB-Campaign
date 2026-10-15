# System overview

## Purpose
Charis Campaign Centre is a dedicated internal customer-communications workspace for Charis Microfinance Bank Ltd, with one bank organization. It is **not** a general SaaS subscription platform. Existing historical multi-tenant SQL is preserved only where migrations and operations still depend on it.

## Application modules

| Module | Current capability |
|---|---|
| Staff authentication | Supabase sign-in, sign-out, password setup, protected routes |
| Roles and team | Bank-only Administration Centre, delegated permissions, custom role templates and staff invitations (Migration 027, staging validation required) |
| Customers | Search, individual editing, consent history, archive/restore and guarded bulk actions |
| Import | CSV/XLSX, four primary fields, up to 12 extra mapped fields, duplicate and invalid row review from migration 022 onward |
| Groups | Manually saved contact lists and rule-based smart groups |
| Campaign editor | Recipient selection, customer-detail insertion, reusable templates, designs, live preview and test emails |
| Approvals | Submit, independent review, approve/reject, revision history and audit protection |
| Sender | Existing authorised and verified Resend sender identities, dynamic display name and reply-to |
| Delivery | Approved-queue workflow, secure external worker, provider results/webhooks, suppression and reporting |
| Branding | Bank logo/favicon, colors, safe media uploads and email footer |
| Departments | Administrator-created departments, archived/active status and assigned staff; Migration 026 previously seeded 11, Migration 027 adds self-service management |
| Reminders | Internal staff tasks (Migration 026). Borrower repayment reminders are planned separately and are NOT live. |
| Preferences | Promotional unsubscribes, declined/unconfirmed marketing permission and delivery blocks |

## Out of scope / not yet established
- SMS exists only as an authorised-staff pilot (Migration 023), without live customer broadcasting.
- Account-service, security and regulatory broadcast messages require a separately authorised workflow; do not treat them as marketing sends or bypass opt-outs.
- A fully working production send and background worker require hosted configuration and acceptance testing.

## Main directories
- `app/` — Next.js routes and server actions.
- `components/` — reusable UI and campaign workflow controls.
- `lib/` — authentication, permissions, data handling, sending and rendering.
- `supabase/migrations/` — **never discard** historical SQL migrations.
- `tests/` — automated regression checks.
- `MD/` — approved system documentation and developer instructions.
- `public/` — approved static logo, favicon and import samples.

### Campaign template gallery and additional email services
Ten editable template blueprints are supplied directly in the email Template Library. Mailjet is included as an additional API connectivity option; Resend and Brevo integrations remain. The 024 database migration does not turn on cross-provider splitting or live Mailjet bulk sending.

## Batch 1 foundation (source upgrade, not production verified)
The app is permanently for Charis Microfinance Bank Ltd. No public subscription/pricing or multi-company fallback. The Admin Centre exposes roles, individual allow/deny grants, and department creation. Original roles and migrations are preserved. Existing database-wide customer/campaign RLS is still broad and needs future department-specific scoping; a department name alone does not grant or restrict loan/customer-data access.


## Batch 4 credit reminder preparation (032; source only)
Loan repayment reminders are composed from authorised loan records with bank-ledger reconciliation attestation, a 50-loan selection cap, per-recipient preview and policy-controlled review. The default is independent approval; direct own-approval needs additional delegated permissions and management-configured policy. Approved batches may only be placed in an internal *held* delivery ledger. No credit reminder SMS/email is sent. Production acceptance remains pending. See `MD/CHARIS_BATCH_4_032_CREDIT_REMINDERS.md`.


## Batch 5 — scheduled internal credit follow-ups (Migration 033)

The `/dashboard/credit-followups` module schedules task due dates for authorised loan accounts, with branch-scoped assignment and audit trails. `/dashboard/notifications` is a private in-app inbox. Customer workspace filters now support marketing-consent status and the presence of email/phone details, without changing marketing eligibility rules. There is no automatic customer sending or scheduled email/SMS worker in Batch 5. See `MD/CHARIS_BATCH_5_033_FOLLOWUPS_AND_CUSTOMER_FILTERS.md`.


## Batch 6 / 034

`/dashboard/insights` shows operational aggregates for authorised loan and account-service workloads. A dedicated `operations.view` permission allows scoped oversight without opening bank-wide campaign analytics. Audit activity now supports date/category filters and bounded pages. The campaign reports page and CSV endpoint derive the bank workspace from the authenticated session instead of trusting an external `org` parameter. See `MD/CHARIS_BATCH_6_034_OPERATIONS_REPORTING.md`. Production validation remains required.
