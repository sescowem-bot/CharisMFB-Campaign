# Release 075 — Choose email provider at the final campaign step

## Staff experience
- The final Confirm & Send step shows a provider picker for emails only, defaulting to Automatic (recommended).
- Specific choices are limited to available, authorised Charis service-email providers: Resend, Brevo and Mailjet. SendGrid is never exposed as a live choice while it remains verification-only.
- Switching provider resets the authorisation checkbox, so staff must approve the revised delivery choice.
- In Automatic mode, existing provider priority and safe failover rules remain.
- If staff select one provider, that preference persists on the campaign, and later queued, approved or scheduled sends use only that provider. No silent fallback to another provider.
- SMS remains on the existing Termii flow. Brevo officially supports Nigeria (+234) SMS, but needs separate prepaid SMS credits and registered Sender ID; Charis does not yet integrate Brevo SMS.

## Database
- Migration supabase/migrations/075_charis_campaign_provider_choice.sql is required before manual provider choice appears. Apply it to Charis production Supabase after migration 060.
- Adds nullable preferred_provider column with a channel-bound check.
- Permission-checked creator wraps the existing validated RPC in the same transaction and persists provider choice atomically before workers can claim recipients.
- Existing auto campaigns still use charis_direct_create_v2. Worker handles missing new column to preserve automatic routing before migration.
- New RPC validates enabled verified sender and idempotency; sender eligibility also revalidated on delivery.
- Do not apply to BusinessOS/Business Platform or unrelated Supabase project.

## Validation
- TypeScript, lint, production build and four release-specific tests passed.
- Browser smoke: final step renders Automatic, Resend and Brevo, excludes unavailable options, changing provider resets authorisation, selected provider posts correctly, 390px width has no overflow.
- No customer messages were sent in tests. Authenticated acceptance after migration still required.
