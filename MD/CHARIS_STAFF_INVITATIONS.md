# Charis internal staff invitations (migration 016)

## Install

1. Back up the production Supabase database, then run `supabase/migrations/016_charis_staff_invitations.sql` once in the existing Charis Supabase SQL Editor. Do **not** rerun the original fresh-install SQL.
2. Set `SUPABASE_SERVICE_ROLE_KEY` (Supabase Secret or legacy Service Role key, **server-side only**), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app`, `SINGLE_COMPANY_MODE=true`, and the actual `SINGLE_COMPANY_ORG_ID`. Do not use a preview or localhost URL for production invites.
3. Supabase -> Authentication -> URL Configuration: set the Site URL to the exact Charis production URL and add `https://charismfbcampaign.vercel.app/auth/setup-password` to allowed redirect URLs.
4. Supabase -> Authentication -> SMTP: configure a bank-approved mail service for Auth invitation emails and customize the Invite user email template using Charis branding. Supabase's default email service has restricted sending capacity; do not rely on it for production employee onboarding.
5. Deploy the code, open **Charis Team Access -> Invite Charis staff**, enter an email and assign a role. The invite creates a pending record. Upon following the Supabase invite email the person verifies their email, then is sent to `/auth/setup-password` and sets their own password. Membership is granted from the pending invitation by authenticated database RPC.
6. Existing verified users are given company membership directly. Existing current members are edited using the lower role-edit form. The last-company-admin rule remains intact.

## Admin operations

- Pending invitations can be cancelled in the dashboard; cancelled or expired invitations never grant company access even if their old email link is later opened.
- There is no public signup requirement. All invitations originate from logged-in company administrators, and the service role key stays on the server.
- The system deliberately does not email plaintext passwords. Staff create their own password after verifying their invitation.
- Invitation expiry is seven days **at the database level**; Supabase's email link may expire sooner, depending on the Auth email OTP expiry settings. If it expires, ask the admin to invite again.
- For an already-created but unverified Supabase Auth user, `inviteUserByEmail` may return a duplicate-account error. Re-inviting using a fresh email or handling preexisting accounts is a future improvement; do not expose the Supabase dashboard to ordinary Charis staff.

## Tests to perform before production

- Admin invites a never-before-registered email, received and clicked from a different browser, chooses a password and sees the correct Charis dashboard.
- Another staff member without company-admin privilege cannot issue or cancel invites.
- Cancel pending invitation before redemption; redemption must not grant membership.
- Invite an existing verified user; membership should be applied immediately.
- Invite `approver`, `designer`, `viewer`, `company_admin` and confirm actual permissions.
- Try demoting the sole company admin (must remain blocked).
- Confirm the email comes from a verified approved Charis sender and the invite's redirect domain matches the deployed site.

## Limitations

TypeScript files can be syntax checked offline; no live Supabase/project credentials are available here, so SQL migrations and actual invitation email delivery must be verified in the user's environment. A complete Next.js production build should be run on Node 24 with a full dependency install before rollout.
