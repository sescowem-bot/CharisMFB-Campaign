# Charis Campaign Centre — Lean repository review (13 October 2026)

## Done without changing application behaviour

Removed obsolete historical release notes, standalone design previews and the pitch-demo HTML from the source package. Consolidated README. **Kept** the full Next.js source, middleware, all 18 migrations, archived generic SQL required by an existing regression test, CI configuration, automated tests, backup and worker scripts, and currently-used authentication/provider functions.

These removed files are not imported into the app; reducing repository clutter is not equivalent to reducing browser runtime or API latency. Do not interpret this archive as a proven performance-optimised build.

## Performance tasks that still require engineering and benchmarks

* Profile `middleware.ts` authentication/network latency; retain actual security checks and avoid duplicate work in the request chain.
* Reduce duplicate calls to `publishedSite()` and staff account reads in layout/shell; cache only non-sensitive branding appropriately.
* Make Resend domain discovery user-triggered or short-lived cached, not a fresh provider call on every sender-settings page load. Never cache privileged results across users incorrectly.
* Measure database queries and indexing for contacts, campaign table, recipient selection and reports. Keep pagination and server-side filters.
* After impact analysis, remove legacy multi-company billing, pricing, plan and owner-workspace application routes that no longer belong to a single-company bank application. Preserve SQL migration history and RLS until independently migrated and verified.
* Confirm Vercel Node 24 production build, run all tests, verify staff login/logout, test email, approvals, worker-based dispatch and SMS integration only when it actually exists.

## Communication provider recommendation

* First release: Resend for test emails (100/day on free tier) and one prepaid Nigerian SMS provider such as BulkSMS Nigeria or Termii. No SMS sends are implemented yet.
* For 30k emails/month: AWS SES à-la-carte costs about US$3/month for outbound messages before FX, attachments or other fees. At an illustrative ₦1,330/US$ that is ~₦3,990, above a strict ₦3,000 cap. SES sandbox and production access restrictions apply.
* A lower-cost hybrid might use Sender.net's free plan (15k/month, up to 2,500 opted-in subscribers) for half the volume and AWS SES for the remainder (~US$1.50 in SES sending fees), but this adds provider integration, cross-provider suppression and consent synchronisation. Verify current eligibility and the bank's requirements first.
* Marketing messages only to approved/consenting audiences; keep audit, suppression, DND handling and sender ownership approval. Never bypass provider limits by rotating accounts.

## Version note

Source based on the latest existing-verified-Resend full ZIP available in this session. No GitHub push, database migration, provider billing or production build was performed.
