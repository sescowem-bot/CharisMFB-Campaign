# Release 082 — Charis 500 recipients, sequenced in groups of 50

The 500-recipient feature uses existing Create Campaign, audit records, permission checks, safe SMTP settings, suppression rules and the server-side delivery worker.

## Prerequisites and activation
- Apply migrations 047, 055, 060, 075, and 081 (if not already applied) in the real Charis Supabase database.
- Back up first and apply `supabase/migrations/082_charis_500_recipient_batches.sql` in the **Charis** database, NEVER the connected Business Platform database.
- In Administration → Communication settings choose up to 500 recipients per campaign and an authorised daily ceiling from 500 to 10000.
- ZeptoMail transactional batches are **disabled** unless the independent environment variable `ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED=true` is set. Leave it off until all database and SMTP tests pass.
- First test with 2 bank-authorised recipients; then 10, 50 and only after reviewing statuses submit a 500-recipient notification.
- This does not bypass provider sending-rate or acceptable-use limits.

## Processing semantics
- One campaign submission atomically reserves a maximum of 500 eligible distinct recipients.
- Before commit, recipient rows are assigned delivery_batch 1..10, 50 per group. Later groups wait for earlier groups to have no pending/sending recipients.
- The worker still submits at most **six** emails per execution, on its existing schedule. Thus 50 is a **logical group size**, not 50 concurrent SMTP requests or a guaranteed short delivery time.
- SMTP acceptance is not final inbox delivery. Unknown SMTP outcomes pause the campaign and require manual reconciliation, never blind replay.
- Manual ZeptoMail notices use the existing independent SQL 079 limits (20/day, 1-minute gap); campaign batching is separate.

## Identity and governance
- A confirmed Platform Super Admin, or bank-authorised Mail Agent administrator with bank communication permission, may send irrespective of login email domain. The FROM address remains restricted to the verified Charis bank domain by the SMTP library.
- To add another Charis Company Admin use the existing staff invitation workflow, then assign bank permissions. Do not grant global Platform Super Admin merely based on an email address.
- No Charis Supabase database is available through the connected account; this release does not execute SQL or send customer emails.
