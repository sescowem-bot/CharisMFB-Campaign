# Charis Campaign Centre — dedicated Charis release

Brand identity: **Charis Microfinance Bank**. No developer name is intended to appear as product branding.

## Before redeploying
1. Back up your existing project and check `git status`. Use this source package as a reference or carefully merge changes into the GitHub main branch.
2. In Vercel set `SINGLE_COMPANY_MODE=true` and `SINGLE_COMPANY_ORG_ID` to the UUID returned for `charis-mfb`. Set the new Charis Supabase URL, publishable key and server secret as described in `.env.charis.example`.
   Optional: set `CHARIS_LOGO_URL` to an official HTTPS image of the Charis bank logo. Without this, the UI uses a clean lettermark.
3. If the new Charis SQL was **already installed**, use `Charis_Brand_Correction_Existing_Supabase.sql` from the release folder. **Do not rerun the fresh-install SQL.**
4. Redeploy and sign out/sign in. Verify landing page, login, sidebar, recipient picker, upload lists and preview using fictional/test contacts.
5. Admin should approve verified sender details, consent handling, permissions and email-worker setup prior to any live customer sends.

## Scope of this revision
- Charis-first public portal, navigation, staff login and dashboard shell.
- Removes old public pricing, billing and open registration routes in single-company mode.
- Keeps existing migrations and email/campaign workflow; no database reset.
- Removes visible SESCO names from public site copy, metadata, sender verification UI and health endpoint.
- Preserves brand settings, sender settings, footers, reports, approval controls and audit functions.
- Renames cookie/verification strings: after redeploy, sender domains must be reverified using the displayed `_charis-campaign` TXT record if previously verified with the old TXT record.
- Only email channel implemented. SMS/WhatsApp are not enabled in this revision.
- Self-service public sign-up should additionally be disabled in Supabase Authentication settings if staff-only access is required.

## Verification limits
This package is from the previously supplied upgraded Charis ZIP (not a pull of the latest GitHub commit). Merge carefully if your online repository has diverged. Full production build and authenticated live email delivery must be run in your Vercel/Supabase environment.
