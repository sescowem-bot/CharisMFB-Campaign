# Charis Campaign Centre — Complete source release

**Project:** Charis Microfinance Bank Campaign Centre  
**Source baseline:** GitHub `sescowem-bot/CharisMFB-Campaign`, main at `25998dc` (13 Oct 2026), plus fixes supplied in this release.  
**Contents:** Next.js application, components, dependencies lockfile, tests, Supabase migrations 001–018, sample import and documentation.  
**GitHub status:** The supplied files have **not** been pushed or deployed automatically.

## What's included

- Dedicated Charis staff dashboard, login, access roles and invitation workflows.
- Customer contact creation, import, lists, individual selection, archive/restore and guarded deletion.
- Campaign editor, templates, test sending, independent approvals, delivery queue and reporting.
- Resend-based sender management with domain verification and editable sender identity; no sender mailbox is hardcoded in Vercel.
- Brand settings, logo/favicon graphics and media support (see migration 018 for storage requirements).
- **Fixed logout:** public site header, footer, mobile and dashboard now use the browser Supabase sign-out flow, avoiding the old cross-origin POST endpoint.
- **Fixed Customers build error:** organization ID is narrowed once and reused as a required string in contact queries and actions.

## Upload / push without losing Git history

1. Back up your current local project and any uncommitted changes.
2. Open your existing `CharisMFB-Campaign` Git checkout (do not delete its `.git` folder).
3. Copy the **contents inside** this extracted `Charis-Campaign-Centre` folder into the Git checkout, merging folders. Do not copy a nested outer folder into the repo root.
4. In the checkout, run:

```bash
git status
git add -A
git commit -m "Complete Charis Campaign Centre with logout and contacts fixes"
git push origin main
```

If the push is rejected due to newer remote commits, fetch and reconcile changes before pushing; **do not force push**.

## Deploy / settings

- Vercel: keep `SINGLE_COMPANY_MODE=true`, the Charis organization UUID, the new Charis Supabase URL and publishable key, a server-only Supabase secret and `RESEND_API_KEY`. Keep `NEXT_PUBLIC_APP_URL` set to the exact production origin.
- Sender email/address is configured inside Charis, not from hardcoded environment variables.
- Never commit `.env.local`, API keys, service-role secrets, database URLs or actual bank customer lists.
- Run *only* any outstanding Supabase migrations, in numeric sequence; do not rerun the fresh-install SQL on an existing database. Migration 018 is required for customer archive and brand/media functions.
- Keep `EMAIL_DELIVERY_ENABLED=false` until authorised real-send and worker acceptance testing is complete.

## Verification limitations

These files were checked for structural completeness and TypeScript/TSX syntax parsing. A full `next build`, a live Supabase integration check, a successful production sign-out, sender verification, and real email delivery have **not yet been verified** in this runtime. The project requires Node 24 and full dependencies.

## Post-deploy acceptance checklist

1. Verify that Vercel successfully completes `next build` with Node 24.
2. Sign in, log out from dashboard and public header, and verify dashboard is protected after sign out.
3. Add an authorised sample customer, verify Unknown consent does not permit marketing, then test archive/restore.
4. Upload a bank-approved logo and favicon and confirm display.
5. Connect a verified test sender to the Charis workspace and send one test to your own verified account.
6. Test campaign draft, independent approval/rejection, then controlled queueing and delivery on an authorised test list.
