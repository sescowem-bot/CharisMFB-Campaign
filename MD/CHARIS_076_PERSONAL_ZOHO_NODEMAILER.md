# Release 076 — Nodemailer and own Zoho Mail SMTP test

## Installed
- Nodemailer version 7 and TypeScript types.
- Personal, authenticated Zoho SMTP verifier at /dashboard/zoho-smtp.
- Local one-off verification and explicit one-message send-to-self scripts.

## What this does NOT do
- No bulk, automated, promotional or transactional customer sending using an ordinary Zoho Mail mailbox. Zoho Mail's usage policy prohibits those categories.
- No new public message endpoint and no changes to existing Charis campaign providers.
- No SMTP passwords in source files, browser controls or GitHub.

## How to use your own staff Zoho account
1. In Zoho Mail, open Settings > Mail accounts > select your mailbox > SMTP. Get the EXACT host and port shown.
2. In your own Zoho Accounts, open Security > Application-Specific Passwords > Generate New Password. Give it a name such as Charis Personal SMTP Test. This uses your personal account, not the super administrator's login.
3. With Vercel project access, create these Production server-only environment variables:
   ZOHO_SMTP_HOST=smtppro.zoho.com
   ZOHO_SMTP_PORT=465
   ZOHO_SMTP_USER=oluwaseyi.a@charismfb.com
   ZOHO_SMTP_APP_PASSWORD=(your private Zoho app password)
   ZOHO_SMTP_TEST_ENABLED=true
   Replace SMTP host and port with those shown in your own Zoho Mail SMTP tab. Port 587 also works with STARTTLS. NEVER put these secrets in a public code file.
4. Redeploy once to read new Vercel settings. Sign in to Charis using the SAME verified bank email address configured in ZOHO_SMTP_USER, then visit /dashboard/zoho-smtp.
5. Click Verify my SMTP connection. A successful result verifies secure SMTP authentication, but does not send any email and is not proof of inbox delivery.

## Optional single self-mail test from your own PC
1. Check out the Charis code on your PC and run npm ci.
2. Create a .env.local file with your own ZOHO_SMTP_HOST, ZOHO_SMTP_PORT, ZOHO_SMTP_USER and ZOHO_SMTP_APP_PASSWORD. .env.local is ignored by Git.
3. Run npm run check:zoho to authenticate without sending.
4. Only when intentionally testing one message to your own address, run npm run check:zoho:self. The script sends one test from your own mailbox back to that identical mailbox, never to customer lists.

## Limitations
- Zoho admin restrictions on SMTP or app-specific passwords may require the mail organisation administrator to enable SMTP access for your user.
- Without a private Zoho app password, we can validate package installation, build, mock transport, code safety and design, but not actual Zoho authentication.
- Vercel allows SMTP connections through ports 465 and 587, but not outgoing port 25.
