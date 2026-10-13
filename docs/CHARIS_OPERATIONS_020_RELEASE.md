# Charis Campaign Centre — Operational repair 020

This release is a complete source build based on the previous premium Charis release with migration 019, plus the operational workflow repair. **It has not been applied to production**. It requires a Vercel build, migration checks, and bank staff acceptance testing.

## What the screenshots showed

| User-reported issue | Change / diagnosis |
|---|---|
| Domain says active but cannot select a sender | Sender selection only uses an explicitly linked and verified Resend domain **and** a saved active sender identity. Being verified alone doesn't create the sender mailbox. Connect/verify once in Sender Settings and save the sender. The old multi-company DNS interface remains disabled in single-company mode. |
| Searching for clients returns dashboard | Customer-access checks now use the database's `can_manage_contacts` function instead of duplicating role checks in application code. The individual-recipient RPC now accepts authorised campaign creators without granting them full customer-delete permissions. Migration 020 is required. |
| Approval inbox empty / cannot approve | Saved `draft` campaigns **do not appear** in the approval queue. Submit for review first. An approver must be a different user from the creator/editor/submitter. Approval now explains this and links to drafts. |
| Segments unusable | Saved segments now link directly to a preselected campaign audience, with clearer empty states and consent eligibility. |
| Contact management and groups only one-by-one | Multi-select customer Archive/Delete and multi-select Add/Remove Group members. Hard delete runs through existing audit/history guard. Group imports still work and are the best route for hundreds of customers. |
| Cannot create templates | Clear "Create a new template" action; permissions checked through `can_edit_company_design` RPC, helpful error output. |
| Test email recipient cannot be selected | Destination selector includes your verified sign-in email, and for team admins other verified Charis staff accounts; verified staff-only validation is enforced in SQL. Tests are still rate-limited and not a way to send unapproved customer campaigns. |
| Saved campaigns cannot send | Show the missing prerequisites: valid sender, bank postal address, opted-in unsuppressed recipients, review approval, live worker. Do not bypass consent or approval. |
| Cannot assign multiple roles | Additional operational roles are supported without changing the protected primary role. Company Administrator remains an explicitly assigned primary role; it cannot be acquired through extra-role checkboxes. |

## Deployment procedure

1. Back up the existing Charis Supabase production database.
2. Confirm migrations **001–019** are already applied. **Run 019 first if it is missing** (this source includes migration 019). Then run **only migration 020** in Supabase SQL Editor. Do not rerun the fresh-install master on an existing project.
3. Replace the existing local source files with this complete release while retaining the `.git` folder, your existing GitHub history and your secrets in Vercel. Verify `git diff` before committing.
4. Run with **Node 24**: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
5. Review and push to your branch; Vercel then builds the preview environment. Deploy production only after test acceptance.
6. Do not enable live customer sending until the delivery worker is configured, domain verified and permissions/consent tested. Test-only emails can be sent to verified bank staff using the dedicated workflow.

## Acceptance checklist (use two separate authenticated staff accounts)

- Admin can open Customers and search by **name, email, or phone** without redirecting unexpectedly.
- Add ten fictional test contacts; leave unknown consent unknown and verify they do not appear in marketing-recipient search. Add **documented opt-in** only for consent received in a genuine test or authorised bank policy.
- Select multiple customers and add/remove them to/from a saved group. Archive multiple. Delete only test records without protected history; a protected record must refuse deletion.
- Click a saved group or segment to open Campaign Studio with the audience preselected. The eligible count must reflect marketing consent and suppression.
- Save a sender identity from a Charis-linked verified domain. Do not borrow another company's domain. Save bank postal address under Brand & media.
- Create a template and open a new one from the Template Library.
- Save a new campaign, send a single test email to your verified staff account, then try another verified Charis member as the recipient (after 020).
- Submit a valid campaign and sign in as a **different** authorised approver. Approve or reject with a note; confirm self-approval is refused.
- Give a member multiple operational roles and verify they can create and independently review others' campaigns without becoming Company Administrator.
- Keep `EMAIL_DELIVERY_ENABLED=false` until the worker, provider limits and a small approved distribution test have passed. Check webhook and reports for accurate accepted, delivered and failed statuses.
- Verify mobile layout, logo/favicon, logout, no sensitive console logs and fast screen navigation.

## Limits and policy

The database restricts direct marketing to opted-in, unsuppressed contacts. Importing 240 contacts does not automatically make them eligible for email marketing. **Never bulk-mark customer consent as granted** without evidence. The test email rate limit limits misuse and protects sender reputation. Production sending allowances should reflect the provider's real quotas, budget and bank policy, not unrestricted test sending.

The visible postal address is a footer compliance requirement for marketing email, not a new external portal. It is managed under **Brand & media**.

## What was verified here

TypeScript source parsed cleanly. Focused static tests passed. Full `npm ci`/`next build`, execution of SQL 020 on a real Supabase project, Vercel routing and live Resend delivery remain **unverified**. The container has Node 22; the project requires Node 24 and its complete dependencies are unavailable offline.
