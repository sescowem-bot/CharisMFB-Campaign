# Charis Campaign Centre — Final release hardening (source revision 035)

**Type:** application/source update only — **NO SQL Migration 035**.

## What changed

- Retired the old multi-company sender mutation interface from the active server action. The legacy `SenderForm` is now accepted **only for an authorised test email** using the configured Charis organisation and a currently verified, Charis-connected sender. Create/edit/link sender controls continue using the dedicated Charis actions.
- Removed global/multi-company provider configuration RPC fallbacks from Charis Administration. Existing authorised admin forms now use only `charis_provider_configure` with the configured bank organisation and `can_manage_senders` permission.
- Validated the configured Charis organisation before the provider page renders. Domain refresh status writes are scoped by organisation ID as well as domain ID.
- Improved the delivery status display: enabling an environment flag is not represented as proof that customer email delivery is operational.
- Removed the release checker’s legacy PAYSTACK/billing branch. It requires a real Charis organisation UUID and checks that campaign delivery and multi-provider routing are disabled **before acceptance**.
- Updated test assertions for the current visual canvas, navigation, sender flows, and release environment. Added five source-level safety regression tests.

## Deployment status and critical prerequisites

- GitHub baseline: `7fc0b9efcca6028df05b567b4037ed1cf38ea96a` (latest confirmed READY production deployment before this upgrade).
- **Do not apply migration 035** — it does not exist and is not needed.
- The user's corrected Migration 032 succeeded. Installation of 033 and 034 **has not been confirmed**. If either is missing, run only the missing migration **in numeric order**, with an approved database backup and the appropriate installation guide.
- Do not overwrite already applied migrations or run 001–034 as one fresh installer.
- `SINGLE_COMPANY_ORG_ID` must be the UUID for the existing active organisation with `slug='charis-mfb'`; do not substitute a dummy UUID in Vercel.
- Keep `EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false`, and the GitHub scheduled delivery worker OFF until bank policy, sender permissions, consent, suppression, provider agreement, webhook authentication and staging acceptance are verified.

## Recommended installation

1. Keep the currently READY Vercel deployment as a rollback reference and back up the repository/database.
2. Merge the **035 PATCH** into the source from Batch 6 / GitHub commit `7fc0b9e`. A full ZIP is available if a clean copy is preferred. Do not mix two different project versions without comparing file changes.
3. On Node 24, run:
   ```sh
   npm ci
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```
4. Use **GitHub Actions** on a review branch to confirm dependency-based and database-embedded tests in a real Node 24 environment before merging to `main`. The local preparation environment contained incomplete dependency placeholders and was Node 22, so it could not certify a clean full build.
5. Review sender test, admin provider settings, role permissions, staff invitations, dashboards, branches and customer data access with separate Super Admin, Admin, Credit Officer and read-only staff accounts. Do not use live customer information in a test environment without bank approval.
6. Run `supabase/verification/035_release_readiness_readonly.sql` in Supabase. It is **read-only** and returns whether key 032–034 objects are present. Its positive results do not prove all policies or permission behaviour.
7. Deployment is considered safe for customer use only after the bank accepts authenticated browsing, SQL migrations, recipient consent, approved communications workflow, performance and backup restoration. Do not enable customer sending as part of this code upgrade.

## Test results and limitations

- Baseline local suite (before 035): **131 passed / 16 failed** of 147. Failures included 11 missing dependency/TypeScript runtime failures, four stale source-assumption checks and one release checker expecting Node 24.
- After 035: **141 passed / 11 failed** of 152 tests on the available Node 22 runtime. The remaining 11 are dependency/runtime failures (unavailable zod, pglite, svix etc. and Node 22 native `.ts` import limitations). They are **not certified as passing** until `npm ci` and Node 24 testing complete.
- Static syntax and local import inspections are recorded in `MD/CHARIS_035_TEST_RESULTS.md`.

## Rollback

Revert only the source to commit `7fc0b9e` or the last verified release if any functional regression occurs. This release introduces no database schema change. Keep delivery OFF while investigating. Never remove banking audit, notification, loan or repayment records to recover a UI feature.
