# Charis Campaign Centre — Batch 4, Migration 032

## Scope
Continue the existing single-bank Charis system from Batch 3 / migration 031. This source includes every prior migration 001–031 and is **not** a fresh installer. Existing customer data, historical loans/repayments, promotional campaigns, original service notices, bank sender configuration and role grants are preserved.

### Phase 07: Professional Credit Reminder Centre (source prepared)
- `/dashboard/credit-reminders`: select one loan, a curated set or all eligible loans displayed (maximum 50 per draft). Filter overdue, due within 7 days or open loans; search by core-loan reference. Each selected loan must belong to a customer visible to the current staff's branch-scoped account.
- Staff-confirmed core-ledger reconciliation is mandatory. Amounts come from the *internal manual* loan register and repayment aggregation, NOT a bank's live loan book; reconciliation is not automatically verified.
- Personalised placeholders: `{{first_name}}`, `{{loan_reference}}`, `{{outstanding}}`, `{{due_date}}`, `{{bank_name}}`. A first-recipient preview is provided. Do not put BVN, PIN, passwords, full account numbers or private collections details in message templates.
- Draft → submit → approve/reject → HELD. Reject requires a note. Submitted messages cannot be edited into different content before approval; make a fresh batch after rejection. Draft cancellation is supported.
- Admin-configurable policy: **independent approval** by default. Alternatively the Admin Centre may allow *explicitly delegated* own-batch approval; both `credit_reminders.approve` and `credit_reminders.direct_approve` must be assigned, and the bank-wide policy must be `authorised_direct`.
- Each stage is audited. Branch-scoped RLS and guarded database functions implement the actual permission check.

### Phase 08: Delivery governance foundation (not a live sender)
- `charis_credit_delivery_holds` is a staging-only ledger with `status='held'` and no other permitted status. Neither the old marketing campaign worker, nor the SMS pilot, nor any new worker reads or dispatches these records. There is NO button or API that dispatches credit reminders in Batch 4.
- Before a batch can be held, database functions re-evaluate whether every loan remains open, outstanding balances have not changed, customers are active, and channel destinations still match. One loan cannot be staged twice via the same channel on the same Lagos-local day. Held records are created atomically and protected by a daily bank-wide cap (default 100; range 1–500).
- This is deliberately **not** a claim that SMS or email customer notices are live. A later delivery implementation must separately verify bank approval for the message category, privacy/legal basis, sender identities, permitted provider API products (marketing vs transactional), recipient delivery preferences, DND/STOP handling, webhook authentication, idempotency, and operational audit/reconciliation.
- Previous Resend/Brevo/Mailjet provider settings and existing campaign marketing consent protections remain unchanged. Promotional sends must never use service-notice workflows to avoid consent.

## Staff permissions

| Capability | Key |
|---|---|
| Read assigned credit reminder batches | `credit_reminders.view` |
| Prepare reminder drafts (also needs `loans.view`, `customers.view`, and `credit_reminders.view`) | `credit_reminders.create` |
| Review submitted credit reminder batches | `credit_reminders.approve` |
| Allow own-batch approval *only if policy enables it* | `credit_reminders.direct_approve` |
| Stage approved batches in a held queue (NOT sending) | `credit_reminders.queue` |
| Change approval policy and held-recipient limit | `credit_reminders.settings` |

## Deployment prerequisites — NO deployments performed

1. Confirm exact latest GitHub/Vercel source and back up the real bank database before merging. Current historical GitHub main was verified through migration 027 only; the continuation packages contain migrations 028–032. **Never blindly reset or recreate an in-use database.**
2. Apply only the migrations absent from the existing Supabase database, sequentially. Stage migration 032 after 031. Do not rerun all migrations on production. SQL must be validated in a real Postgres/Supabase staging environment.
3. Configure custom roles in `/admin/access`; assign branch scopes, loans/customer view, reminder create/view and review/queue. Enable the `credit_reminders.direct_approve` permission only after a bank management decision.
4. `EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false` and `CHARIS_EMAIL_WORKER_ENABLED=false` should remain in force until existing campaign sending is independently accepted. This release **does not use** those flags to enable credit reminders: it has no credit-dispatch worker regardless of their values.
5. Run all Node 24 project checks (`npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`) and validate the 032 SQL/RLS transaction in a Supabase staging copy. Test at least two staff, two branches, own review on/off, overpayment/stale balance, invalid phone/email, duplicate held records and atomic daily caps.
6. Obtain Credit, Compliance, IT and management release sign-off before any future live delivery integration.

## Build evidence in this release
- Batch 4 dedicated source-regression tests passed (5/5). Broad inherited suite on Node 22: 118/134 checks pass, the same 16 failures already present in the Batch 3 baseline (113/129); this is not a claim of a successful Node 24 build.
- New changed TypeScript/TSX passed syntax/transpilation checks using globally installed TypeScript; actual project typecheck/build unavailable without a complete local dependency installation and the required Node 24 runtime.
- Migration 032 is designed for Supabase Postgres but has **not** been executed against the real bank DB or a staging clone in this session.
- No GitHub push, Supabase mutation, Vercel deployment, or customer message dispatch occurred.

## Next milestone
Batch 5: controlled follow-ups, operational scheduling and customer segmentation, retaining separation between promotional audiences, account-service notices, and Credit reminders.
