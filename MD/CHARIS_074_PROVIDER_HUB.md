# Release 074 — One clear email-provider administration page

## Staff/admin experience
- The Email Providers page now lists Resend, Brevo, Mailjet and SendGrid at the same level, with clear status and guidance.
- Active direct-campaign sender selection for Resend/Brevo/Mailjet appears in each respective provider card; previous duplicate provider forms no longer crowd Communication Settings.
- Each provider card separates a basic sender choice from advanced provider access, promotional routes, connection diagnostics, delivery rate limits and other engineering details.
- Brevo and Mailjet support their existing verified-sender import forms. A sender verified in Brevo alone is not automatically attached to Charis.
- SendGrid is first-class for **setup and diagnostics only**. It is not enabled for real Charis campaign delivery until a complete sending, consent, unsubscribe and event reconciliation integration exists.
- The system warns when an active sender under the Charis workspace uses the Salem Medicals domain, but leaves existing settings unchanged.
- A provider is marked configured only when an approved active sender, provider enablement, API credentials and delivery feature are present. This is not proof of inbox delivery.
- Priority/order is accessible under an optional disclosure rather than distracting users from sender selection.
- SendGrid credentials remain server-side; no API keys are displayed or accepted by the provider page.
- The Brevo staff-only verification and Mailjet webhook guide remain available under advanced controls.

## Quality and release notes
- TypeScript, lint and production build passed.
- Four focused provider-hub tests and the full suite passed at the historical baseline (356 passing, 17 old failures).
- Responsive browser fixture at 1420, 1024, 820, and 390px confirmed no overlapping provider cards, no horizontal overflow and working advanced disclosure.
- No SQL migration or new secret is required for this interface update.
- Existing data and provider routing are not changed. Configure SendGrid separately before implementing any real SendGrid sending backend.
- Authenticated production acceptance requires an administrator to verify live sender options and permission scopes.
