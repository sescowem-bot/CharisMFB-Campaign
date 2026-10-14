# Setup and deployment

## Prerequisites
- Node.js 24 and npm.
- Charis project in Supabase, with existing migrations accounted for.
- Vercel project linked to the correct GitHub repository.
- Approved Resend account/key and a verified, authorised sending domain.

## Environment variables
Use `.env.charis.example` for the exact names. Principal settings:

```dotenv
SINGLE_COMPANY_MODE=true
SINGLE_COMPANY_ORG_ID=YOUR_CHARIS_ORG_UUID
NEXT_PUBLIC_APP_URL=https://your-charis-site.example
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVER_SECRET
RESEND_API_KEY=SERVER_SECRET
EMAIL_WORKER_SECRET=LONG_RANDOM_SECRET
EMAIL_DELIVERY_ENABLED=false
```

The Supabase URL and publishable key are intentionally browser-accessible; service-role and Resend keys must never have `NEXT_PUBLIC_` prefixes. The sender email is configured inside Charis against an already verified and connected domain; don't hardcode sender identity in the deployment. Never share live keys or save `.env.local` to Git.

## Database
SQL history lives in `supabase/migrations/` and includes **001–022**. Back up the existing Supabase project, verify applied migrations and run **only missing migrations in ascending order**, followed by a check of permissions, Auth and customer tables. Previous fresh-install SQL is not a live upgrade method. Optional diagnostic SQL is in `supabase/diagnostics/`.

## Build and release
```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Check Vercel's Node.js version, environment-scoped settings and deployment logs. Configure Supabase Auth Site URL and approved callback/reset URLs. Use the supported HTTPS origin, check session refresh and sign out, and ensure the same Charis organisation ID is used across application and database.

## Sending
Use an already verified sending domain accessible to the Resend key; do not create new domains repeatedly. Staff can choose an approved sender identity in Charis. Before enabling live delivery, test with two distinct authorised staff accounts, a small consented test audience, suppression handling, reviewer separation, webhook processing and the scheduled secure worker. Start with delivery disabled and enable only with the bank's approval.

## Rollback and backups
Keep the previous working Git commit, a timestamped database backup, evidence of applied migrations and the deployment ID. Database migrations are not assumed to be reversible. Never drop the database or overwrite bank customer records to fix a page-layout issue.

## Provider connection: Resend, Brevo and Mailjet (Migration 024)
- Run Migration 024 after 023. It registers Mailjet **disabled**, adds a Charis-only provider administration RPC and does not change existing campaign delivery.
- In Vercel add `RESEND_API_KEY`, `BREVO_API_KEY` and for Mailjet `MAILJET_API_KEY` and `MAILJET_SECRET_KEY`. Store each only as server secrets. Do **not** expose them with `NEXT_PUBLIC_`.
- Brevo: the API key comes from **SMTP & API → API keys & MCP**, not the SMTP key. The SMTP IP restriction does not apply to the HTTP API integration, although Brevo API access and sender/account checks still apply.
- Mailjet: generate both API key and Secret Key in Mailjet. Verify an authorised sender/domain within Mailjet.
- Visit **Admin → Email providers** to check the connection; green health is only proof that credentials can reach the provider, not permission for marketing or evidence of delivery.
- Customer broadcasting stays OFF until provider-specific marketing approval, sender verification, global unsubscribe/suppression, secure webhooks, quota reconciliation and scheduled worker acceptance are verified. Never redistribute a rejected or uncertain message to bypass an account restriction.
- The email Template Library offers 10 editable starter designs. Select one, review wording, change any example information and save a draft. Verify product information before sending.
- Existing Charis campaign runs still use one verified provider per campaign. Multi-provider recipient splitting is a separate release requiring atomic per-recipient provider assignment and reconciliation; do not claim it is active after 024.

- SMS is not routed through these email providers. It continues as a separate controlled Termii pilot in Migration 023.
