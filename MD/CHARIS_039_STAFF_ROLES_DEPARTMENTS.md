# Charis Campaign Centre — Release 039: staff roles, actions and department access

## Why this release exists
The original staff editor showed default roles and additional roles first, while the **individual module action controls** were hidden inside collapsed groups further down the page. On the Department page, the **Assign an existing staff member** form appeared below every department card. These layouts made it difficult to give an officer real responsibilities or assign them to their team.

Release 039 makes **People & permissions** the staff-first workspace for all three decisions:

1. **Default system role and additional responsibilities.** These are the existing general roles. They do not include every bank job title.
2. **Custom job role** — create a role (for example, Credit Officer) under the same page, choose its allowed actions, then assign the role to staff. Nothing is hardcoded for bank departments.
3. **Department membership and module actions** — tick one or more of the existing active departments, choose Head/Member/Observer, then choose per-module action overrides (Use role/Allow/Deny). Save staff access once.

The Department page also exposes staff assignment above the department listing. It displays any existing member assignment while you select the user and department.

## Security and data boundaries
- `039` adds `charis_staff_profile_save`, an authenticated bank-scoped, audited RPC that wraps existing **038** role-action updates and changes selected active departments in the **same database transaction**. A failure rolls everything back.
- Primary role changes still follow 038's permission policy. Super Admin ownership cannot be edited here; staff cannot change their own access. Only the owner can edit a bank administrator. Delegated administrators cannot grant permissions they themselves lack.
- A request without the department editor submits `p_departments = NULL`, preserving all current department memberships. Hidden and archived department assignments are preserved; only explicit active department IDs are changed.
- Department membership grants **department workspace access**, not bank-wide customer, branch, loan or campaign access. Database RLS and branch/customer scope checks still apply independently.
- No messages are sent by this release; delivery settings and providers remain unchanged.

## Exact installation
1. Back up the Charis Supabase database, and keep the previous Vercel release as a rollback point.
2. **Confirm migrations 026, 027, 037 and 038 exist in Supabase.** The displayed 038 screen alone does not prove migration 038's RPC is installed. Only apply missing migrations in order, not the whole fresh installation.
3. Run `supabase/migrations/039_charis_staff_departments_and_actions.sql` once in Supabase SQL Editor. Verify via `supabase/verification/039_verify_staff_departments_readonly.sql`.
4. Merge the Release 039 PATCH with the GitHub source based on commit `c31648383bf9f2f1a47a3fb31837e3a3564ee7e7`. Do not overwrite `.env`, `.git` or credentials. No existing data tables are dropped.
5. On Node 24: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Fix build blockers before production deployment.
6. Preview with separate authorised test accounts: admin assigns a Credit Officer custom role, allows loan registration and credit reminder creation, assigns the staff member to the Credit department, and confirms the staff member sees only permitted menus/data. Then test Deny and removal of department membership. Verify the audit trail and no duplicate customer sends.

## Known validation limits
The source syntax check passed for all 220 project code files and targeted Release 039 tests passed. The local Node 22 test suite passed 153/165; the remaining 12 failures are pre-existing package/runtime-dependent tests (for example missing Zod, PGlite and related Node 24 modules). This environment cannot certify a clean Node 24 production build, real Supabase RLS behaviour, or live staff login acceptance.

## Rollback
Do not delete role, department, customer or audit records. Revert to the previous application source if a deployment fails; the new SQL function is additive and does not change memberships until an authorised administrator saves staff access.
