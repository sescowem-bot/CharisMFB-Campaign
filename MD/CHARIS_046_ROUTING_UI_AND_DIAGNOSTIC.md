# Charis 046 — Complete Email Provider Routing UI Fix

**Baseline:** Charis 043 full source, corresponding to GitHub main commit `57568c87` as inspected 16 October 2026. **No live database or Vercel changes performed.**

## What changed
- `app/admin/providers/page.tsx`: an optional budget read error no longer hides the Resend sender / message-purpose routing form; if route/sender/domain queries fail, the form remains protected and the source of failure is named.
- `app/error.tsx`: displays safe Next.js error reference and route back to overview; **the underlying Campaign Studio crash is not yet diagnosed**.
- `supabase/verification/046_routing_readonly.sql`: a **single complete SELECT** with no standalone CASE clause; read-only, does not change configuration.
- Migration 044 and 045 files are INCLUDED for release history; they are NOT applied automatically. **Do not rerun already-applied migrations.**

## Installation
1. Preserve your existing `.git` and take a repository + database backup.
2. Extract the full ZIP and copy the contents of `Charis-Campaign-Centre/` over the matching files in your existing checkout. Do not replace `.git`, Vercel secrets or database.
3. Ensure your checkout is based on the corresponding source revision. Do not overwrite newer changes: `git diff` first.
4. On the production-equivalent Node 24 environment: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; resolve any failure before pushing.
5. Commit the reviewed changes and push to GitHub; confirm Vercel READY.
6. As a verified bank sender admin, open Charis > Administration > Email Providers > Resend > Sender & message purpose. If reads are successful, the selection form is visible. Use the existing verified Salem test sender only for authorised staff testing, not banking customer communications.
7. The marketing purpose is a bank/provider-approval declaration, NOT proof of email delivery. Do not activate it unless policy and customer consent checks permit.
8. If the routing form is still absent, in Supabase SQL Editor use `supabase/verification/046_routing_readonly.sql`. Paste the **entire query**, Ctrl+A in the query editor, Run. Share the output only (no API keys or tokens).

## SQL previous error explained
`ERROR 42601: syntax error at or near "CASE", LINE 1` means the SQL statement started at the `CASE` expression, which is valid only as part of a full `SELECT`. It does not establish a missing migration or table corruption. The corrected diagnostics avoids the CASE entirely.

## Live marketing campaign precautions
A prior campaign with a scheduled send time and `allowed_kind=service` cannot go through the immediate Resend marketing-broadcast flow. After properly authorising the marketing route, revise and reapprove the campaign with a blank schedule and an approved opted-in audience. Reconcile any attempted sends before retrying. This release doesn't send emails.

## Verification limitations
The archive was source inspected and tested with available local Node tests. Local Node 22 lacks the project dependencies for full Next.js production compilation; a real Node 24 `npm ci && npm run build` is required in your deployment environment before going live. Neither the production DB nor Vercel was modified.
