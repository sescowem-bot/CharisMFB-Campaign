# Testing, acceptance and release notes

## Required source checks
```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Source-only test success is not production certification. The actual Vercel build, Supabase migration state, browser flows and email delivery must be tested in the deployed environment.

## End-to-end acceptance
- Staff login, refresh, logout, forgotten password and role-based route protection.
- Company Admin and Campaign Lead abilities; different creator and approver.
- Add/edit/archive customer; search; consent filters and Communication Preferences.
- XLSX/CSV import, custom mapping, batch totals and duplicate/invalid row review.
- Make a saved group and a smart group; select individual or eligible multiple recipients.
- Save a new campaign/template, choose an authorised sender, personalise and preview.
- Send a test only to an approved staff email; submit, approve/reject and queue independently.
- Check worker/webhooks, delivery/failed/suppressed reporting, limits, email footer and unsubscribe.
- Desktop and mobile accessibility, table navigation, loading behaviour, branding and favicon.
- Safe backups, audit history and isolated restore rehearsal before production release.

## Current migration milestones
- **019:** faster dashboard and Campaign Lead role.
- **020:** bulk customer/group operations and supplementary staff roles.
- **021:** controlled custom customer fields.
- **022:** future import exception recording and row-by-row review.
- **2026-10-14:** Communication Preferences page and promotional unsubscribe wording, without a new migration.

The history above is a compact operational changelog, not separate Markdown for every development phase. Old documentation remains recoverable through Git history if needed.

## Release decision
Keep `EMAIL_DELIVERY_ENABLED=false` unless the bank has confirmed the target provider quota, sender verification, approved recipient purpose, independent approval policy, the worker scheduler and monitoring. No deployment, database mutation, production send or automatic Git push is performed by a source ZIP alone.

## Batch 1 (Migration 027) — development checks
- Source-of-truth: latest available 026 package corresponding to GitHub main at the time of preparation. This package does **not** update GitHub or Supabase.
- Built the single-bank app shell, a guarded `SINGLE_COMPANY_ORG_ID` resolver, the bank-only Administration Centre, dynamic department creation/archive, custom access roles, and audited individual permission controls.
- Preserved the existing SMS pilot, marketing consent, independent campaign approval, current email providers, template editor and migrations 001–026.
- 44 focused source/regression checks passed in the available Node 22 environment; 180 JS/TS source files parsed with no syntax errors or unresolved local imports. Full Node 24 `npm ci`, lint, typecheck, and production build not verified here because the dependency tarballs are unavailable offline; **do not enable production delivery based on these source checks**.
- Before production: apply Migration 027 to a staging Supabase clone; verify Super Admin vs delegated Admin, cross-department RLS, self-elevation denial, user invitation acceptance, sender settings, auth/cookies and the full four-gate Node 24 pipeline.

## Batch 2A (Migration 028) — visual template canvas
- Baseline: supplied Batch 1 / 027 full source, preserving its administration changes. Compared its template studio, design schema, renderer and template page to current GitHub default-branch versions: all four matched before this update. This is a source package, not a deployed release or full-repository GitHub synchronisation.
- Added a responsive selectable canvas, inline shape text, rectangle/oval/pill/panel/banner sections, property controls, keyboard reorder buttons, desktop drag reorder, duplicate/remove, bounded undo/redo and mobile width preview. Existing presets and approved image uploads remain.
- Extended structured shape validation and table-backed rendering; Migration 028 updates the existing template-saving RPC without resetting records, modifying approval policies or enabling delivery. Permission checks and bank media ownership checks remain.
- Repeated saves now retain the newly created template ID instead of creating another copy. Saved draft templates are displayed as ready to use; existing campaign loading already accepts them without template approval.
- Corrected the inherited site navigation schema, which rejected Batch 1's internal Workspace and Help routes and prevented a production build.
- Node 24.19.0: dependency installation, TypeScript checking and production build passed. ESLint reports zero errors and two existing unused-variable warnings (campaigns page and workspace shell). No automated test suite or real customer sends were run, in line with the requested scope. No Supabase migration, authenticated browser flow or inbox rendering was exercised; apply and verify 028 in the bank's controlled environment before operational use.
- Remaining Batch 2 scope: department/branch data isolation, Admin Design Studio, free-position layers, opacity, reusable groups and multi-column canvas. Loan register/reminder workflows remain in later batches. Existing internal reminders have not been relabelled as customer loan reminders.
