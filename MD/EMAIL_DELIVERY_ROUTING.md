# Email delivery routing and provider safety

**Charis Communications Centre • Migration 025 • 14 October 2026**

This document is the maintenance and release guide for the multi-provider email queue. It supersedes older descriptions that assumed every recipient in a campaign used the original sender's provider. It does not certify live sending readiness.

## What is implemented

- Each eligible recipient is claimed as one durable job; the database assigns one provider and its verified sender **atomically at dispatch**.
- Provider routes, consent/suppression, monthly quota and daily provider limits are checked in the database under locks. Routing is proportional to each route's unused daily allowance. Reattempts that receive an explicit rate limit are locked to the original provider; uncertain outcomes are never retried automatically.
- One-recipient delivery with Resend, Brevo and Mailjet HTTP API adapters, including stable IDs and unsubscribe URLs. Mailjet messages use the v3.1 API.
- Resend/Brevo webhooks remain in place; a new Mailjet webhook uses separate HTTP Basic authentication or an authenticated gateway bearer token. Bounces, complaints and unsubscribes update the **shared** suppression list and per-provider reports.
- Provider settings: verified sender selection, provider permission acknowledgement, daily caps, minimum spacing, bank-wide 10,000-attempt default monthly allowance, Mailjet/Brevo sender discovery, and provider-specific delivery reports.
- GitHub Actions scheduled worker is defined at `.github/workflows/charis-delivery-worker.yml` but explicitly disabled until activated.
- The 10 editable email templates from migration 024 are unchanged. SMS remains a separate channel.

## The important sending-policy boundary

**The existing Campaign Studio is a promotional/marketing workflow.** Imported customers' bank-account status alone is NOT promotional consent; only opted-in, nonsuppressed records qualify. We do not convert a promotional campaign to a 'service' notice just to route it through a cheaper API.

Resend's `/emails` API and Brevo's `/smtp/email` API are documented as transactional delivery APIs. Migration 025 therefore restricts the *existing campaign-marketing category* to the Mailjet adapter, and only after Charis administrators have verified that Mailjet permits that precise use. Resend and Brevo routing is prepared for a future separately authorised account/service-notice workflow. **Do not represent the free transactional quotas as marketing capacity, and do not enable fake service notices to evade these rules.** Provider-native marketing integrations (Resend Broadcasts and Brevo Email Campaigns, with recipient/list synchronisation) are a distinct further development; migration 025 does not implement them. The example 100 Resend + 300 Brevo split of a promotional campaign is NOT activated by this release.

## Installation

1. Back up Supabase database and obtain approval before changing the delivery schema.
2. Ensure prior migrations `001–024` were actually applied; apply only `supabase/migrations/025_charis_multi_provider_delivery.sql` next. It changes uniqueness rules for sending domains and sender identities and updates several database functions; **do not run on an unknown or different schema**.
3. Deploy the code that accompanies migration 025 before enabling the worker, so old worker code does not interpret new delivery assignments incorrectly.
4. In Vercel, keep `EMAIL_DELIVERY_ENABLED=false` and `CHARIS_MULTI_PROVIDER_ENABLED=false` until controlled acceptance tests succeed.
5. Store `RESEND_API_KEY`, `BREVO_API_KEY`, `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_WORKER_SECRET` and provider webhook secrets in Vercel **server-only** variables; never put them in `NEXT_PUBLIC_` or Git. `MAILJET_WEBHOOK_SECRET` must be at least 32 characters and separate from `MAILJET_SECRET_KEY`.
6. In **Administration → Email Providers**, check provider connectivity; set conservative daily limits and request spacing. Connect existing active Brevo/Mailjet sender addresses (verified at the provider), and choose one approved route per provider for the permitted message category. A healthy API key is **not** evidence that the provider approves promotional broadcasts.
7. Configure webhook endpoints and verify signed/authenticated events before launch:
   - Resend: `/api/email/webhooks/resend` with `RESEND_WEBHOOK_SECRET`.
   - Brevo: `/api/email/webhooks/brevo` with `BREVO_WEBHOOK_SECRET` (Bearer secret configured at provider).
   - Mailjet: `/api/email/webhooks/mailjet` via HTTP Basic authentication, username `charis`, password `MAILJET_WEBHOOK_SECRET`. Configure the URL securely in Mailjet; never paste credentials in documentation or tickets.
8. Verify two different eligible test contacts; confirm provider selection, request spacing, suppression, audit logs, dashboard provider breakdown, bounce/complaint reconciliation and no duplicates on a repeated scheduled-worker invocation.
9. Obtain compliance/management approval for the sending purpose, verify free-plan/paid-plan limits **in each provider dashboard**, and only then set both Vercel gates to `true`.
10. For unattended sending, set GitHub repository variable `CHARIS_APP_URL=https://<your-verified-production-domain>`, variable `CHARIS_EMAIL_WORKER_ENABLED=true`, and repository secret `EMAIL_WORKER_SECRET` matching Vercel. The workflow runs every five minutes and dispatches up to three eligible jobs per run. Set the variable back to `false` to stop scheduled requests. GitHub cron timing is approximate; inspect Action failures and provider quota reports.

## Important operational behaviour

- The queue never sends to an opted-out/suppressed email address. Provider rejection, a complaint, or a bounce applies across all connected services. The worker checks the customer's current consent again when it reserves a recipient.
- `accepted` means provider acknowledgement, not inbox delivery. An HTTP timeout or ambiguous 5xx is marked `unknown`; **reconcile manually**, never click Send again without checking the provider dashboard.
- Pausing a run stops future jobs but cannot unsend an already accepted message.
- A provider route without a verified sender is unavailable. If none can be used for the run's authorised purpose, the campaign pauses; this is by design.
- Route allocations are made for each recipient when work is dispatched, not as a fixed 100/300/200 reservation at enqueue time; providers' *actual remaining* daily capacity is considered.
- Monthly budget counts attempted sends that reserve a quota, even if the remote provider later rejects them. The budget is bank-wide and independent of retired SaaS billing plans.

## Release validation and rollback

Run Node.js 24: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Run migration against a **staging copy** of the schema and test full end-to-end provider calls before production. The source ZIP is not a production validation certificate.

If deployment fails, set `EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false`, and GitHub variable `CHARIS_EMAIL_WORKER_ENABLED=false` immediately. Do not blindly down-migrate tables or erase delivery/event records. Restore an approved database backup if rollback is necessary; report accepted/unknown IDs before another send.

Official API references: https://resend.com/pricing, https://developers.brevo.com/docs/send-a-transactional-email, https://developers.brevo.com/reference/create-email-campaign, https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email and https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview.
