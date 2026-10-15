# Charis Campaign Centre — Release 036 | Production Readiness + SendGrid

## Release scope

Source-only continuation of Release 035. **No Migration 035 or 036 exists.** Do not rerun successful migrations. New SendGrid admin diagnostics are for **verified-domain checks and sandbox API request validation only**. They neither send email nor enable marketing campaigns, service notices, SMS or credit reminders to customers.

### Confirmed baseline (before 036)

- Vercel production has a READY build for GitHub commit `7fc0b9efcca6028df05b567b4037ed1cf38ea96a`, Node 24.
- Repo `sescowem-bot/CharisMFB-Campaign` has migrations up to 032. Current source 035 archive includes migrations 033 and 034; **their execution in Supabase is not confirmed**.
- Migration 032 was confirmed successful by the bank user.
- Current repository visibility was **public** when last checked. Do not store credentials or customer data in Git, including commit history. Restrict collaboration access and make the repo private if it is a bank-owned private codebase.

## Install and build in order

1. Take a versioned backup of Supabase **and test restoration**, plus copy the GitHub release source. Review changes before overwriting existing source.
2. In Supabase SQL Editor run `supabase/verification/035_release_readiness_readonly.sql` and confirm 032, 033 and 034 objects. Apply only missing 033 then 034 in numeric order. Do not run an old fresh-install SQL.
3. Apply the source patch to a review branch based on Release 035 (or deploy the complete 036 ZIP as a new release). Keep credentials **only in Vercel Environment Variables**.
4. Use Node 24: `npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm run test:smoke` and check GitHub Actions. Resolve every failing test rather than suppress it.
5. On Vercel preview, check protected routes, logout/password reset, Super Admin and bank Admin, Credit Officer, approver, observer and branch-restricted accounts. Verify that RLS blocks unauthorised reads and writes, including direct API and RPC requests; hiding a button is insufficient.
6. Confirm sender identities, consent records, opt-out/suppression, campaign independent review, audit trail, task history, duplicate safeguards and no unapproved sending.
7. Restore a database snapshot in a separate non-production project, validate logs/backups/monitoring and obtain bank Risk/Compliance/data protection sign-off before handling production records.
8. Only then promote the preview branch as the internal production release. Treat **live customer broadcast** as a separate launch gate requiring signed-off policy, provider permissions, webhooks and end-to-end inbox/delivery reconciliation.

## SendGrid setup: new account

1. In SendGrid, complete account review/activation and go to **Settings → Sender Authentication → Domain Authentication**. Authenticate a bank-authorised domain by placing SendGrid's actual DNS records with the domain administrator; verify its status in SendGrid. Do **not** use another client's domain.
2. Create a restricted API key with at least Domain Authentication read access and Mail Send access for the sandbox check. Some restricted keys may not be allowed to list domains; request only the scopes needed. Do **not** paste or commit the key.
3. In Vercel project `charismfbcampaign`, add **server-only** environment variables: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (verified bank mailbox, e.g. `notifications@your-bank-domain.example`), `SENDGRID_STAFF_TEST_EMAIL` (authorised staff-owned mailbox). No `NEXT_PUBLIC_` prefix on credentials. Redeploy after changing environment variables.
4. Log in to Charis as a sender administrator and open **Administration → SendGrid setup**. First choose **Verify sender domain**. Then choose **Validate API request (no delivery)**. The latter sets SendGrid `mail_settings.sandbox_mode.enable=true`; it validates request configuration but **does not send an email**.
5. A passing diagnostic is **not** permission to use SendGrid for promotional campaigns. SendGrid **Marketing Single Sends** require marketing contacts/list synchronization, validated opt-in, opt-out and suppression across systems, explicit sender identity and audience selection, and signed event webhooks. The existing Charis delivery worker supports Resend, Brevo and Mailjet; **SendGrid is not a delivery route in this release**. The Mail Send API is not substituted for a campaign engine.
6. Before future live SendGrid sending: implement a separate, reviewed migration and adapter, API restrictions/quotas, signed webhook verification, bounce/complaint/unsubscribe reconciliation, duplicate protection and server-side bank permission enforcement. Keep both delivery flags false until accepted.

## Vercel + worker gates

Keep `EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false` and GitHub variable `CHARIS_EMAIL_WORKER_ENABLED=false`. The scheduled worker is guarded by this repository variable, but review actual GitHub settings. Secrets such as Supabase service-role key and SendGrid API key must remain server-side. Enable only after separately documented bank acceptance, not merely because a build is green.

## Known verification limits

- Release 036 source tests: see `MD/CHARIS_036_TEST_RESULTS.md`.
- This offline development environment runs Node 22; `npm ci` could not download missing dependencies, so a clean full Node 24 build, dependency-based tests, browser tests and SQL/RLS tests were **not** certified here.
- No SendGrid account key, verified sender, database service role or live user session was available. No messages or account settings were changed.
- This release has **not** been deployed to GitHub, Vercel or Supabase by the local packaging process.
