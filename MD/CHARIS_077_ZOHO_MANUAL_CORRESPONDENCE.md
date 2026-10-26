# Release 077 — Manual one-to-one Zoho client email

Charis staff can manually write to individual clients using their own authorized Zoho company mailbox. This does not convert ordinary Zoho Mail into a bulk, marketing or automated transactional provider.

## How it works
1. Verify my Zoho SMTP connection: checks mailbox login without sending.
2. Send a test email to my inbox: one real message to the same staff address configured in ZOHO_SMTP_USER. No customer contact data.
3. Write to one client: type a single client address, subject and message; review the live preview; explicitly tick the authorisation checkbox and click Confirm & Send. From/Reply-to is the actual staff Zoho mailbox.
4. The personal Zoho Mail link appears only for a Charis staff account whose email matches the private configured SMTP user.
5. Once sent, the database reservation blocks duplicate sending. Uncertain outcomes explicitly tell staff to check Zoho Sent before making another attempt.

## Vercel production variables
- ZOHO_SMTP_HOST: exact SMTP hostname from your Zoho mailbox settings; paid organisation accounts commonly use smtppro.zoho.com
- ZOHO_SMTP_PORT: 465 with SSL or 587 with STARTTLS
- ZOHO_SMTP_USER: the staff member's own Charis mailbox
- ZOHO_SMTP_APP_PASSWORD: that staff member's private Zoho app-specific password
- ZOHO_SMTP_TEST_ENABLED: true, after initial account setup
- ZOHO_SMTP_MANUAL_CLIENT_ENABLED: true, only after your self-test succeeds and SQL 077 is applied

The organisation's Zoho super administrator need not share their credentials, but may need to permit SMTP use under the organisation's email policies.

## Database migration
Apply supabase/migrations/077_charis_zoho_manual_correspondence.sql to **Charis's production Supabase**, after migration 047. This file is independent of 075. The change adds protected, staff-owned audit records and permission-checked, idempotent reservation and completion functions.

For safety, the initial limit is 20 individually composed client emails per rolling 24 hours per staff mailbox, with 60 seconds between sends. No bulk recipients or customer lists. Do not run this migration against BusinessOS.

## Verified
- Static security tests passed, including matching staff mailbox credentials and requiring final authorisation.
- An isolated PostgreSQL test confirmed SQL creation, duplicate blocking and one-time outcome recording.
- Browser tests passed at 1400, 850 and 390 pixels, including live preview and resetting authorisation after editing.
- SMTP authentication and actual arrival cannot be verified until the bank's private Zoho credentials are configured. No real messages were sent in development.
