# Charis Campaign Centre — Easy Campaigns Upgrade (021)

## What is now simpler?

- **Customer sending off** replaces ambiguous **Test mode**. This accurately reports the existing `EMAIL_DELIVERY_ENABLED=false` setting. It does **not** prevent authorised staff test emails. It does not enable customer broadcasts on its own.
- **Inbox preview text** replaces **Preheader**: an optional short line some inboxes show next to the email subject. Example: "See our latest service update." Not always displayed by providers.
- **Saved group** replaces "static contact list" in daily work. Build one in the campaign form or the Saved groups page, then add customers on the Saved groups page.
- **Smart group** replaces "segment" in the UI. Create one from the campaign form using consent/source rules. These groups update as customers change.
- **Insert customer detail** gives staff buttons for first name, last name, email, bank name and discovered custom fields. Place the cursor in the subject or a message section, then click a detail button. Data is personalised per eligible recipient when sent; the editor shows sample data only.
- **Four email designs:** Classic, Modern, Simple, Featured. The shared schema stores an optional `style`, compatible with previous designs and already saved campaigns. Designs remain editable in the template library.
- **Extra customer fields:** Add up to 12 approved fields to a manually added/edited customer in Customers, or import extra CSV/Excel columns. Keys are accessible through the detail buttons. For account identifiers, store/use only four final digits; do not import BVN, PIN, OTP, passwords, secrets or full account numbers.

## Before deployment

1. Back up Charis Supabase.
2. Check migrations 001–020 have been run, then run **021_charis_customer_details.sql** in Supabase SQL Editor exactly once.
3. Copy full source over the latest GitHub checkout without deleting `.git`. Verify configuration and no environment secrets are committed.
4. On Node 24 run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
5. Review changed files before `git add -A`, commit and push. Vercel build must succeed.

## Important operational boundaries

- **Test staff email now:** Select a verified Charis sender in Sender Settings, save a campaign, then choose the approved staff test recipient. The Resend API key remains server-only. Provider rate limits still apply.
- **To send real customer campaigns:** Ensure eligible recorded consent, bank postal address, verified sender, a second authorised approver, `EMAIL_DELIVERY_ENABLED=true` and a functioning scheduled delivery worker. Do not enable merely to remove a testing label.
- **New saved groups begin empty.** Open Saved groups and add members. Unknown consent does not become marketing consent when you add someone to a group.
- **Full account number protection** has been added to manual fields and the outgoing renderer, but old data imports may already contain sensitive identifiers. Review historical stored customer attributes before production use.
- This release does not replace the independent approval workflow or make free provider quotas unlimited.

## Acceptance tests

- Create a group from the campaign form, return to it, and assign two eligible test contacts on Saved groups.
- Create a Smart group filtered by consent and import source; check its membership updates after a customer edit.
- Save a customer with `branch` and `account_reference` (last four digits only), then check the campaign detail picker and email preview.
- Switch all four design options, save and reopen the campaign, then verify the final HTML renders without missing blocks.
- With `EMAIL_DELIVERY_ENABLED=false`, send to a verified Charis staff account, not a real customer list.
- Using two verified staff accounts, submit a small customer campaign, approve from a different user, queue and monitor (only after production dispatch is configured and authorised).

## Verification boundary

Source-focused regression tests and TypeScript syntax checks can run in this environment. Full production typechecking, SQL execution against the live database, real sender tests and final Vercel build still require the deployment environment. No changes were pushed to GitHub or applied to Supabase by this release.
