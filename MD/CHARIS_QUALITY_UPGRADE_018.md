# Charis Campaign Centre — Quality Upgrade 018

## Scope and intended use
This release fixes the current Charis staff-facing usability problems without turning the product back into a multi-company subscription application. Use the existing Charis Supabase project; this is a non-destructive migration, not a fresh install. **Do not upload bank customer data or enable bulk sending until the production checks below are passed.**

## New and improved workflows

1. **Customer management:** active/archived views, edit, archive, restore and guarded permanent delete. Archive stops new marketing sends by setting consent to denied and unsubscribe timestamp, while preserving delivery history. Restore never automatically restores marketing opt-in. Permanent delete is refused when delivery history or pending/approved campaign membership exists. For account-level data erasure, follow bank retention policy.
2. **Logo, favicon, media library:** upload genuine PNG/JPG/WebP files from Brand Settings. Limit is 2 MB (512 KB favicon). The public `charis-brand-assets` bucket is for approved visual identity files **only**, not identity documents, banking details or customer files. Public brand logo is used by the navigation, and favicon metadata is generated for browser tabs. Logos and favicon changes may take some time to clear browser caches.
3. **Charis sender identity:** verified Resend domains are no longer automatically approved for Charis merely because the same API key can see them. Add the testing domain in Sender Settings. The server finds its Resend ID automatically or registers the domain, and lists any DNS records required. Click Check verification. Only then choose the sender name, mailbox and reply-to from the dashboard. No `CHARIS_FROM_EMAIL` is required.
4. **Legacy provider panel:** technical `Provider Domain ID` recovery is hidden in single-company mode. Any earlier pending internal connection can be unlinked safely if it has no sender identities. This **does not** delete anything from the Resend account.
5. **Campaign studio:** explains why editing is restricted (workspace inactive, role missing, or RPC problem); links to Team Access. Test email explains when the saved campaign has no sender, instead of showing an unexplained error. A sole eligible sender is selected by default for a new draft.
6. **Independent approvals:** bank review protections remain; the campaign creator cannot approve their own submission. This is intentional for production banking communications.
7. **Delivery:** the app clearly distinguishes test messages from customer-campaign dispatch. Customer dispatch still requires `EMAIL_DELIVERY_ENABLED=true` and the scheduled delivery worker.

## Install — in this order

1. Create a backup/snapshot of the Charis Supabase database; verify migrations 001–017 were previously installed.
2. Run `supabase/migrations/018_charis_media_and_contact_management.sql` in **Charis** Supabase SQL Editor. This installs Storage bucket, media metadata and RLS, contact archive/delete functions and explicit Charis domain authorisation.
3. Merge the source files from `Charis_Quality_Upgrade_Patch.zip` into the latest local GitHub checkout. Prefer patch over copying the whole project if other developers have changed the repo.
4. Use Node **24.x**, run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Do not deploy a failing build.
5. Commit and push only after reviewing the diff; Vercel redeploys via your existing Git integration. Double-check Vercel environment variables: `SINGLE_COMPANY_MODE=true`, the exact `SINGLE_COMPANY_ORG_ID`, correct Charis Supabase URL/key/service role key, `NEXT_PUBLIC_APP_URL`, and `RESEND_API_KEY`. The service role key must stay server-only.
6. If campaign editor still says "not available," run `Charis_Admin_Permission_Diagnostic.sql` (read-only) in the Charis Supabase SQL editor. If the stored role is eligible and the organisation is active, check that your browser is signed into that same Supabase project and the current deployment has the updated migrations. Do not simply disable role checking.
7. Configure an authorised testing domain. In Charis → Sender Settings → Connect sending domain, enter `sescoconcept.name.ng` or an official Charis test domain, add the DNS records shown if necessary, and click Check verification. Resend verification is mandatory; an API key is not a substitute for domain verification. The domain should **not** automatically show Salem Medicals.
8. In Charis → Brand Settings, save the bank's correct brand name and postal address. Upload its approved logo and favicon; optionally upload supporting graphical media.
9. Create a test campaign, pick the saved sender, save the draft, and click **Send test to my email**. The test goes to the authenticated verified staff login and is quota-limited; it does not need a customer marketing opt-in.
10. For a customer campaign, register/import only approved, consented recipients. Have a different authorised reviewer approve it. Once the bank approves launch, enable `EMAIL_DELIVERY_ENABLED=true`, configure a secure worker with `EMAIL_WORKER_SECRET`, and verify queue throughput plus Resend delivery/webhook status. **Do not enable bulk delivery solely for a pitch test.**

## Acceptance checklist
- [ ] Charis login and sign out work without cross-origin errors
- [ ] Active workspace Admin/Manager/Designer can create and edit a draft
- [ ] Staff invitation and approval inbox work with two *different* verified accounts
- [ ] Customer can be created, edited, archived, restored; guarded delete correctly protects delivery history
- [ ] Bank name, logo and favicon appear after updating the site and browser cache
- [ ] Media library uploads, previews, copies graphic URLs, removes non-current images
- [ ] Sender settings do not automatically choose domains from other brands
- [ ] Test domain is registered, DNS records shown and verified with Resend
- [ ] Saved sender is selected in a draft and test email reaches a controlled inbox
- [ ] Customer campaign remains blocked without recorded opt-in
- [ ] Approved message queues correctly after delivery is explicitly enabled
- [ ] Worker processes more than the first recipient and reports match Resend events
- [ ] Vercel production build, Supabase migration and RLS verified

## Review status
- Local static TypeScript/TSX syntax checks passed (126 source files).
- Focused Node tests passed (21 tests with experimental TypeScript stripping).
- **Not verified here:** Node 24 production build, Supabase SQL execution, real media upload, Resend account/domain verification, live send, and scheduled worker. Those require deployment credentials and a test environment.

## Important security notes
- A public graphics bucket is never for customer spreadsheets, statement PDFs, BVN/NIN, ID files or sensitive information.
- Do not disable consent checks or maker-checker reviews for real customer campaigns.
- Do not use `salemmedicals.com` as a Charis customer-facing sender.
- Legacy domain records are preserved for safe recovery unless an administrator unlinks an unused pending connection. Sender identities may be deleted only after disabling them and only if no campaign or test history references them; otherwise they remain disabled for audit integrity.
