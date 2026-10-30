# Release 081 — ZeptoMail account notifications for up to 50 customers

## Activation
1. Apply `supabase/migrations/081_charis_zeptomail_notification_batches.sql` **in the Charis Supabase project only**, AFTER 060 and 075. Back up before the change.
2. In the existing Charis Admin → Communication settings, set Maximum recipients = 50 (if lower). This setting remains an admin decision.
3. Confirm that the bank ZeptoMail sender and SMTP test are successful.
4. Set `ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED=true` in **charismfbcampaign** Vercel Production and redeploy only after SQL succeeds.
5. Create Campaign → Customer account notice → select 1–50 customers → Preview → Send → choose Zoho ZeptoMail → enter genuine bank event reference → confirm.
6. Test first with 2 authorised internal accounts, review sender logs and history, then 10, then 50.

## Scope
- Exactly one campaign submission can queue up to 50 individual private transactional notifications.
- The current worker sends up to six recipients per scheduled execution (every five minutes), not 50 simultaneous network requests.
- Uses existing secure SMTP credentials: no second Zoho API key required.
- ONLY account-related notifications with a real bank event reference. General announcements and promotions stay on other providers.
- Existing access checks, suppressions, idempotency, audit results and no automated retries of uncertain submissions are preserved.
- SMTP accepted is not proof of final delivery; inspect ZeptoMail Mail Agent logs.
- Bank Supabase is **not** accessible through the connected tools. Never run this SQL in the separate Business Platform database.
