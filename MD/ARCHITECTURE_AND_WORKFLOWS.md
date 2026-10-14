# Architecture and operating workflows

## Stack
Next.js App Router (TypeScript/React), Supabase Auth and Postgres with RLS, and provider-backed email delivery (Resend and Brevo; Mailjet API connection checks added in Migration 024, with customer dispatch disabled until full channel verification). The application's single-company mode is configured through environment variables. Sensitive provider credentials remain server-only.

## Main workflow
1. Sign in as an authorised Charis staff member.
2. Import or manage customers and create a saved group or smart group.
3. Select the marketing-eligible audience and a verified, Charis-authorised sender.
4. Create and save the message, preview the personalised content and send controlled staff tests.
5. Submit a complete campaign for review; a different authorised user must approve or reject it.
6. An authorised dispatcher queues the approved revision. The secure delivery worker dispatches eligible messages when enabled.
7. Monitor accepted, delivered, failed, bounced and suppressed outcomes; retain audit history.

A campaign draft is **not** a submitted, approved or delivered campaign. A provider's accepted response is **not** proof that an email reached the customer's inbox.

## Permission boundaries
Company Admin controls company-level access. Campaign Lead may create, independently approve another person's campaign and send already-approved campaigns, but self-approval must remain blocked. Other staff should receive only role-specific permissions. RLS/database functions enforce permissions; hiding a button is not security.

## Recipients and imported data
Four primary contact fields: first name, last name, email and phone. Up to 12 additional non-sensitive custom fields can be mapped. Importing customers does not automatically grant promotional consent. Existing duplicates must not silently overwrite customer records or preferences. Import row-level issues are recorded for new imports after migration 022, not retroactively for old summary-only imports.

## Email sending and safety
Test sends are limited to eligible verified staff recipient accounts; production customer sends require approved campaigns, valid audience eligibility, sender verification, compliant email branding and a working delivery scheduler. Keep `EMAIL_DELIVERY_ENABLED=false` until hosted acceptance confirms those conditions.

## Performance principles
Avoid provider API calls during ordinary page rendering, redundant authentication/database requests, unnecessary UI dependencies and unbounded import queries. Load charts/reports only where needed; keep responsive layout and useful empty/error states.
