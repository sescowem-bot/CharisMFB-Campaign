# Charis 051 — Verified Email Resubscription & Delegated Access

## User-facing workflows

- Customer: **/subscribe** → enter email → receives single transactional confirmation email → **/subscribe/confirm?token=…** → confirms → Charis records fresh consent → **/subscribe/complete** → optional link to official bank website.
- Old Charis unsubscribe/confirmation pages now include a **Subscribe again** link.
- Admin: **/admin/subscriptions** → view recent unsubscribed customers or search exact email → send a confirmation invitation **only when the customer requests it** → assign selected staff **View subscriptions** and/or **Send invitations**.
- Delegated bank-wide staff with View permission can open the subscriptions area from Communications. They cannot assign roles.
- No administrator can silently re-subscribe a customer. Only the mailbox holder can confirm. Branch-limited staff do not get bank-wide visibility through this feature.

## Consent, security and delivery

- Email tokens are 256-bit random, stored in the database as SHA-256 hashes, and expire after 30 minutes.
- The public API always shows generic request confirmation, regardless of whether an account exists.
- Maximum one confirmation invitation per known email every 30 minutes, up to three per 24 hours. This applies to admin requests too.
- New verified consent is recorded with evidence, timestamp, event history and customer ID.
- Only `unsubscribe` suppression entries can be cleared by verified re-consent; complaint/bounce/blocked entries are not cleared.
- The Resend Contacts API synchronises the current unsubscribe status. Failed synchronisation can be retried by the configured worker. The latest preference revision wins.
- Resend contact `not_found` is distinguished from accepted provider synchronisation. Older Broadcast unsubscribes made entirely in Resend might not yet appear in Charis until reconciled.
- Verification messages are sent through **one** admin-configured verified service email provider, with no unsafe failover after uncertain sending. A provider acceptance is not proof of inbox delivery.
- Old Resend Broadcast links still use Resend's hosted unsubscribe page. This release does not rewrite previously sent messages.

## Deployment order

1. Back up the active Charis Supabase database and current GitHub project.
2. Ensure migrations 047, 049 and 050 are installed and working. Do not rerun earlier migrations blindly.
3. Run **supabase/migrations/051_charis_verified_resubscription.sql** in the same Supabase project. This is an additive migration and includes a targeted replacement of the Release 050 unsubscribe function so the sync queue always reflects the last preference.
4. Run **supabase/verification/051_charis_subscriptions_readonly.sql**. All seven installation checks should show `true`.
5. Preserve the existing Vercel variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SINGLE_COMPANY_ORG_ID`, `NEXT_PUBLIC_APP_URL`, verified sender settings and provider API key(s). `NEXT_PUBLIC_APP_URL` must be the app's bare HTTPS origin. `CHARIS_PUBLIC_PREFERENCES_ORIGIN` is optional, and only if that hostname serves these routes.
6. Confirm **Brand & Media → Website URL** points to Charis's public bank website for the return button.
7. Merge code with the current GitHub branch, using Node 24. Run `npm ci && npm run lint && npm run typecheck && npm test && npm run build` and resolve any failures before deploying. Do not copy over `.git`, local `.env*`, or newer repository edits without review.
8. Confirm Vercel deployment is Ready. Visit `/subscribe` and `/admin/subscriptions` only with the appropriate access. Test with an authorised internal mailbox that explicitly requested re-subscription. Confirm a valid request is delivered, confirmation is required, database evidence exists, no prior bounce suppression was cleared, and the latest preference synchronises to Resend.
9. Do not trigger or repeat a real bank broadcast merely to test this migration. Do not expose API keys in frontend code.

## Known verification limitations

The new Release 051 source-focused tests passed and source syntax was parsed. The complete production Next.js build and live Supabase migration were **not** executed here. The environment uses Node 22 and does not have the application's npm dependencies available; 13 old tests are blocked by missing dependencies/Node 24 requirements. Results from production must be inspected before enabling customer activity.
