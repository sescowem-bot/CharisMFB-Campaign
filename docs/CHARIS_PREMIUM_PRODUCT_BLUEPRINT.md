# Charis Campaign Centre — Premium Product Blueprint

**Product:** Charis Microfinance Bank Ltd / Campaign Centre  
**Audience:** Authorised bank staff, managers, independent approvers and internal administrators  
**Implementation:** Next.js App Router, TypeScript, Supabase PostgreSQL/Auth/Storage, Resend email API  
**Scope:** Dedicated single-company workspace. Never show generic marketplace, multi-company subscription or SESCO branding to bank staff.

## 1. Brand tokens

The official Charis logo is bundled unchanged as `public/charis-official-logo.png`. Accent colors are visual approximations sampled from the submitted logo and tuned for legibility; the bank can approve exact official values.

| Token | Value | Purpose |
|---|---|---|
| `--charis-purple` | `#40208F` | Primary brand action / active navigation |
| `--charis-indigo` | `#30157E` | Primary hover and deep identity |
| `--charis-teal` | `#27C79A` | Positive accent, activity indicator |
| `--charis-navy` | `#152648` | Banking-grade structural text |
| `--charis-ink` | `#192943` | Main readable text |
| `--charis-muted` | `#63718A` | Secondary text |
| `--charis-bg` | `#F4F6FB` | App background |
| `--charis-line` | `#E4E8F2` | Table, card and input borders |

**Guidelines:** Dark sidebar and light content; whites for surfaces; green only for confirmations; red only for errors/destructive operations. No large gradients outside the brand hero/login panels. Reduced-motion support is mandatory. Use the bundled logo in the login, sidebar, homepage and browser icon, with optional administrator-uploaded logo and favicon overrides from Supabase.

## 2. Page structure

- `/` – Charis branded staff welcome page; no public subscription catalogue.
- `/login` – Branded staff access and password visibility toggle.
- `/dashboard` – Live operational counts, recent campaigns, action shortcuts and workflow guide.
- `/dashboard/contacts` – Search, edit, archive, restore and guarded delete of contacts.
- `/dashboard/imports` – CSV/XLSX import with mapping and preview.
- `/dashboard/lists` and `/dashboard/segments` – Customer groups and segmentation.
- `/dashboard/campaigns` – Draft editor, recipient selection, test, workflow and send.
- `/dashboard/approvals` – Independent review inbox and recorded decisions.
- `/dashboard/delivery` – Approved campaign queue, delivery results and controls.
- `/dashboard/reports` – Existing campaign analytics and report filters.
- `/dashboard/templates` and `/dashboard/footers` – Reusable message content.
- `/dashboard/senders` – Reuse existing Resend-verified domains and edit sender identity.
- `/dashboard/branding` – Logo, favicon and media management.
- `/dashboard/team` – Staff invitation and roles.
- `/admin/providers` and `/admin/audit` – Administrator-only provider health and audit logs.

## 3. Component system

| Component | Role |
|---|---|
| `CharisNavigation` | Responsive mobile drawer, meaningful groups and current-page highlight |
| `WorkspaceShell` | Bank-only topbar, toolbar, safe layout, main content and footer |
| `CharisWorkflowSteps` | Uniform campaign workflow milestones |
| `CharisStatus` | Accessible shared campaign status presentation |
| `CharisEmptyState` | Actionable empty states (no campaigns, no approvals) |
| `CharisSectionHeader` | Consistent section heading, description and optional action |
| `CharisSafetyNote` | Guardrail explanations without raw database jargon |
| `CharisResendForm` | Editable sender name, mailbox and reply-to |
| `CampaignStudio`/`RecipientPicker` | Actual draft editing, targeted recipients and preview |
| `CampaignWorkflow` | Protected submit, approve and reject actions |
| `CharisMediaLibrary` | Approved public brand graphics only |

## 4. Workflow structure

**Customer contact:** Register or import → validate/deduplicate → group → record consent separately → archive or update when necessary.

**Campaign:** Select one/many/list/eligible audience → compose → select active, verified, Charis-connected sender → save draft → send a test only to verified staff account → submit for independent review → reviewer approves or rejects → queue approved revision → secure worker dispatch → reporting.

**Staff:** Administrator invites from Team Access → staff verifies invitation and creates their own password → permissions determine visible and permitted operations → privileged changes appear in audit log.

