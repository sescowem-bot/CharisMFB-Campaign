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
