# Charis Release 083 — Select any notification category, restrict old test senders

## What changed
- Create Campaign allows selecting the Zoho service for General notice, Service update, and Customer account notice, provided individually selected customers have a genuine transactional event/request. Category does not itself grant ZeptoMail eligibility: general broadcasts, advertisements, mass newsletters and marketing remain prohibited.
- Every ZeptoMail campaign still requires a real bank event reference (4–120 characters), explicit staff confirmation, valid bank sending rights, 1–500 distinct recipients, privacy checks, and the existing 50-recipient grouping.
- The new SQL 083 adds an audited confirmation column and updates the 081 RPC/constraint. Old SQL 081/082 remain unchanged. SQL 083 must be applied **after** 081 and 082 in the Charis Supabase project (never Business Platform). The Zoho provider option remains inactive until 083 is installed and `ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED=true` has been explicitly set by the bank.
- Charis sender lists now display only verified and bank-owned `charismfb.com` sender mailboxes (or approved subdomains). The worker also rejects legacy nonbank FROM identities, even if an old sender selection remains in database preferences. This does not restrict the operator's confirmed login email and does not erase or alter old delivery history.

## Before activation
1. Confirm SQL 081 and 082 were successfully applied in the actual Charis Supabase database and backed up.
2. Apply `supabase/migrations/083_charis_zeptomail_category_policy.sql` in Charis and verify the new `zepto_transactional_acknowledged` column and refreshed check/RPC.
3. Verify `noreply@charismfb.com` in Zoho, confirm the delivery worker, and test a single internal transactional notice using an authorised bank account.
4. Confirm legacy test sender identities are disabled/archived by an authorised Charis administrator; the code only hides and blocks them, leaving audit records intact. Do not delete historical communications.
5. Only after readiness is confirmed enable Production `ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED=true`, redeploy and test two approved internal recipients, then 10, then larger volumes.

## Important
Zoho CPaaS (formerly ZeptoMail) is a transactional delivery service, not a general bulk announcement tool. Reclassifying an email as a service notice does not override the provider's acceptable-use policy. The bank must enforce actual purpose and receipt/notification eligibility. No customer emails were sent in this release.
