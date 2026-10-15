# Charis Campaign Centre — Development Continuation

## Baseline and provenance

- Based on the last retrievable full upgrade: `Charis_Batch_2A_Visual_Template_Canvas_028_FULL.zip`, saved 14 October 2026.
- Current GitHub main was observed at commit `a79c23781b25db19a50b43e797ccae43e723828f` with migrations through 027. It may contain later edits than the saved 028 archive. **Review and merge changes before pushing; do not blindly overwrite the repository.**
- No live database changes, GitHub commits, deployments, outbound emails, or outbound SMS were made in this continuation.

## Source changes in this release

1. Migration 029 — branch directory, staff-wide and branch-specific visibility, customer location records, customer RLS and tightened reads for communications.
2. `/dashboard/branches` — bank branch management, staff branch assignments and customer routing.
3. `/dashboard/customers` — read-only, searchable customer workspace with access enforced by contact RLS.
4. `/dashboard/communications` — Phase 05 started: unified Email/SMS overview with links to existing composition, approvals and delivery.
5. Navigation and Help & workflows upgraded for the new modules.

## Install order

Existing Supabase: apply **only missing migrations** in order **027 → 028 → 029**. Use `supabase/migrations/029_charis_branch_customer_scopes.sql` only if 027 and 028 are already installed. Do not run any fresh installer or delete bank data.

Required environment remains the same (`SINGLE_COMPANY_ORG_ID` etc.); no new API keys or external integrations are required for these interfaces.

## Validation performed and limitations

- TypeScript syntax parsing passed for every new/modified TS/TSX file.
- Source file and migration structure checks passed.
- Could not run full `npm ci`, typecheck, lint, unit tests or production build because the runtime has Node 22 while the repository declares Node 24, and the npm registry was unreachable (EAI_AGAIN). **Do not treat this package as production-build-verified.**
- Database migration has not been executed against a real or staging Supabase database; RLS policy behaviour needs staging review before rollout.

## Unfinished work

Batch 3, Phase 05: unified cross-channel audience selection and admin-configurable approval policies. Batch 3, Phase 06: secure loan register and Credit ownership. Batch 4: configurable Credit reminders/approvals and integration with the existing providers. Batch 5: scheduling, notifications and advanced audiences. Batch 6: reports, audit, production hardening and UX consolidation.

The ordinary staff UI contains only workflow guidance; no technical testing module was added.
