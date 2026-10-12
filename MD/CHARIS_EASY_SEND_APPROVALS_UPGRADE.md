# Charis Campaign Centre — Simplified Resend, Campaign Testing and Approval Inbox

This upgrade is for the dedicated Charis Microfinance Bank workspace. Staff should never visit Supabase or Resend to create and review ordinary campaigns.

## What changed

- **Sender settings:** Charis administrators get one "Connect verified Resend sender" action, using the `RESEND_API_KEY` held securely in Vercel. The screen no longer requires entering a domain ID or manually copying DNS verification records.
- **Provider verification:** The app looks up the exact domain in the sender email configured through Vercel, confirms the provider says the domain is verified and sending is enabled, and then saves the sender. It will not invent a sender or bypass provider verification.
- **Campaign tests:** A saved campaign can send a real **Test to my email** to the signed-in administrator's verified login email. No customer receives this test, and no approval is changed. The test remains rate-limited and audited.
- **Approval inbox:** A new **Approvals** menu shows campaigns awaiting review with **Approve** and **Reject** actions. An editor cannot approve a campaign they edited or submitted. Reviewers can inspect campaign preview and recipient count.
- **Sending:** After independent approval, open the campaign and select **Send approved campaign**. For immediate, unscheduled Charis campaigns, the app queues the recipient snapshot and attempts the first due email right away. The **Send & delivery** page shows statuses and permits controlled next-recipient dispatch. Bulk/ongoing delivery still requires a scheduled worker.
- **No altered marketing permissions:** opt-in consent, unsubscribe and suppression checks remain enforced for real customers.

## Install on the existing Charis Supabase project

1. Back up your Supabase project.
2. Run `supabase/migrations/017_charis_resend_review_and_test.sql` **once** through the Supabase SQL Editor, after the earlier 001–015 migrations. This is an incremental upgrade; do not rerun the fresh-install SQL.
3. Apply the source code files to the latest Charis GitHub checkout. Review diffs before committing. Push to `main` once approved.
4. Add or review these **server** environment variables in Vercel:

```dotenv
RESEND_API_KEY=YOUR_EXISTING_RESEND_API_KEY
CHARIS_FROM_EMAIL=campaigns@YOUR_VERIFIED_AUTHORISED_SENDING_DOMAIN
CHARIS_REPLY_TO=reply@YOUR_VERIFIED_AUTHORISED_SENDING_DOMAIN
EMAIL_DELIVERY_ENABLED=false
```

`CHARIS_REPLY_TO` is optional and defaults to `CHARIS_FROM_EMAIL`. Keep your existing `SINGLE_COMPANY_MODE=true`, `SINGLE_COMPANY_ORG_ID=<charis uuid>`, `NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app`, Supabase URL and keys. Do not add `NEXT_PUBLIC_` to the Resend or Supabase service secret.

5. Redeploy after updating Vercel variables. Open **Charis → Sender settings → Connect verified Resend sender**. If Resend already has your bank-authorised domain verified and enabled in that account, this is a one-click operation. If the domain is not yet verified in that Resend account, someone who manages the bank's DNS must verify it **once** with Resend. The API key alone is not sufficient for production sending.
6. In **Brand settings**, save a genuine Charis postal address; it is required for approval/test/footer compliance. The system must not invent one.
7. For a safe demonstration, keep `EMAIL_DELIVERY_ENABLED=false`. Create a saved campaign (choose "All eligible" if there are no opted-in customers yet), pick the connected sender and click **Send test to my email**. It sends only to your verified account address. Check acceptance in the Resend dashboard.
8. When Charis authorises a real campaign, set `EMAIL_DELIVERY_ENABLED=true`, then save a draft, select **Submit for review**, sign in using a **different authorised Approver** user, open **Approvals**, click **Approve** or **Reject**, return to the approved campaign and click **Send approved campaign**.
9. For a one-recipient, due-now approved campaign, the first email is dispatched immediately. For larger groups, set up an unattended worker invoking `POST /api/worker/delivery` with `Authorization: Bearer $EMAIL_WORKER_SECRET` on a schedule. Without a worker, remaining recipients stay queued; do not present queued as delivered.

## Important design constraints

- The new Resend sender configuration does not require customers to enter a domain ID. It intentionally **does not automatically register/verify a new domain**.
- Resend API keys are secret and must be read from Vercel only on the server.
- Company staff should not use a developer-owned sender domain as Charis's official communications identity without the bank's written approval.
- An independent approver is still required for customer campaigns. A company admin can create a campaign, but cannot approve their own edited/submitted campaign.
- The provider acknowledgement (`accepted`) is not proof an email reached the inbox.

## Validation status

15 focused local project tests passed, and all 122 TypeScript/TSX files passed syntax parsing. A full build and real Supabase/Resend integration test were not possible in the available environment (Node 22; the repository requires Node 24, and cached dependencies were incomplete). Do not call this a production-ready integration until Vercel build, SQL migration, sender verification, login, test email, reviewer actions, queue and worker are tested.
