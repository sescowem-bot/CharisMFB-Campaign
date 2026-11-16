# Sender identity and campaign copy recipients

## Sender management

Open **Administration → Email delivery settings → Sender addresses**.

Administrators can:
- Add a sender name and complete sender email address.
- Select SendByte, Resend or Brevo.
- Verify the sending domain directly against the selected provider account before saving.
- Edit the sender name, email address and Reply-To address.
- Disable a sender so it is no longer offered for new campaigns.
- Permanently delete a disabled sender only when no delivery or test history depends on it.

The sender email and domain are not fixed in application code. Provider credentials remain server-side. A verified sender still needs its provider route configured before it can be selected for campaigns. Disabling a provider or global delivery setting continues to prevent live sending.

The legacy Resend-only `/dashboard/senders` page now redirects to the unified settings page.

## From and Reply-To

The active sender configured for each provider route controls the From display name and From email. Each sender record has its own Reply-To address. An empty Reply-To value falls back to the From email.

## CC and BCC

The campaign composer accepts optional CC and BCC addresses for email campaigns:
- Separate multiple addresses with commas, semicolons or new lines.
- Up to 10 unique addresses in each field.
- CC recipients are visible to recipients.
- BCC recipients are hidden from other recipients.
- Both fields are shown on the final campaign review.
- SMS campaigns cannot include CC or BCC.

The new database function saves copy recipients atomically with the campaign before a delivery worker can claim it. Each provider adapter maps CC and BCC to its own API payload format.

## Zoho Campaigns retirement

The Zoho Campaigns administration card is removed. Existing Zoho tables and RPCs are not exposed to client roles by migration 089. Historical records are retained for audit purposes rather than destructively erased.

## Database step

Run `supabase/migrations/089_charis_campaign_copy_recipients_and_zoho_retirement.sql` manually in the Charis Supabase SQL Editor after the existing campaign provider creation function is present. Do not run it until the current database has the `charis_direct_create_provider_075` function. The migration adds the CC/BCC columns, an atomic campaign creation wrapper, and revokes legacy Zoho client access.
