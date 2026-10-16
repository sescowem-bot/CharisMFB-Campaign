# Charis Campaign Centre — Release 047: Simple Communications

## Purpose

Staff can create an official service communication through **Communications → New message**. Approval is **off by default** and can be turned on by the bank administrator. Staff choose channel, message, authorised recipients and press **Send now**. Email provider selection is automatic and configured once by an administrator. Existing marketing and credit/loan reminder workflows remain unchanged. This release is **additive** and does not erase or rewrite historical campaign records.

## Implementation

- New direct communication composer: Email and gated SMS, purpose, banking product, customer selection, full-directory search, saved groups and bank-wide audience where permission and limits allow.
- New backend database reservation RPC with per-recipient snapshots, idempotency key and a hard maximum of 50 recipients per submission. Default maximum: 20 recipients; hard bank-wide ceiling: 500 direct recipients per UTC day. These are conservative rollout limits, not permanent marketing limits.
- New job processor: per-recipient claim, current customer data check, email suppression checks, provider preference selection, separate service-email transport, SMS through Termii only when enabled. Uncertain outcomes pause the run and are **never automatically retried**.
- Existing `/api/worker/delivery` now handles these direct jobs independently from the legacy `CHARIS_MULTI_PROVIDER_ENABLED` flag. The existing authenticated GitHub Actions worker may process remaining queued recipients.
- New Admin → Communication settings: optional approval toggle, staff send allow/restrict, service sender preferences with priority, email/SMS availability. A verified sender must be selected once for each enabled provider.
- New history and per-message outcomes. **Accepted means provider acknowledged a request, not customer delivery.**
- Existing campaigns, broadcast recipient records, sender domains, credit operations, and queued legacy runs remain untouched.

## Deployment order (IMPORTANT)

1. **Back up** your Charis Supabase database and current GitHub repository. Do not remove the original source or old migrations.
2. Unpack the **full project ZIP** and replace code in the existing local GitHub checkout **without removing `.git` or overriding more recent work**.
3. Use Node **24**. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, then `npm run build`. Address every error before pushing to production. Do not disable ESLint or type checking to hide a problem.
4. In the **existing Charis Supabase project**, open **SQL Editor**, paste and run the ENTIRE `supabase/migrations/047_charis_simple_communications.sql` in a new query. Do not select and run fragments. Confirm it completes successfully. Then run `supabase/verification/047_charis_simple_verify.sql`. It adds tables/functions, does not send messages, and does not alter the existing campaign records.
5. Push the reviewed full code to the existing `sescowem-bot/CharisMFB-Campaign` GitHub repo and confirm Vercel deployment is **READY**.
6. In **Vercel → Settings → Environment Variables (Production)** keep existing `SINGLE_COMPANY_ORG_ID`, Supabase keys, provider keys and `NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app`. For the new delivery engine set `CHARIS_SIMPLE_SENDING_ENABLED=true` and `EMAIL_DELIVERY_ENABLED=true` **only after the bank is ready to permit real customer sends**. Set `CHARIS_CUSTOMER_SMS_ENABLED=false` until Termii customer messaging is formally approved and configured. Redeploy after changing production environment variables. Do **not** expose provider API keys to the browser.
7. In **Administration → Communication settings**, choose the currently verified provider and sender for authorised service emails, enable that provider, and save. This does not change the old marketing route. Turn approval on only if desired. For staff who should not send, select their accounts and restrict sending. Staff also need appropriate customer-viewing permissions and branch scope to select recipients.
8. Open **Communications → New message** and send an authorised internal communication to a permitted staff/customer test mailbox first, using the ordinary service-notice path. Check provider acknowledgement and the new **Message delivery** screen. This verifies production sending without marketing broadcasts.
9. For more than the first three recipients, ensure the existing `EMAIL_WORKER_SECRET`, GitHub Actions secret/vars (`CHARIS_APP_URL`, `CHARIS_EMAIL_WORKER_ENABLED=true`) are correctly configured. The existing GitHub delivery workflow runs every five minutes and now drains up to six direct recipients per invocation. Without a running scheduler, remaining recipients will remain queued. GitHub Actions scheduled workflows may also be delayed; it is **not** an exact-time guarantee.

## Important safeguards and scope

- The new Send Now path supports *legitimate banking service notices, account updates and general non-promotional notifications*. Offers, sales pitches, referrals and product acquisition campaigns still belong in a separate marketing workflow with documented opt-in, suppression and unsubscribe handling; labels must not be used to bypass marketing-consent requirements.
- Loan repayment reminders remain in Credit Operations with loan-specific checks. This direct composer does not access loan balances.
- Staff need a verified active bank login and are limited to customers they may view. Bank-wide group/all sending requires bank-wide scope; the system does not expose all customer records to new staff simply because approval is turned off.
- For Email, an administrator must enable at least one *service-authorised* provider preference and link a verified active sender. A marketing-authenticated sender cannot be assumed to be service-authorised without administrator permission and provider terms.
- For SMS, Termii must be active with a bank-approved sender and provider account balance. SMS is off by default and the bank bears carrier charges.
- An immediate Send Now submission dispatches up to **three** recipients in the request; the rest are handled by the secure scheduled worker. The UI accurately reports provider acknowledgement separately from actual delivery.
- This is an additive migration. Do not reset tables, disable RLS, enable blanket service-role browser access or blindly resend uncertain message outcomes.

## Verification performed in the preparation environment

- Eight new Release 047 source checks: **passed**.
- New/modified TypeScript and TSX source files: **parsed without syntax errors** (58 relevant source files scanned).
- Broader test suite: **177 passed, 13 unable to pass locally** due to missing runtime dependencies and Node 22, rather than a confirmed Release 047 runtime bug. They must be rerun with Node 24 and `npm ci` on a fully configured machine.
- `npm ci` could not finish because the local environment could not fetch `zod` and other dependency archives. As a result, a clean `npm run build` has **not** been verified, nor has SQL 047 been executed on the Charis Supabase project. **Do not call this release production-certified until both pass.**
- No live email or SMS was sent while assembling this release. No production database mutation or GitHub push occurred.

## Rollback

Turn `CHARIS_SIMPLE_SENDING_ENABLED=false` in Vercel and redeploy to stop future direct sends. Do not delete the new direct-job tables if any messages are queued/sending or have unknown provider outcomes; reconcile with providers first. If a frontend rollback is necessary, redeploy the previous known-good GitHub commit while retaining the additive tables for history.
