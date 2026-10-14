# SMS pilot and SendGrid support review

## SMS architecture (Migration 023)

This is a limited pilot. It provides SMS drafts, saved-group selection, an approval inbox within the SMS page, and staff-only tests through Termii. **No customer SMS dispatch or bulk sending is implemented.** Approval never automatically triggers delivery. The code does not bypass existing email marketing preferences. An SMS-specific permission and opt-out system must be approved by Charis before customer sending is built.

## Required Vercel server-only variables

`TERMII_API_KEY` — obtained from a Termii account.
`TERMII_SENDER_ID` — bank-approved SMS sender ID for test.
`CHARIS_SMS_TEST_NUMBER` — one permitted staff-owned Nigerian number in international format, e.g. `23480XXXXXXXX`.
Optional `TERMII_API_BASE_URL` — provider's account-specific base URL. Default: `https://api.ng.termii.com`.

Do not use public-prefixed variables for provider keys. The API key stays on the server.

## Activation steps

1. Back up Supabase and apply migration `023_charis_sms_pilot.sql` after 022.
2. Deploy with Node 24 and run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
3. Request provider approval for the Charis sender ID; fund SMS credits. Add server-side credentials and a test number to Vercel.
4. Visit Charis → SMS communications. Create a short draft, save it, and test against the approved staff number.
5. In another staff account, approve a submitted message. Self-approval is blocked in the database.
6. Review the provider's actual delivery reports. 'Accepted' means handed to Termii, not delivered.

## Scope boundaries

- This release intentionally has no ability to send SMS to customers.
- There is no customer phone marketing consent assumption. Bank customer status alone does not prove SMS marketing consent.
- A future deployment will need compliance-approved SMS message categories, channel-specific opt-outs, DND handling, cost ceilings, idempotent delivery queues, webhook reconciliation and controlled worker operation.
- Customer financial details, full account numbers, balances, PINs, BVNs and OTPs should not appear in campaign SMS.

## SendGrid ticket #29925792

Respond directly to the existing SendGrid review email. Describe your actual relationship with Charis, intended transactional/service vs promotional use, how marketing opt-ins are obtained, and a verified public organisation affiliation link or written authorisation. Show a genuine unsubscribe flow with a recipient-specific example; do not pretend the generic `/unsubscribe` page by itself is a complete working opt-out demonstration.
