# Release 038 — Charis Unified Administration and Staff Action Matrix

## Background / branch
Prepared from the actual Charis 037 source matching GitHub `sescowem-bot/CharisMFB-Campaign` commit `2bb77cfed7186ab2c6c12e757bfadca81e5fed78`. No GitHub push, Vercel deployment, email send or Supabase database changes were performed during preparation.

## The requested design

- Exactly one **Administration** sidebar link for staff with delegated administrative permission. Its internal tiles are permission-filtered.
- **SendGrid remains inside Email Providers**, beside Resend, Brevo and Mailjet. Verified sender management is linked from the same screen rather than consuming another main-menu item.
- Customer navigation collapses to one **Customers** entry (editing vs read-only destination depends on `customers.manage`). Communications contains email/SMS campaigns, approvals, delivery status and the design library. Credit operations stays in its own small section. Help appears in the top bar, not as a menu group.
- Old pages are not deleted. Bookmarked links retain their original functionality with server-side access checks; missing `?org=` navigation parameters were fixed for legacy views that require them.
- A new **Staff access** editor in `Administration → People & access` lets a permitted administrator select a colleague and manage: one primary role; additional built-in responsibilities; multiple custom roles; and per-module explicit `Use role`, `Allow` or `Deny` controls. The custom role capability editor uses category accordions with multiple action checkboxes.
- The system-owner identity is protected, and administrators cannot change their own access or grant capabilities they do not hold. Bank administrator changes require owner authority. Elevated rights cannot be obtained through a hidden menu or browser-only control.
- Changes are audited; existing assignments are preserved when Migration 038 is first installed. Saved changes apply to the selected member only.

## Supabase migration — 038 only

1. Take an approved database backup. Confirm migrations 033, 034 and **037** succeeded. No SQL files 035 or 036 exist.
2. Apply `supabase/migrations/038_charis_admin_access_matrix.sql` in the existing bank Supabase project. The migration creates **two** additive SECURITY DEFINER functions in one transaction. It does not create or delete staff, erase role assignments, reset the database, or enable campaign delivery.
3. Run `supabase/verification/038_access_matrix_readonly.sql` and confirm both new functions exist.
4. Use **separate staff accounts** in staging to verify: Super Admin can assign capabilities to another user; an ordinary staff user sees no Administration link; direct Deny hides the corresponding navigation and blocks its server operations; an admin cannot elevate their own access; an admin cannot edit the system owner; saved custom roles and loan branch restrictions are enforced by the database.
5. Recheck client behaviour after a refresh or re-login (roles can be cached within the same request).

## Code & deployment steps

- Merge the PATCH into the exact baseline named above or compare your newer checkout first. Do not overwrite more recent source changes blindly. The FULL ZIP contains the project if you need a clean copy.
- Run Node **24**, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:smoke` in CI/preview. Never disable checks to force deployment.
- Keep customer delivery disabled (`EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false`) and do not activate the scheduled sending worker during this administration upgrade.
- Verify Vercel preview, staff login/logout, desktop and mobile navigation, customer workspaces, admin permissions, and action audit records. Preserve the last working production commit as rollback reference.

## Verification performed in preparation environment

- All 219 source files passed TypeScript/JavaScript **syntax parsing**; no missing local import paths.
- New Release 038 source-level tests passed 4/4, plus updated navigation/legacy intent tests.
- Full test suite: **148/160 passed** in this environment. The remaining 12 are dependency/runtime suites that cannot load `.ts` files directly under local Node 22 without the Node 24/dependency workflow. This is **not** a completed CI/production build certificate.
- Supabase SQL and role isolation could not be exercised against the live bank database. Do not release this functionality to staff before staging validation.

## Security reminder

`company_admin` is **not** the sealed platform Super Admin; the latter remains a separate identity. Individual Allow and Deny entries take precedence over standard and custom roles only where the underlying RPC/action enforces Charis permission checks. Complete a server-action/RLS audit before treating all legacy pages as centrally controlled. Do not use real banking customers for tests without authorization.
