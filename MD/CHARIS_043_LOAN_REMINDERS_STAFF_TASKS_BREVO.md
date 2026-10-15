# Charis Campaign Centre — Release 043 | Customer Loan Reminders + Staff Tasks & Alerts

**Source baseline:** GitHub `sescowem-bot/CharisMFB-Campaign` commit `68ad3115f4e0afccddb733d94783452756409235` (Release 042, current build when audit began). This is a source package, NOT a production-deployment certificate.

## What was actually built

- Changed the customer-facing name to **Loan Reminders** in Credit Operations. Kept the legacy credit reminder tables, draft preparation, independent/direct authorised approval, bank-checked balance snapshot, and held queue.
- Added **optional bank-gated live Brevo SERVICE email delivery** for ONE approved held customer loan reminder per click. A separate `credit_reminders.dispatch` permission is required. Each attempt is atomically reserved; the same hold can never be resent via the new path. Repayment balances, due date, contact address and bank-wide suppressions are rechecked at the moment of dispatch. Approval expires after 24 hours. If the account is already settled or has changed, sending is refused.
- Extended the Brevo webhook to reconcile service-email accepted/delivered/bounced/blocked/complained/unsubscribed outcomes to credit dispatches, including events that arrive before the initial acknowledgement. Failed/suppressed addresses are recorded in the existing bank suppression table. Provider acceptance alone is NOT proof of inbox delivery.
- Separate internal **Staff Tasks** (`/dashboard/tasks`) and **Staff Alerts** (`/dashboard/notifications`). Existing `/dashboard/reminders` bookmarks redirect to the Tasks page. Department task links and dashboard shortcuts point to Tasks. Existing database table/function names are intentionally retained to preserve all records.
- Added staff notification triggers for new task assignments/status changes, and private overdue alerts when staff open the notification inbox; no external customer message is sent by staff tasks.
- Added **Brevo staff email check** inside Administration → Email Providers → Brevo. Only a preconfigured bank-owned mailbox is eligible; a bank-wide 15-minute cooldown and audit record are enforced. This is a REAL bank staff email, not a provider sandbox, and does not contain loan data.
- Added responsive branded styling to the Credit/Tasks surfaces.

## Safe installation (in order)

1. Back up Supabase first. Confirm migrations through **041** applied. There is NO SQL migration 042 (CSS-only release).
2. Run `supabase/migrations/043_charis_customer_loan_reminder_delivery.sql` **once** in Supabase SQL Editor on staging, then `supabase/verification/043_credit_staff_brevo_readonly.sql`. Every check in its first query should show `true`.
3. Merge the Release 043 patch against commit `68ad311...`, preserving folder structure, or use the complete project zip; **do not upload both**.
4. In CI with Node **24**, run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; fix every failure before merging to production. Preview-test responsive layout, account access, roles, RLS and email/suppression flows with authorised test data.
5. In Charis Administration → Email Providers, enable Brevo, connect a verified Brevo sender, select **Bank-approved service notices**, and set the Brevo service route enabled and policy-confirmed. Confirm Brevo accepts Charis's banking/loan reminder use case. Marketing permission or Resend marketing approval does NOT authorise debt notices.
6. In Vercel (server-side Production variables):

```dotenv
BREVO_API_KEY=...                    # Already configured if present; keep secret
BREVO_WEBHOOK_SECRET=...            # Must match the authenticated Brevo webhook
BREVO_STAFF_TEST_EMAIL=...          # Explicitly authorised bank staff mailbox
CHARIS_LOAN_EMAIL_DELIVERY_ENABLED=false
CHARIS_LOAN_EMAIL_POLICY_APPROVED=false
```

   The existing `EMAIL_DELIVERY_ENABLED` and Resend promotional flags remain separate. Release 043 **never enables sending automatically**, even if the other flags are true.
7. Verify Brevo's **Check connection** (read-only). Then, if authorised, use **Send one Brevo staff email** inside Charis and confirm the message arrives in the approved mailbox. This is one real delivery to staff, not to a customer.
8. Only after bank Risk/Compliance and Brevo approval, verified balance controls, event webhook and successful staging checks, the owner may set BOTH `CHARIS_LOAN_EMAIL_DELIVERY_ENABLED=true` and `CHARIS_LOAN_EMAIL_POLICY_APPROVED=true` in Vercel Production and redeploy. Assign the `credit_reminders.dispatch` capability only to authorised Credit Officer/Approver staff.
9. For the bank-authorised first customer use: reconcile the loan against BankOne/core ledger, prepare and approve a fresh **email** batch, put it on hold, select exactly one approved held email, explicitly confirm the current balance and recipient, then select **Send approved email**. Check the Brevo provider record and the Charis outcome. Scale only after documented bank acceptance.

## Important limitations, not to gloss over

- **Customer SMS reminders are NOT wired to a live SMS provider.** Existing pilot Termii staff test functionality is separate. SMS batches remain held; do not tell staff they were sent.
- **Internal loans are not automatically reconciled with BankOne.** Staff must reconcile immediately before dispatch. An unchanged internal balance can still be wrong if it is out of sync with the core ledger. Production automation requires a verified core-banking feed and a new eligibility process.
- No automatic customer follow-up sending, mass loan reminders, queue replays or auto-retries. One action sends one held email, reducing mistaken collection notices. If a provider response is uncertain, it remains blocked from re-send and requires authorised reconciliation.
- Brevo's service-email use for collection or repayment notices is subject to its policies and the bank's compliance sign-off. Don't activate if not approved.
- Authenticated, existing marketing customer broadcasts through Resend remain separate and unaffected.
- Strict review/approval, permission-scoped RLS, channel segregation and suppression protections are preserved.

## Verification in the development environment

- TS/TSX/JS parse audit: **234 files**, **342 local imports**, **0 syntax/import errors**.
- Release 043 focused tests: **4/4 passed**.
- Brevo adapter mock transport: **4 cases passed** (accepted, HTTP 403, network outcome unknown, HTML escaping).
- All tests in installed local Node 22 environment: **166/179 passed**; **13 older dependency/runtime-related suites remain unavailable or fail** without full Node 24 dependencies, identical in category to the Release 042 baseline.
- `npm ci --offline` could not complete because the locked Zod package is not in the local cache. A complete typecheck, ESLint and Next.js production build are **NOT** verified locally.
- Migration 043 is **NOT** executed against your Supabase, Vercel flags are **NOT** changed, no GitHub push has occurred, and no live customer/staff emails have been sent.
