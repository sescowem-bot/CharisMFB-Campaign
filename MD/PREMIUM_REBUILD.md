# Charis Campaign Centre — Premium rebuild (v1.0)

## 1. Page structure
Public: `/login`, `/auth/setup-password`, `/unsubscribe` (all branded, no marketing site; `/` redirects to the dashboard).
Workspace (`/dashboard/*`): Overview · Campaigns (list, create, edit) · Approvals · Send & delivery · Reports · Customers · Import contacts · Saved groups · Smart segments · Email templates · Brand & footer · Sender settings · Team access.
Admin: `/admin/providers`, `/admin/audit`.

## 2. Component system
Tokens: `lib/brand.ts` + CSS variables in `app/globals.css` (purple #40239A, green #38EF92 from the logo).
Primitives (`components/ui.tsx`): StatusBadge, Stat, Tile, Callout, EmptyState, Card, WorkflowStepper. Shell: `workspace-shell.tsx` (+ `nav-link.tsx`). Public wrapper: `public-card.tsx`.

## 3. Workflow
Draft → Review (independent approver) → Approved → Sent/tracked. Stepper shown on every campaign. Import: Upload → Map → Preview → Import.

## 4. Premium UX rules
Purple leads, green is a small accent; one radius/shadow scale; 44px inputs; visible focus rings; consistent status colours; empty states with a next action; skeleton loading; mobile off-canvas nav; reduced-motion support; a "Test mode / Live sending" indicator always visible.

## 5. Removed
Pricing, billing/Paystack, plans, register, public marketing/CMS pages, multi-company admin and owner workspace, company switching, standalone footers page (merged into Brand & footer). Legacy URLs redirect.

## 6. Rebuilt
Design system, app shell, login, overview, campaigns page chrome + stepper, approvals, delivery, reports, customers, imports, groups, segments, templates, brand & footer, team, senders, error/404/loading, unsubscribe.

## 7. Kept (unchanged)
All Supabase migrations and RLS, server actions, delivery worker, provider/webhook routes, consent and suppression logic, audit log, CSV/Excel import, tests.

## Verification
`tsc` clean, ESLint 0 errors, `next build` passes, 87/89 tests pass. The 2 failures are environmental: the isolated-Postgres test needs a Supabase `storage` schema (migration 018), and the release-check test expects Node 24 (sandbox had Node 22). No live Supabase, email sending or deployment was exercised.