**Email:** Resend key lives in server environment → administrator connects an already verified domain visible to that key → chooses sender details in app → sends restricted test → real sending only when delivery is explicitly enabled and authorised. Domain IDs and DNS instructions are not part of the routine Charis user interface.

## 5. Premium UX rules

1. Prioritise one principal action per screen; put the next action near the related record.
2. Avoid technical provider IDs, stack traces and developer jargon in staff views.
3. Every pending or disabled state explains the specific prerequisite.
4. Form feedback is inline and never loses draft data on routine validation failures.
5. Bank colors establish visual hierarchy; don't use gradients decoratively on every card.
6. Use actual data, never fabricate delivery counts, rates or confirmation states.
7. Status badges and action labels must be accessible in both text and color.
8. Mobile navigation must remain usable without taking over half the page.
9. Maintain keyboard focus indicators, semantic headings and reduced-motion support.
10. Never expose credentials to browsers; always verify roles and consent server-side.

## 6. Module decisions (keep, remove, rebuild)

| Module | Decision | Rationale and work |
|---|---|---|
| Supabase Auth and RLS | **KEEP** | Existing bank access rules should not be rewritten without data migration and security review. |
| Campaign approvals/audit | **KEEP + RESTYLE** | Independent approver and audit history are banking-critical. |
| Customer/import/group workflows | **KEEP + RESTYLE** | Maintain the working logic; improve navigation and layouts. |
| Campaign editor and preview | **REBUILD UX** | Shared steps, clear sender prerequisites, test/approve/send explanation. |
| Dashboard | **REBUILT** | Real, RLS-filtered KPIs, latest activity and tasks; no mock data. |
| Sidebar/topbar/mobile | **REBUILT** | Responsive navigation, official identity and reliable logout. |
| Staff login | **REBUILT** | Bank portal, password toggle, no signup link for a single bank. |
| Sender settings | **REBUILT** | No automatic provider fetch on page load; connect existing verified domain only, no old DNS/Domain ID forms. |
| Logo and favicon | **REBUILT BASELINE** | Official bundled image/icon plus admin-upload override. |
| Provider health | **SIMPLIFIED** | Connection, limits and provider state only; old recovery panel removed from bank interface. |
| Historical billing/public subscription routes | **REMOVED FROM ROUTER** | Removed obsolete billing API, checkout, pricing, signup and generic public marketing pages. SQL migration history remains intact. |
| Historical admin companies/plans/CMS | **QUARANTINED** | Admin-only legacy routes remain middleware-blocked in Charis mode until security and database integration review. |
| Historical docs/demo artifacts | **REMOVED from prior lean release** | Not runtime dependencies. |
| Scheduled dispatch, tracking and billing migrations | **RETAIN** | Historical compatibility and referential integrity; not a safe target for blind file deletion. |

## 7. Product direction

**Positioning:** A dedicated, premium internal banking communications workspace, not a multi-tenant marketing SaaS.  
**Success criteria:** An authorised operator can upload contacts, choose one person or group, compose, send a safe test, obtain approval, send and view the outcome without accessing Supabase, Resend or technical recovery screens.  
**Out of scope for this release:** SMS sending, third-party payment processing as a bank feature, WhatsApp campaign dispatch, advanced AI copy generation, removal of legacy database tables or automatic approval bypasses.

## 8. Remaining production acceptance

- Run a clean `npm ci && npm run typecheck && npm test && npm run build` with **Node 24**.
- Confirm SQL migrations 001–018 have already been applied; do not rerun the fresh install over existing records.
- Verify login/logout, permission-based navigation, staff invitations, pending approvals and independent review.
- Confirm contact archiving and consent suppressions, including after restoring a contact.
- Upload a new logo and favicon and verify changes on the live site.
- Confirm that a Resend-verified sender is linked to the same API key/team as Vercel.
- Perform one restricted email test to an authorised staff inbox; then test approved delivery with a supervised internal audience.
- Verify background delivery worker cadence, provider quotas, bounce/unsubscribe webhooks and audit logs.
- Review data retention, backups, bank privacy requirements and sender-domain ownership before live customer use.

**Build honesty:** This is a complete source package with significant Charis-specific UI/workflow refactoring, not a claimed live production rollout. A successful production build and bank acceptance test are still required.
