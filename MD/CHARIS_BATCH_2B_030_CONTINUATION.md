# Charis Campaign Centre — Batch 2B Stabilisation (030)

## Starting point and compatibility

This is a continuation of the existing **single-bank** Charis Campaign Centre source. The package includes all earlier source files and migrations 001–029. It adds **030_charis_branch_read_guards.sql**, updates the Branches and dashboard interfaces, and adds focused regression checks. No departments, bank branches, staff, customers, campaign records, provider settings, sender identities or consent history are deleted.

The repository's last observed `main` commit was `a79c237` on 14 October 2026. This archive was prepared from the recovered previous continuation FULL ZIP rather than a live Git clone (network Git clone was unavailable). **Review the changes against the repository before replacing the live source.** Never deploy this archive by blindly overwriting a more recent production build.

## Upgrade contents

1. **Branch/customer RLS guards:** Restrictive SELECT policies layer an AND condition over historical permissive read policies. Bank-wide audience, import and campaign metadata remain limited to appropriately authorised users. Direct customer reads require permission plus assigned branch or explicit bank-wide access.
2. **Permission evaluator:** Branch-restricted staff do not retain company-wide administrative, campaign dispatch, reporting or audit capabilities through legacy roles; the Super Admin retains ownership.
3. **SQL reporting RPCs:** Existing SECURITY DEFINER campaign analytics, audience count, provider summary, delivery summary and dashboard summary now enforce appropriate bank permissions instead of granting visibility to any verified bank member. Dashboard totals are scope-aware.
4. **Staff access UI:** Changing the selected staff member loads their current bank-wide setting rather than defaulting to branch-only. Staff and customers must be selected deliberately.
5. **Customer routing:** Find older customers by name, phone or email when allocating a branch, instead of being restricted to the most recently created 100.
6. **Branch archive:** Refuses to archive a branch with assigned customers **or** staff.
7. **Dashboard links:** Show only authorised customer, campaign, approval, sending and reminder actions.

## Safe installation order (none executed)

- Back up and inspect the existing Supabase schema and applied migration history.
- For an environment ending at migration 027, apply exactly **028 → 029 → 030** in that order, once each. If 028/029 are already applied, apply only the missing later migrations; do not rerun the fresh installer.
- Review and integrate source code with the current GitHub branch; deploy via existing approved workflow with `EMAIL_DELIVERY_ENABLED=false`, `CHARIS_MULTI_PROVIDER_ENABLED=false`, and the scheduled worker disabled.
- Validate read and write access on a **staging copy** under Super Admin, bank-wide delegated administrator, branch-restricted staff, observer and unassigned new staff identities before promoting the change. Verify the legacy SECURITY DEFINER endpoints separately; a route hidden in the UI is not sufficient security.
- This package **does not** activate live email/SMS, self-approval, unrestricted customer mailing, service-notice broadcasting, loan reminders, or multi-company functionality.

## Remaining roadmap

Batch 3: Unified Communications cross-channel audience picker and administrator-defined approval policies; secure Credit loan register, repayment schedule and ownership. Batch 4: controlled Credit repayment notices and permitted provider delivery. Batch 5: recurring schedules, internal notification workflows and bulk customer allocation. Batch 6: bank-appropriate reporting, audit, responsive UI and hosted acceptance.

## Build verification

The new TS/TSX files were parsed with the globally installed TypeScript compiler. The dedicated 030 regression file can run directly via `node --test tests/charis-batch2b-030.test.mjs`. Full Next.js build, lint and typecheck require Node.js 24, dependencies and a connected environment. No Supabase execution or production acceptance has taken place.
