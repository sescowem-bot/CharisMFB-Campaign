# Charis sender settings upgrade: sender identity managed inside Charis

This update removes the need for `CHARIS_FROM_EMAIL` and `CHARIS_REPLY_TO` environment variables. The Resend API credential stays server-side in Vercel; Charis company administrators control the sender name, mailbox, verified domain, and reply-to address from **Sender settings**.

## Vercel environment variables

Keep:

```
RESEND_API_KEY=YOUR_RESEND_API_KEY
NEXT_PUBLIC_SUPABASE_URL=YOUR_CHARIS_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVER_SECRET
SINGLE_COMPANY_MODE=true
SINGLE_COMPANY_ORG_ID=YOUR_CHARIS_ORG_UUID
NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app
EMAIL_DELIVERY_ENABLED=false
```

`CHARIS_FROM_EMAIL` and `CHARIS_REPLY_TO` are no longer read by this Charis sender configuration path and may be removed. Keep `EMAIL_DELIVERY_ENABLED=false` during testing; configuration test messages to your own verified login address use the existing separate test mechanism.

## Bank administrator workflow

1. Open **Charis → Sender settings**.
2. The server calls Resend with the API key stored in Vercel, and displays only Resend domains that are **verified with sending enabled**.
3. Enter an editable sender display name, a mailbox prefix such as `campaigns`, choose one verified domain and optionally set a reply-to email.
4. Click **Save sender settings**. The server rechecks the domain with Resend and persists the identity in the existing Supabase `sending_domains` and `sender_identities` tables.
5. In a campaign, choose this active identity from the Sender dropdown. Save the campaign, use **Send test to my email**, then proceed through approval before customer delivery.
6. Use **Disable sender** to prevent future use of an identity without deleting history. To reactivate it, save the same sender address again.

## Sender and domain restrictions

- Verifying `sescoconcept.name.ng` only permits From addresses **on that domain**, such as `campaigns@sescoconcept.name.ng`. It does not authorize sending From `salemmedicals.com`.
- `salemmedicals.com` can be used as a From domain only if **that same domain is verified and enabled on the Resend account attached to Charis's `RESEND_API_KEY`**. A working medical-system sender on another key is not evidence that it is connected to Charis.
- For production banking communications, obtain the bank's authorization and use an official Charis sender domain rather than the developer's or medical laboratory's domain.
- Domain verification is a one-time provider/DNS requirement. It cannot be bypassed simply because `RESEND_API_KEY` is configured.
- Sender names and reply-to addresses must be used only with business authorization. Company admins manage senders; routine employees cannot edit sending identity.

## Database and deployment

No new SQL migration is required **if existing Charis migrations 001–017 were installed**. This update uses the already existing sender tables, verification record and permission RPC.

Apply the changed files in the provided patch to your current codebase, run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` under Node.js 24, and deploy. Then test saving a sender, sending one internal configuration test, sending a campaign test, approvals, and a permitted customer send.

## Security and availability

- The API key and service-role key never appear in browser JavaScript.
- Server checks both a verified Charis user and `can_manage_senders` before making provider calls or using the database service client.
- The admin-provided domain is checked against Resend's domain listing and then checked again via Resend's domain detail API when saving.
- Saving a sender only stores an identity and enables Resend. It does not disable marketing consent, approval or delivery safeguards.
- A full production build and a real Resend connection were not completed in this environment. Verify them after deployment.
