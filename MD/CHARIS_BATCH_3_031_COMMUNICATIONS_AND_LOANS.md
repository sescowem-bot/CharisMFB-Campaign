# Charis Campaign Centre — Batch 3 (Migration 031)

## Scope and continuity
This upgrade continues the existing single-bank Charis MFB system. It preserves the prior app and migrations 001–030, customers, access controls, saved campaigns, providers and configuration. The continuation is additive, with no live customer sending.

## Phase 05 — Unified Communications
- Communications home now links to the existing email/SMS campaign, approvals and delivery workspaces, plus the new **Account-service notices** workspace according to staff permissions.
- Separate service-notice database supports individual customer email/SMS draft messages, optional loan association, editing, submission, independent approval or rejection with reasons, audit history and branch-scoped access.
- **Drafts and approvals never send messages.** Service notices are separate from promotional campaigns and are not a workaround for marketing consent, provider policies or banking compliance requirements.

## Phase 06 — Credit Loan Register
- `dashboard/loans`: browse authorised loans; search by loan reference; view principal, contracted total amount due, disbursement and due dates, amounts paid, outstanding balance and overdue status. All figures shown on dashboard summaries apply only to the current 25-row page and are labelled accordingly.
- `dashboard/loans/[id]`: view internal loan information and repayment history, and post a manually confirmed repayment.
- SQL `charis_loan_balances` uses a `security_invoker` view and full repayment aggregation, avoiding truncated client totals. Repayments lock the loan row, reject excess amount, require a per-loan unique receipt reference, mark fully paid loans settled, and create auditable records.
- **Manual internal register only.** Bank core records remain authoritative. No automatic loan import, amortisation schedule, interest recalculation, repayment reversal, core banking posting or customer reminder sending is included.

## Roles and permissions
| Responsibility | Permission keys |
|---|---|
| Credit read-only | `customers.view`, `loans.view` |
| Credit loan registration | Above plus `loans.manage` |
| Repayment posting | `customers.view`, `loans.view`, `loans.repayments` |
| Service notice drafter | `customers.view`, `service_notices.view`, `service_notices.create` |
| Independent service reviewer | `customers.view`, `service_notices.view`, `service_notices.approve` |

Grant permissions in the existing Admin Centre, under custom roles or individual overrides. Branch-restricted staff must be assigned to active branches and authorised customers. Departments are not hardcoded. Super Admin retains system authority. The current notice approval policy requires a reviewer different from the creator/submitter; administrator-configurable variations belong to the later reminder workflow.

## Safe rollout (not carried out)
1. Back up the application repository and Supabase before any change; compare with the latest deployed branch. The latest GitHub main previously verified only through migration 027, while this package contains 028–031.
2. Identify already applied migrations in the actual database. Run **only missing** migrations sequentially (028, 029, 030, then 031), against a staging copy first. Do not rerun fresh installers or overwrite an existing deployed repository blindly.
3. Keep `EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false`, and the scheduled worker disabled throughout database and UI verification.
4. Use Node.js 24 with dependencies installed and run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; verify SQL and Row Level Security with multiple real staff roles and branches.
5. Reconcile loan balances against actual bank-approved core data, test receipt duplicate handling and concurrent posting, ensure approval separation, then obtain bank acceptance before production usage.

## Validation status
- New/changed TS and TSX syntax checked with TypeScript transpilation.
- Focused Batch 2B/Batch 3 source-level regression tests passed.
- Broad inherited tests were not fully green on the available Node 22 runtime with incomplete `node_modules` installation; no full production build or database migration execution was completed.
- No GitHub pushes, Vercel deployments, Supabase writes or customer sends occurred.

## Next milestone
**Batch 4 — Phases 07–08:** controlled Credit Reminder Centre, administrator-managed approval rules, single/selected/group account selection, safe repayment-notice templating, validated regulated-message providers, delivery queue, deduplication and reporting. Do not enable customer dispatch before compliance and hosted acceptance.
