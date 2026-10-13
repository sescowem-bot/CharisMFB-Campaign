## October 2026 operational workflow repair (migration 020)

This release includes multi-customer actions, bulk group membership, staff role combinations, selectable verified staff test recipients, audience shortcuts and improved approval guidance. Back up production and apply migrations 019 and 020 in sequence if they are not installed. See `docs/CHARIS_OPERATIONS_020_RELEASE.md`. Keep live customer dispatch disabled until independently tested.

# Charis Campaign Centre

Dedicated customer communication platform for **Charis Microfinance Bank Ltd**.

## Product modules

- Branded staff portal and role-based access
- Customer records, import, consent, archive, restore and guarded deletion
- Single, multiple and saved-group recipient selection
- Email templates and visual campaign editing
- Independent approval/rejection with audit history
- Verified Resend sender management and restricted staff test emails
- Delivery queue, background dispatch interfaces and analytics
- Logo, favicon and safe brand media management
- Staff invitations, permissions, reports and administrator audit

See `docs/CHARIS_PREMIUM_PRODUCT_BLUEPRINT.md` for page structure, design tokens, components, workflow, modules and release scope.

## Install and verify

Node.js 24 is required.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Copy `.env.charis.example` to `.env.local` for local development (never commit secrets). Configure Supabase, Resend and the single company UUID. The database migration history lives in `supabase/migrations/` (001–018). **Do not rerun the initial install SQL against an existing production database**.

## Design and production status

The official supplied bank logo is bundled as `public/charis-official-logo.png`. The browser icon uses the same mark; a bank administrator can upload replacements using Brand Settings. The premium CSS has its own Charis-only namespace and requires no third-party UI framework.

Source syntax and focused regressions are tested. Production build, provider integration, database migrations, background dispatch and end-to-end bank user acceptance must still be verified; see `docs/PREMIUM_RELEASE_CHECKLIST.md`. SMS is not yet implemented.

The original schema and historical migration code are retained to avoid damaging existing Charis account, campaign and audit history. Legacy public billing, subscription signup and generic marketing routes have been removed from the app router. Selected historic platform admin routes remain blocked in single-company mode pending a separate compatibility review.

## October 13, 2026 — Sign-in, dashboard and permissions

Run **`supabase/migrations/019_charis_dashboard_and_campaign_lead.sql`** in an existing Charis Supabase project after migration 018. This migration adds a single-query dashboard summary and the **Campaign Lead** role (create, independently approve, dispatch). Self-approval remains blocked.

The updated code redirects an already authenticated user away from `/login`, avoids redundant Auth requests on public middleware routes, and caches bank logo/favicon metadata for a short period. See `docs/CHARIS_LOGIN_SPEED_AND_CAMPAIGN_LEAD.md` for rollout and acceptance steps.

Do not rerun the original fresh-install SQL on a live Charis database. The historical master installer is retained for reference and does not replace the incremental migration workflow.
