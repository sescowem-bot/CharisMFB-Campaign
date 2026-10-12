# Charis Campaign Centre — new Supabase project setup

**New and empty database only.** This replaces the old SESCO 001–014 master PLUS Charis migration 015 for a completely separate Supabase project. The app still retains some legacy multi-company tables internally, but the configured UI operates only on the dedicated Charis workspace.

## A. Create the dedicated Supabase project

1. Create a new project under the bank-owned Supabase organization/account where possible. Choose an appropriate database region, strong database password, and store credentials in a bank-controlled password manager.
2. Go to **Supabase > SQL Editor > New query**.
3. Open `Charis_Complete_Fresh_Supabase_SQL.sql`, copy **the entire contents**, and click **Run** once.
4. The final result returns `charis_organization_id`. Copy the UUID into your app configuration as `SINGLE_COMPANY_ORG_ID`. You can retrieve it again by running the `Charis_Install_Verification.sql` query.
5. Do **not** rerun the older `SESCO_Complete_Fresh_Install.sql` or migration 015 afterward. If this script errors, copy the exact error before trying anything else. The main schema installation is transactional.

## B. Create your first authorized admin

1. In Supabase **Authentication > URL Configuration**, set the correct app site URL and add its precise `https://YOUR-APP.vercel.app/auth/callback` redirect (plus local `http://localhost:3000/auth/callback` if testing locally).
2. Configure reliable confirmation email delivery. Disable public sign-up after creating authorized identities if the bank does not want arbitrary account registrations. Do not disable authentication itself.
3. Sign up with your own email on the Charis app (or use the Supabase Authentication dashboard to invite the account) and **verify the email**.
4. Open `Charis_First_Admin_Bootstrap.sql`, replace `REPLACE_WITH_YOUR_VERIFIED_EMAIL` with the **real verified address**, then execute it once as project admin in SQL Editor.
5. This grants platform `super_admin` + membership `company_admin` to the verified first administrator. Never use that role for ordinary marketers. Add other approved employees through the application team-management UI or a separately reviewed admin SQL process.
6. Independent campaign approval in the normal Charis workspace requires **a different authorized person** from the campaign creator, even for this first administrator. Do not try to bypass that security control during the pitch.

## C. Link the upgraded app to the NEW project

Use these Vercel/local environment variables (values are placeholders, NOT real credentials):

```dotenv
SINGLE_COMPANY_MODE=true
SINGLE_COMPANY_ORG_ID=UUID_FROM_INSTALL_RESULT
NEXT_PUBLIC_APP_URL=https://YOUR-CHARIS-APP.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-NEW-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_NEW_PROJECT_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_NEW_PROJECT_SERVER_SECRET_KEY
RESEND_API_KEY=
BREVO_API_KEY=
EMAIL_WORKER_SECRET=RANDOM_SECRET_AT_LEAST_32_CHARACTERS
EMAIL_DELIVERY_ENABLED=false
```

**New Supabase key guidance (October 2026):** Supabase is moving to `sb_publishable_...` (client) and `sb_secret_...` (server). Even though the current code has older variable NAMES `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, it accepts the corresponding new publishable and secret key *values*. Keep the secret key only in server environment variables; never use `NEXT_PUBLIC_` for it and never put it into GitHub.

## D. Configure delivery before a real send

1. In Charis administrator settings, enable the chosen provider (Resend or Brevo), configure its server-only API key, register/verify the bank-approved sending domain, and create a verified sender identity.
2. Set the genuine bank postal contact address in organization branding; the application requires it for campaign approval.
3. The seeded Charis internal allowance is **10,000 emails per UTC month**. This is a configurable system limit, not the actual Resend/Brevo quota or a promise of delivery. The provider's initial system daily budget is more conservative, and actual plan limits may be lower.
4. Import only fictional/internal test contacts first. Existing import logic marks marketing consent as **unknown** by default, so you must record real permission/evidence through the authorized contact workflow before sending marketing.
5. Verify all staff roles, audience selection, independent review, queuing, provider worker, webhook events, suppressions and opt-outs. Configure the external worker schedule separately; SQL does NOT configure it.
6. Only after the bank authorizes sending and live internal test acceptance succeeds should you deliberately change `EMAIL_DELIVERY_ENABLED=true` and deploy those settings.

## E. Run tests and verify

1. Run the read-only `Charis_Install_Verification.sql` in SQL Editor. Expect one active Charis organization, one active internal allowance and three `true` function flags.
2. Install/use **Node 24** then run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` in the extracted project.
3. Sign in as Charis admin, confirm the single-company dashboard, create one consented test contact, create a campaign to that one recipient, have a different authorized reviewer approve it, then test real sending only after provider configuration and bank approval.
4. Do not populate with real bank customer exports without approved data-processing, access, retention, and bank security arrangements.

## Scope and testing limitation

The bundled source implements **email** sending via its provider and worker, not SMS or WhatsApp. This consolidated SQL was assembled from the existing migration files and checked for transaction structure and installation objects; it has NOT been executed against your new hosted Supabase project in this environment. Apply it to a fresh test project first. The original schema includes an internal owner workspace for legacy compatibility; the Charis-facing organization is a separate row with slug `charis-mfb`.
