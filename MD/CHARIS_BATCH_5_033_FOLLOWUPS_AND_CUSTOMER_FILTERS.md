# Charis MFB — Batch 5 / Migration 033

## Changes delivered in the source

1. **Credit follow-ups** (`/dashboard/credit-followups`): Schedule internal staff tasks on active loans. Staff may create their own tasks; separately authorised managers can assign them to members with matching branch access. Filter by open/done/cancelled, view due dates and priority, and update status. Tasks are auditable and tied to bank-owned customer/loan IDs.
2. **Private in-app notifications** (`/dashboard/notifications`): Assignment and status-change notices are written inside Supabase using a transaction. No email, SMS, background cron, webhook, or automatic customer delivery is activated. Inbox reads are restricted to each recipient; messages intentionally exclude personal loan/customer data.
3. **Customer workspace improvements** (`/dashboard/customers`): Branch-scoped searches now include marketing-consent status and contact-detail availability, with pagination preserving filters. Existing smart-group and campaign audience logic is unchanged, so no new segment rule can silently bypass consent.
4. **Loan navigation**: Link from loan details and the loan register to internal follow-ups.

## Permission keys

- `credit_followups.view` — see only one's own or created tasks for authorised customers.
- `credit_followups.create` — create follow-ups; also requires `loans.view` and either `credit_followups.view` or `credit_followups.manage`.
- `credit_followups.manage` — bank-admin/delegated management, including assignment to another staff member with appropriate customer branch scope.

New permissions go into the existing `charis_permission_catalog` but are **not automatically granted to ordinary staff**. Use Admin Centre > Roles & permissions to assign them. The platform owner / authorised bank admin can administer permissions under prior bank rules. The assignee must be an active Charis member with a matching bank-wide or branch assignment. Read and write checks are enforced in the database, not just hidden UI navigation.

## Install after a successful Migration 032

- Back up the existing Charis Supabase project. Run only `supabase/migrations/033_charis_credit_followups_notifications.sql` in the SQL Editor (after the corrected 032). No full database reset and no re-running previous migrations.
- Merge the accompanying source with the current GitHub repository (or use the complete ZIP as a replacement only after diffing your local changes). Push to GitHub to trigger Vercel.
- Use **Node 24** and run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Diagnose any failure; do not disable checking to force green builds.
- Verify at least two roles across two branches, follow-up visibility, due dates, inbox privacy, status changes, and failed cross-branch assignments in Supabase staging. This migration has not been executed against your bank's live database by the assistant.

## Safety and limitations

- This is not a live core banking loan feed. Staff must reconcile amounts and due dates against authorised bank records.
- No external reminder delivery has been enabled. Credit batches from Migration 032 stay **held**.
- In-app notifications are generated at task creation and status change, not on a timer; an overdue follow-up appears overdue in the staff task list when viewed. There is no automatic scheduled customer send or overnight push notification.
- Credit Officer assignment rights do not override customer branch scopes. Assignee selection by an admin uses available team directory results, but the database rejects invalid access.
- This release extends customer **filters**, not the definitions of promotional marketing audiences. Consent remains mandatory for promotional sends.
- No repository push, Vercel deployment or Supabase migration is performed by this release package.
