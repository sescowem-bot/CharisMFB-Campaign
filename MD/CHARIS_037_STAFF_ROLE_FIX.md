# Charis access management — multi-role usability fix (037)

## Why staff could not select roles
The old Roles & Permissions dropdown displayed **custom** roles only. If none were created, it was empty and Save assignment was disabled. Built-in roles (Campaign Lead, Approver, Designer etc.) were in a different Team Access module, and the link to that module was missing a required bank workspace query parameter.

## What's changed
- Clear empty states on Roles & Permissions when no custom roles exist.
- Multiple custom-role checkboxes with a current-assignment summary, instead of a single-select field. Saving replaces only that employee's **custom role list** in one database transaction; primary/built-in roles are unchanged.
- Bank-scoped, permission-checked SQL RPC `charis_staff_roles_sync` with protection against self-editing, privilege escalation and changes to the platform owner.
- Correct Staff invitations / Team Access navigation link.
- No customer sending, campaign rules, credit records or existing assignments are changed by applying the code/migration.

## Install
1. Back up Supabase and the repo. Confirm existing migrations 033 and 034 before applying subsequent changes, and do not rerun earlier migrations.
2. Run **only** `supabase/migrations/037_charis_multi_custom_role_assignment.sql` in Supabase SQL Editor. This creates a function; it does not reset or delete existing roles.
3. Deploy the matching code patch. Use Node 24; run `npm ci && npm run typecheck && npm run lint && npm test && npm run build` in the full dependency-enabled environment before production promotion.
4. Create at least one custom role in Roles & Permissions and give it capabilities. To assign several custom roles, select a staff member, tick multiple boxes, and save. For **built-in** roles, use **Team Access → Manage → Additional responsibilities**; those already support multiple checkboxes.
5. Use an account with `access.manage`. For security, the current account cannot change its own role, and a non-owner administrator cannot alter the system owner.

## Known constraints
- Not validated against the live Supabase schema or deployed in Vercel. New SQL and code must be released together. No customer sending was enabled.
- A SQL object check is not equivalent to cross-user RLS acceptance. Test as Super Admin, delegated Admin, Credit Officer and read-only staff before rollout.
- Errors on other pages require their exact URLs or screenshots; do not assume they share this cause.
