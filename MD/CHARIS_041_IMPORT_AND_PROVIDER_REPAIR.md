# Charis Campaign Centre — Release 041

**Scope:** Fix Vercel JSX error, make Mailjet webhook prerequisites understandable, and require recorded prior marketing consent during contact imports. Preserve Release 040 Resend broadcasts. **No customer email is sent by installing this release.**

## Changes

1. `components/provider-route-form.tsx`: correct the unescaped apostrophe that blocked Vercel lint; label provider routes according to their actual purpose. Resend remains eligible for an approved marketing Broadcast route, while the old multi-provider worker remains separate.
2. `app/admin/providers/page.tsx`: explain Mailjet's existing webhook endpoint and identify `MAILJET_WEBHOOK_SECRET` as the missing configuration when absent. Optional Brevo/Mailjet route controls are collapsed to reduce clutter. No webhook credentials appear in the UI.
3. `app/api/contacts/import/route.ts` and `components/contact-import-wizard.tsx`: require proof-of-prior-consent source/date/reference, consent scope, and an explicit importer acknowledgement. The server uses the new protected SQL RPC. Contact columns alone never serve as evidence of consent.
4. SQL `041_charis_documented_optin_imports.sql`: add separate per-contact import permission evidence, retain idempotent batch processing and import exceptions, skip emails on the bank suppression list, and never update existing declined/unsubscribed customer records. Old imported customers are not silently opted back in.
5. Correct-and-retry on the Import Review page also requires documented prior permission and cannot override a suppressed address.

### Important consent semantics

- `all_marketing`: only **newly imported, unsuppressed email contacts** with attested existing permission may be marked `consent_status='granted'`; older opt-outs are not modified. This scope requires genuine evidence that each imported contact consented to broad Charis promotions, not merely that they have a bank account.
- `product_specific`: records evidence that a customer opted in for a named service but **does not mark the contact eligible for general broadcasts**. Product-specific campaign eligibility and SendGrid/Resend topic synchronization are separate future work. Do not send generic campaigns to this group until verified scope-aware filtering exists.
- Phone-only contact imports do not automatically opt a customer into SMS. Existing same-phone declined contacts remain untouched, but this release does not implement a cross-provider SMS suppression registry.
- Existing contacts are skipped rather than overwritten. A separate, evidence-backed re-consent process is needed to change a prior `unknown` or `denied` status; a re-upload does not silently restore consent.
- Imports are for previously consented marketing contacts. For account servicing without promotional consent, use the protected manual customer workflow rather than falsely recording promotional opt-in.

## Mailjet: existing callback (not a new SQL migration)

- Callback: `https://charismfbcampaign.vercel.app/api/email/webhooks/mailjet`
- Vercel server variables (Production): `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_WEBHOOK_SECRET` (at least 32 characters).
- Register the callback in **Mailjet → Event Tracking** for sent, bounced, blocked, spam and unsubscribed events (as supported by the account), with HTTP Basic authentication. The existing Charis handler expects username `charis` and the private webhook secret as password. Configure the secret in Mailjet's secured settings; avoid sharing it in support messages or browser screenshots. This is a **delivery event receiver**, not a mechanism for sending messages.
- Provider can remain disabled while Resend is the selected marketing provider. A webhook callback does not mean Mailjet credentials or domain verification have succeeded.

## Sending settings

- `CHARIS_MULTI_PROVIDER_ENABLED=false`: disables the older scheduled routing worker; it does not disable the separate Release 040 Resend Broadcast integration.
- `EMAIL_DELIVERY_ENABLED` and `CHARIS_RESEND_BROADCASTS_ENABLED` control whether the authorised Resend Broadcast route can submit. Do not turn them on solely to fix a build or import issue.
- Resend Broadcasts require an enabled verified Resend marketing route, an approved campaign, recipient opt-ins, suppression checks, compliance approval and a valid `NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app`.

## Installation order

1. Back up Supabase and the GitHub checkout. Confirm existing migrations through 040, especially the Release 040 Resend route, have been applied. Do **not** rerun any successful earlier migration.
2. Run `supabase/migrations/041_charis_documented_optin_imports.sql` in a staging Supabase database; review the result, then apply to production. It is additive and does not change existing consent statuses.
3. Run `supabase/verification/041_verify_documented_imports.sql` (read-only). The table and RPC should be present.
4. Merge the 041 PATCH into the current GitHub checkout (baseline commit `02c672495b2f8a2d25b643b59591ca01c286de9b`). Inspect `git diff`, then run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` on **Node 24**.
5. Deploy Vercel preview first and validate a test import with an authorised, non-customer internal address, documented evidence, a duplicate, and a suppressed email. Ensure an opt-out is not re-granted.
6. Review the real SendGrid/Resend/Mailjet provider configurations independently; no automatic provider switching or live customer send is performed by this release.

## Verification limitations

- Focused source tests and TypeScript/TSX syntax checks pass in the preparation environment.
- Full Node 24 + Next.js build, actual Supabase execution and live provider event/delivery integration are **not verified here**. This environment lacks the project's installed dependencies.
- An API key being configured is not evidence of account approval, message acceptance or actual inbox delivery.

## Rollback

Revert the UI/server route code if a release regression occurs, leave delivery disabled, and retain the additive evidence table and audit records. Never reset contact opt-outs or mailing suppression records to recover an import workflow.
