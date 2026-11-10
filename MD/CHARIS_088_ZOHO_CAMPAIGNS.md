# Charis Email Campaigns — Zoho Campaigns delivery integration

Zoho Campaigns is a background delivery provider. Staff create, prepare, send and review campaigns inside Charis. Contact management, audience selection, consent checks and campaign history remain in Charis.

## Migrations

The Zoho broadcast base migration is `084_charis_zoho_broadcasts.sql`. The reporting and suppression migration is `085_charis_zoho_reporting_and_suppressions.sql`. Migration 085 adds report metrics, the Zoho event inbox and a provider-specific suppression table. Migration 086 adds the administrator-only Zoho contact inventory, sync history, list membership and signed-form attestation tables.

## Vercel environment variables

Set these in the Charis Campaign Vercel project, for Production:

| Variable | Value |
|---|---|
| `ZOHO_CAMPAIGNS_ENABLED` | `true` |
| `ZOHO_REGION` | Actual Zoho data centre; for the supplied campaigns.zoho.com account use `com` |
| `ZOHO_CLIENT_ID` | Zoho Self Client ID |
| `ZOHO_CLIENT_SECRET` | Zoho Self Client Secret |
| `ZOHO_REFRESH_TOKEN` | OAuth refresh token |
| `ZOHO_FROM_EMAIL` | Exact sender verified in Zoho Campaigns |
| `ZOHO_BROADCAST_MAX` | Begin with `100`; increase after controlled testing |
| `ZOHO_WEBHOOK_SECRET` | Random secret of at least 32 characters |
| `NEXT_PUBLIC_APP_URL` | `https://charismfbcampaign.vercel.app` |

Keep credentials server-side. Never commit them to GitHub or expose them in browser code. Redeploy after changing Production environment variables.

## Zoho credentials

1. Sign in to the Zoho account that owns the Charis sending domain.
2. Verify the sender address (for example, `info@charismfb.com`) in Zoho Campaigns.
3. Open the Zoho API Console at https://api-console.zoho.com/ and create a Self Client.
4. Generate an authorisation code with scopes `ZohoCampaigns.campaign.ALL,ZohoCampaigns.contact.ALL`. The contact scope includes the read permission needed for list and contact inventory.
5. Exchange the grant code for a refresh token using the OAuth endpoint for the account's own data centre.
6. Use the region matching the Zoho account domain, not the user's country.

The application exchanges the refresh token for short-lived access tokens automatically. The refresh token is not regenerated for each campaign.

## Existing contact synchronisation

The administrator-only page is `/admin/zoho-contacts`. It reads the existing Zoho mailing-list inventory and retrieves each list's active, unsubscribed and bounced contacts in pages. It matches contacts by normalized email, imports missing contacts into Charis, records each Zoho list membership, and carries unsubscribe/bounce states into Charis suppression controls. Staff do not access Zoho or select Zoho lists.

Zoho active status confirms the address is active in Zoho; it does not independently prove the wording or scope of a signed account-opening form. An authorised Charis administrator must attest to the bank-held signed-form register and select the permission scope before previously unknown active contacts can be treated as eligible for general marketing. Existing denials, unsubscribes, bounces and bank suppression records are not re-enabled by this attestation.

The first synchronisation is an import and inventory operation. It does not delete, rename or consolidate Zoho mailing lists. This is deliberate: old lists may be referenced by existing or historical campaigns. Review the inventory and recipient counts before any later cleanup. Staff should use Charis contact groups and segments, not Zoho list selection.

## Webhook

Configure the Zoho Campaigns contact events for unsubscribe, bounce and spam/complaint where available. The Charis endpoint is:

`https://charismfbcampaign.vercel.app/api/webhooks/zoho-campaigns`

Use POST and configure the authentication/custom header:

`X-Charis-Zoho-Webhook-Secret: <the exact ZOHO_WEBHOOK_SECRET value>`

Do not put the secret in the URL. Ensure webhook payloads include a Zoho list key or campaign key so Charis can match the event to a broadcast.

## Safe test procedure

1. Apply the database migrations in order, including migration 086.
2. Set the Production variables and redeploy.
3. Open Administration → Zoho contact synchronisation and run the initial read/import.
4. Review the list inventory, unique-contact count, newly imported contacts and suppression count.
5. Verify the account-opening form wording and record the bank evidence-register reference and actual permission scope.
6. Test with one to three staff-approved addresses before any customer broadcast.
7. Test unsubscribe with a controlled address and verify that Charis suppresses it.

## Safeguards

- Customer contacts require recorded permission and must not be unsubscribed, archived, opted out or suppressed.
- A partial contact-add failure must block sending.
- An uncertain send response must not be blindly retried; first verify provider status to avoid duplicate sends.
- A provider acceptance is not proof of delivery.
- Never remove suppression records merely to re-add an address. Use Charis's approved resubscription process and retain consent evidence.
- Resend transactional notifications and the separate Zoho SMTP/manual correspondence feature are not replaced by this broadcast integration.
