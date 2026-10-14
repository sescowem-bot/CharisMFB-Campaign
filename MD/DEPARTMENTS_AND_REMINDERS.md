# Charis Departments, Visual Email Designer and Internal Reminders

## Installed with Migration 026

- Department directory seeded for eleven Charis functions: IT, Executive, Marketing, Customer Service, Operations, Credit, Compliance, Audit, Finance, Branch and HR.
- **System Administrator** (an existing Charis team administrator) can assign already verified Charis staff to departments, as Head, Member or Observer. This does not alter their original company-wide role or campaign permissions.
- Members can open authorised department workspaces and create internal reminders. Observers can view but cannot create or close reminders. Reminders carry an assigned staff account, WAT due time, priority, audit history and Open/Done/Cancelled status.
- Reminders do **not** trigger SMS or email to customers, and HR does **not** use the customer marketing audience for employees.
- Visual template and campaign editors support headings, paragraphs, buttons, dividers, **bank-managed JPG/PNG/WebP images** and email-safe **coloured shapes, panels, banners and labels**. Image upload in the Template Library goes through the existing authenticated Media Library; external URLs cannot be submitted as arbitrary message images. The existing ten template presets are retained and improved.

## Installation

1. Back up Supabase; confirm migrations 001–025 succeeded.
2. Run only `supabase/migrations/026_charis_departments_reminders.sql` in the existing Supabase project. Do not reset the database or re-run the fresh-install SQL.
3. Deploy project source through the normal Node 24 CI checks: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
4. In Charis open **Team Access** to invite staff first, then **Departments** to assign staff. Unassigned staff should see no departmental workspace.
5. Open **Reminders** to assign an internal task and test status updates under a member, observer and admin login.
6. Open **Email templates**, upload an approved graphic, create a new Image block, add coloured shape blocks, save the draft, and load it into Campaign Studio. Verify the outbound email HTML in actual Gmail and Outlook clients before using it.

## Security boundaries / next work

**Do not represent department-level access as fully rolled out for banking data.** This release scopes the *new* department-membership and reminder records at the database level. The old customer, audience, report and campaign tables still carry broad organisational permissions. Branch-only customer views, department-owned campaign IDs, HR employee-only audience, executive approval routing and automatic customer reminders need separate migrations and cross-role testing before being turned on. Hiding menus alone is not a security control.

Existing marketing opt-in, unsubscribe suppression, anti-duplicate delivery, independent campaign approvals and disabled customer dispatch remain unchanged. Customer service reminders must not be used to bypass those rules.

## Release verification

Check the 026 migration with a staging bank copy, run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` on Node 24, and test real staff access. Do not enable customer broadcasting as part of installing this release.

## Migration 027: bank-managed department directory
The eleven rows inserted by historical Migration 026 are not hardcoded in the new UI or recreated by Migration 027. Existing records and assignments remain unchanged. An administrator with `departments.manage` can create, edit, rename, archive or reactivate departments; archiving refuses when there are open staff reminders. The bank can keep only the departments it needs. Department names never determine access by themselves.

The new Administration Centre `/admin/access` permits custom permission roles and per-user allow/deny overrides. Permission grants are audited and limited to capabilities the grantor already holds. Platform Super Admin ownership is sealed and distinct. Existing company administrators remain broadly privileged; use individual denials or custom roles for least-privilege staff. Branch data isolation is still future work.
