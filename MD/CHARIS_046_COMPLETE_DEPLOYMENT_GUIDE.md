# Charis Campaign Centre — Complete Source Release 046

Includes the **full application project**, not an installer or a patch script.

**Source baseline:** GitHub main `57568c87d840bed64d0b90d5b99135f3b9720f24` from 16 October 2026, plus Release 046 routing/error-display fixes and the previously prepared SQL 044/045 files for version history.

## Why SQL failed
The earlier diagnostic has two statements; a selected fragment starting with `CASE` is not executable alone, resulting in `42601 syntax error at or near CASE LINE 1`. It is a SQL editor selection issue, not evidence of a corrupt table. The corrected `Charis_046_Routing_Diagnostics_FIXED.sql` is **one read-only statement** that starts with `SELECT` and ends with `;` and includes no CASE expression.

## Deploy complete source
1. Back up your existing GitHub checkout and Supabase database.
2. Extract `Charis_Campaign_Centre_046_FULL_Routing_Fixed.zip`.
3. Copy everything **inside** `Charis-Campaign-Centre` into your existing `CharisMFB-Campaign` checkout, preserving its `.git` directory. Do not copy secrets, `.env` files, or overwrite newer source changes without first reviewing `git diff`.
4. With Node **24** run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Never ignore TS/build errors. The offline preparation environment has Node 22 and lacks installed project dependencies.
5. After the complete build succeeds, `git add -A`, commit the reviewed release, and `git push origin main`. Confirm Vercel production deployment becomes READY.
6. Open `/admin/providers#provider-resend` as authorised sender admin. The sender and message-purpose control is displayed if the route/sender/domain reads succeed, regardless of an optional monthly-budget read error. Choose the *verified authorised test sender*, set the marketing purpose **only after provider approval and marketing consent are confirmed**, and save.
7. If routing remains hidden, open Supabase SQL Editor, create a NEW query, press Ctrl+A in the editor, paste the **entire** standalone `Charis_046_Routing_Diagnostics_FIXED.sql`, and click RUN with the full statement. Provide the returned row; never provide secrets.

## Included SQL files
- `supabase/migrations/044_charis_campaign_design_save_fix.sql` — historical campaign design block repair. **Do not rerun** if already applied.
- `supabase/migrations/045_charis_email_budget_admin_read.sql` — historical admin budget permission repair. **Do not rerun** if already applied.
- `supabase/verification/046_routing_readonly.sql` — new one-statement diagnostics. Safe to run, no writes.

## Safeguards and limitations
- This release does **not** send email, modify Supabase, change provider routing in the live application, alter customer consent or update Vercel.
- The `TESTING WORK` campaign was scheduled and its current Resend route was `service`; do not attempt to resend until a bank-approved marketing route is configured, the schedule is cleared in a new draft revision, an authorised approval is renewed, and earlier delivery status is reconciled.
- The generic Campaign Studio crash is **not proven fixed**. The error boundary now shows a support digest, when Next.js supplies one. Use Vercel request logs to diagnose its underlying cause. Avoid blind customer sending.
- Local verification: provider page and error page syntax transpile with TypeScript, 046 routing regression tests pass. Existing full test suite: 166 pass, 13 cannot complete in this local Node 22 environment due to unavailable TypeScript ESM runtime/project dependencies. Full Node 24 Vercel production build remains to be verified.
