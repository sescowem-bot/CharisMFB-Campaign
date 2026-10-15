# Charis Release 040 — Resend promotional broadcasts inside Charis

This is a new **integration candidate**, not a live-production certificate. No real emails have been sent or Supabase changes applied during preparation.

## Root cause

Previously, even with Resend enabled, `charis_email_route_save` permitted marketing routes for **Mailjet only**. The existing worker's Resend `/emails` adapter is for transactional messages and does not implement promotional Broadcasts. The Campaign page always offered the old queue. Enabling a Vercel delivery flag did not fix either limitation.

## What this update does

- Adds an integrated Resend Broadcasts send form to an **independently approved promotional campaign** when its sender uses a verified, connected Resend domain.
- Saves an immutable, consent-filtered recipient snapshot using the existing `campaign_enqueue` database function, then holds it out of the old per-email worker.
- Reads bank consent and suppression records again before synchronizing a campaign-specific Resend Segment.
- Checks Resend's global unsubscribe state for each address. It does **not** reactivate unsubscribed provider contacts.
- Sends by creating a Resend Broadcast **draft** and explicitly submitting it once via `/broadcasts/:id/send`. Ambiguous network responses are never blindly retried.
- Displays the Broadcast submission state on the existing Charis Delivery page. The system does **not** claim a Broadcast was delivered just because Resend accepted it.
- Keeps Resend marketing out of the transactional `/emails` worker.

## Installation prerequisites

1. Confirm existing migrations **001–039** (especially **039**) are installed, then back up Supabase. Never replay them as a full new installer.
2. Run `supabase/migrations/040_charis_resend_marketing_broadcasts.sql` only once in Supabase SQL Editor. Apply it to staging first.
3. Merge the 040 patch into the repository; verify Git changes before committing.
4. Use **Node 24** and execute `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` on CI. Validate the *actual Vercel preview build* before production.
5. In Vercel Production environment configure, **without pasting secrets into chat**:

```dotenv
NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app
SINGLE_COMPANY_ORG_ID=<existing Charis UUID>
RESEND_API_KEY=<secret server-side Resend API key>
EMAIL_DELIVERY_ENABLED=false
CHARIS_RESEND_BROADCASTS_ENABLED=false
CHARIS_MULTI_PROVIDER_ENABLED=false
```

Initially keep the two sending flags false. After domain and policy checks, a bank-authorised operator can set `EMAIL_DELIVERY_ENABLED=true` and `CHARIS_RESEND_BROADCASTS_ENABLED=true` **together** and redeploy. Keep `CHARIS_MULTI_PROVIDER_ENABLED=false` until the separate legacy worker is reviewed.

6. In Charis **Administration → Email Providers → Resend**, enable the Resend provider, choose the correct verified, Charis-connected sender and set **Permitted message type = Opted-in promotional campaigns**; confirm provider policy and activate the route.
7. A campaign must have an approved bank mailing address, opted-in recipient list, verified sender, independent approval, and `requested_send_at = NULL` (immediate send only in 040). The operator must possess `campaigns.send`.
8. Use a *new* campaign approved for **one authorised, explicitly opted-in mailbox** to prove real sending inside Charis. Obtain bank Compliance/DPO approval to sync these email addresses to Resend. Reconcile its provider Broadcast ID and actual inbox delivery, unsubscribe, and suppression outcomes before expanding.

## Operational limits and remaining gates

- Maximum **50 unique approved recipients per campaign**, intentionally capped in database for the first controlled rollout. This is **not** a large-scale sender.
- Broadcast status in Charis means **submitted to provider**, not independently confirmed delivered. Per-recipient delivery outcomes, Resend Broadcast webhook reconciliation and ongoing provider suppression reconciliation still require a separate verified integration before large-volume operation.
- No automated future scheduling because customer preferences might change before dispatch. User can send an approved, immediate campaign.
- If a Broadcast submission is uncertain, a second click cannot resend it. Investigate the provider's account using the saved Broadcast ID and resolve manually.
- Marketing mail and account/credit reminders must remain separate. Resend's current AUP prohibits various debt-collection and short-term/payday-loan content; do not route those workflows through this marketing integration.
- Existing customers, role permissions, historical migrations, the SendGrid diagnostic page and existing Resend sender configurations are preserved.
- **Do not enable real customer sending** until the full Node 24 build, SQL installation, database security and bank compliance checks pass.
