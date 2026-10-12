# Charis Campaign Centre

**A dedicated internal customer communication platform for Charis Microfinance Bank.**

This application is for one bank. The portal supports staff sign-in, individual and group recipient selection, contact imports, controlled email campaigns, sender management, reusable templates, delivery tracking, reports, role management and audit logs. The current version **does not** send SMS or WhatsApp messages.

## Setup

1. Run Node.js **24.x** and `npm ci`.
2. Create a dedicated Charis Supabase project.
3. For a **new empty database**, execute `supabase/Charis_Complete_Fresh_Install.sql` **once**, then bootstrap the first verified bank administrator using `supabase/Charis_First_Admin_Bootstrap.sql`.
4. For an **already installed** Charis database, use the separate `Charis_Brand_Correction_Existing_Supabase.sql` supplied with the branding release. Never rerun the fresh-install SQL on an existing database.
5. Add Vercel environment variables from `.env.charis.example`, particularly `SINGLE_COMPANY_MODE=true` and the UUID of the `charis-mfb` organisation as `SINGLE_COMPANY_ORG_ID`.
6. Optionally set `CHARIS_LOGO_URL` to a verified bank-provided HTTPS logo URL. Otherwise a clean monogram appears.
7. Run `npm run typecheck`, `npm test`, and `npm run build`. Verify contacts, campaign workflows, sender identity, permissions and delivery using approved internal test addresses.

## Staff navigation

Dashboard · Create campaign · Campaigns · Customers · Import contacts · Saved groups · Delivery · Reports · Templates · Branding · Email footers · Senders · Team access.

Subscription sales, billing and public self-registration are disabled in dedicated Charis mode. Generic multi-tenant database structures remain for compatibility with the existing delivery/role functions, but bank users cannot switch organisations in the supported interface.

## Deployment and security

- Set `EMAIL_DELIVERY_ENABLED=false` until a verified sender, worker schedule, approval policy, authorised contacts and delivery callback handling have been tested.
- Do not commit Vercel secrets, Supabase service credentials or provider API keys.
- The bank must approve actual branding, privacy/legal notices, customer communication consent and staff access arrangements before production rollout.
- To make registration invitation-only, disable public sign-ups in the Supabase Authentication settings; hiding registration pages alone is insufficient.

See [Charis branding release notes](MD/CHARIS_BRANDING_RELEASE.md) and the archived engineering documentation in `MD/`.
