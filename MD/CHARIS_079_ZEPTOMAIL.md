# Release 079: Charis ZeptoMail transactional integration

ZeptoMail uses a separate Mail Agent and credentials from a normal Zoho Mail mailbox. An existing Zoho Mail subscription does not by itself establish that a Mail Agent is active and a sending domain is verified.

The new ZeptoMail provider card and ZeptoMail Notices page support secure connection verification, one-message staff self-testing, and (only when explicitly activated) a single, human-confirmed transactional notice linked to a specific loan, account request, payment receipt, or support request.

This is deliberately **not** a general/bulk awareness campaign provider. Do not use ZeptoMail for generic group messages, 50/100-recipient promotional batches or newsletters. Use the existing approved bulk-campaign providers for those messages.

## Bank setup
1. Open https://zeptomail.zoho.com and choose the Charis Mail Agent.
2. Confirm that the charismfb.com domain and the selected bank sender are verified in that Agent.
3. Under Mail Agents > SMTP/API, obtain the SMTP username and password/token. The SMTP username may be emailapikey, or an account-specific sender address, as specified by the Agent. Ordinary Zoho Mail app passwords do NOT apply here.
4. Set these Vercel Production **server-only** variables, leaving all secrets out of source control:
   - ZEPTOMAIL_FROM_EMAIL: approved and verified Charis sender at charismfb.com
   - ZEPTOMAIL_SMTP_USERNAME: SMTP user from your Mail Agent, often emailapikey
   - ZEPTOMAIL_SMTP_PASSWORD: the private Agent SMTP password
   - ZEPTOMAIL_SMTP_PORT: 465 SSL or 587 STARTTLS
   - ZEPTOMAIL_TEST_ENABLED: true
5. Redeploy once and sign in as authorised Charis communications staff. Go to /dashboard/zeptomail and verify SMTP, then send exactly one test to your own bank inbox.
6. Once verified, run supabase/migrations/079_charis_zeptomail_transactional.sql in the CHARIS production Supabase database (after migration 047). This is independent of migrations 075 and 077. Do not run it in BusinessOS.
7. Only after the tests and SQL are complete, set ZEPTOMAIL_TRANSACTIONAL_ENABLED=true in Vercel Production and redeploy. This enables customer-specific, individually confirmed bank transactional notices.

## Safety
- Staff login, active Charis workspace and existing communications permission on all server actions.
- Sender must be at charismfb.com and accepted by the bank Mail Agent; TLS SMTP host fixed to smtp.zeptomail.com.
- One recipient per action, specific event reference, approved transactional purpose, and explicit confirmation.
- Separate authenticated, row-secured audit table; atomic nonce reservation; duplicate prevention; 60-second interval and 20 sends per 24 hours per staff member.
- Provider SMTP acceptance is not confirmed inbox delivery. When the outcome is uncertain, check ZeptoMail Mail Agent logs before retrying.
- No configuration or changes to existing Resend, Brevo, Mailjet, SendGrid, or Zoho staff mailbox delivery.
- The production Mail Agent cannot be verified or used without its private SMTP credentials.
