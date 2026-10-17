# Charis Campaign Centre — Release 057

## Purpose
End-to-end source quality review of the staff campaign and loan-reminder experience. This release builds on the **full Release 056 ZIP** and makes **code-only fixes**; it does not modify database structures or activate any delivery provider.

## Changes

1. **Honest delivery statuses.** One set of staff labels is used in the Campaigns list and Message Delivery detail page. `Accepted by provider` is not presented as inbox delivery, and `Needs review`, `Failed`, `Not sent`, `Waiting`, and `Sending` remain distinct. Delivery summary totals expose mixed outcomes; technical reason text is hidden when the provider has accepted a message.
2. **Clear submission feedback.** Create Campaign no longer treats zero accepted plus delivery failures as a successful send. Uncertain outcomes ask staff to check delivery history rather than resend. If the post-create status query fails, the message is treated as created but **not confirmed**, avoiding a second submission.
3. **Strict scheduling input.** Invalid Nigerian local calendar dates and times (e.g. February 31) are rejected instead of automatically being normalised to another date. Valid schedules still require at least six minutes' lead time and a maximum 30-day horizon. `CHARIS_SCHEDULING_ENABLED` remains an explicit opt-in.
4. **Loan reminder error states.** If the due-candidate loan, customer or balance query fails, staff see an error; they are **not** falsely told there are zero reminders. Failure of eligible-loan contact data also prevents drafting.
5. **Correct Lagos due-date comparison.** Date parts are assembled explicitly in `YYYY-MM-DD` order; locale-specific formatted date strings no longer determine due/overdue filtering.
6. **Regression guardrails.** A new `tests/charis-057-workflow-qa.test.mjs` covers status wording, Nigerian scheduling checks, route continuity, worker authorization, and loan-reminder error handling.

## Files changed

- `app/dashboard/communications/actions.ts`
- `app/dashboard/communications/page.tsx`
- `app/dashboard/communications/history/page.tsx`
- `app/dashboard/credit-reminders/page.tsx`
- `lib/direct/delivery-view.ts` (new)
- `tests/charis-057-workflow-qa.test.mjs` (new)

## Verification performed

- `211` TypeScript/React source files passed **syntax parsing**, no duplicate imports found.
- Release 057 tests: `6/6` passed.
- Full Node 22 regression suite: **223/250 passed; 27 failed**. Failures include missing/uninstalled package dependencies and older tests written against previous user-interface and approval workflows. Do not treat this as a clean suite.
- Archive integrity checked separately.
- **Not yet performed**: Node 24 `npm ci`, `tsc --noEmit`, ESLint, Next.js production build, authenticated browser QA, Supabase RPC and RLS execution tests, Vercel staging deployment, live provider/webhook tests, mobile speed measurements.

## Deployment checklist

1. **Source alignment:** The package extends local Release 056, which may be newer than the GitHub main branch. Compare changes before replacing the repository; preserve the `.git` folder and all existing environment variables.
2. **Database readiness:** Confirm previous SQL migrations **047, 049, 050, 051, 055, 056** (and their prerequisites) are installed with their read-only verification files. **There is no new SQL 057 migration** for these code-only fixes.
3. **Use Node 24:** Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Investigate failures rather than bypassing them.
4. **Stage before production:** Use authorised test contacts only. Check importing, selecting, composing, send-now, sender acceptance vs delivery, scheduling (if enabled), cancelled scheduled campaigns, permissions, unsubscribe/resubscribe, due-loan scanning, and manual credit reminder creation.
5. **Check background workers:** Verify `EMAIL_WORKER_SECRET`, scheduled GitHub/Vercel execution and actual queue processing. Do not enable additional recurring triggers until review. Keep live customer dispatch disabled during validation.
6. **Mobile QA:** Test staff login, expandable navigation, search, recipients, campaign review, delivery history and credit reminder screens at common phone widths.

## Open issues and future work

- Direct-email recipients currently track **provider acceptance** in the direct-message tables. Webhook-driven proof of inbox delivery and detailed direct campaign analytics require a separately verified database/worker integration. A successful API response is not inbox delivery.
- Existing Resend marketing Broadcast history is separate from service email. Old Broadcast links continue to use Resend's unsubscribe page.
- Loans still require **core banking balance verification** before customer sending. Automated scanning generates suggestions only.
- Performance gains need live authenticated timings and a successful Node 24 production build; syntax checks alone are insufficient.
- Scheduled campaigns depend on a correctly configured periodic worker. A scheduled row alone does not send an email.

**Safety:** No live data modified. No customer email/SMS sent. No code pushed automatically.
