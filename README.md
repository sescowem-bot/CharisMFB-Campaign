# Charis Microfinance Bank — Campaign Centre

Single-company customer communications platform built with Next.js 15, Supabase and supported email providers. The source includes role-based staff access, contact management, consent controls, campaigns, independent review, sender settings, reporting and delivery audit. SMS dispatch is **not yet implemented**.

## Safe setup

1. Use Node.js 24, run `npm ci`, `npm run typecheck`, `npm test`, then `npm run build`.
2. Create a dedicated Charis Supabase project. For a new empty database follow `MD/CHARIS_NEW_SUPABASE_SETUP.md`. Existing databases use only unapplied numbered migrations in `supabase/migrations/`; do not reinstall the master SQL.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `SINGLE_COMPANY_MODE=true`, `SINGLE_COMPANY_ORG_ID`, and `RESEND_API_KEY` in Vercel. Keep server keys private.
4. Keep `EMAIL_DELIVERY_ENABLED=false` during controlled testing. Verify approved sender and recipient consent, staff permissions, the delivery worker, and error handling before enabling real sending.
5. Only authorised staff should handle customer data. Do not upload production customer spreadsheets to GitHub or put private customer records in public asset storage.

## Test workflow

Sign in → import or add approved test contacts → create a draft → choose the recipient(s) → save → send test to your verified account → submit for review → approve by a separate authorised staff member → queue/send → check delivery report.

The Resend API key alone does not verify a new sending domain. The Charis sender interface should reuse an already verified domain in the same Resend account, and never create a duplicate domain automatically. Do not use another business's domain as Charis's customer-facing sender.

## Project directories

`app/`: UI, routes and server actions. `components/`: UI elements. `lib/`: auth, campaign, email and database helpers. `supabase/migrations/`: all historical migrations (retain for audit). `tests/`: regression tests. `scripts/`: worker, backup and release checks. `MD/`: only current instructions and acceptance documentation.

See `MD/LEAN_RELEASE_REVIEW.md` for the file-cleanup scope and performance next steps. This ZIP reduces documentation clutter; it does not claim to replace performance profiling or a full Vercel production build.
