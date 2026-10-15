# Charis Campaign Centre — Batch 6, migration 034

## What changed

1. **Operational insights (`/dashboard/insights`).** Existing authorised staff can review the internal loan ledger's active loan balance, overdue/due-soon loan counts, open and overdue Credit follow-ups, Credit reminder draft status, and account-service notice status in one place. All customer-related counters are restricted by the existing branch customer scope and their corresponding module permission. The page shows *aggregate numbers only*.
2. **Bank-managed access.** New `operations.view` permission may be granted to branch-based staff without giving bank-wide `reports.view` access. Staff already granted `reports.view` can also enter Operations insights. The existing Administration Centre can delegate the permission to authorised staff. Existing customer access limits remain in effect.
3. **Audit activity (`/admin/audit`).** Filter by activity category and date, with bounded pages. Existing `audit.view` is still required; no customer names, account numbers, message bodies or audit details are shown. Audit data is never mutable here.
4. **Campaign reports.** Clicking Reports and exporting its CSV no longer require an `org` query parameter: the user's authenticated workspace is used instead of trusting a query string. Updated display type validation to accept Mailjet as an existing email provider.
5. **Help & workflows.** Documented Credit Officer task scheduling and safe interpretation of operational figures. Help links only expose Operations insights to authorised users.

## Migration 034

`supabase/migrations/034_charis_operational_insights.sql` adds one permission catalogue record and one read-only, permission-checked aggregate SQL RPC. It does not alter stored loans, contacts, repayments, campaigns, delivery workers, or permission policies and does not enable email/SMS dispatch.

- **Prerequisite:** The successfully corrected Migration 032 and Migration 033 must both be installed in the *same* Supabase database. The user previously confirmed only that Migration 032 succeeded; verify 033 before attempting 034.
- Back up the database and rehearse the migration on a staging copy first.
- Run **only** Migration 034 once its prerequisites have been confirmed. Do not re-run 001–033 or a fresh-install script.
- Run `supabase/Charis_034_Verification.sql`; this verifies objects/permissions but is *not* a cross-role security test.
- Assign `operations.view` through Administration → Roles & permissions to the appropriate staff. Do not grant broad `reports.view` simply to make the operational page visible.

## Validation before production

```bash
# Node 24, from the repository root, with the lockfile and approved environment:
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

1. Test as a bank-wide admin with reports and individual module permissions.
2. Test a branch-limited staff account with `operations.view` and loan/credit module permissions: verify only authorised branch totals are shown.
3. Test a branch-limited staff account with `operations.view` *without* `loans.view`, `credit_followups.view`, etc.: respective sections must not appear, and the SQL RPC must return zeros.
4. Test unauthorised staff and anonymous callers: no access to the RPC or route.
5. Check records and reporting date boundaries; the report's open/overdue totals are a current snapshot, whereas *completed/created in period* counts use the date filter.
6. Verify that the internal loan register agrees with approved bank records. It is not a live core banking feed.
7. Confirm existing campaign approvals, customer import, templates, held reminders, authenticated sessions and Vercel build before release. No direct delivery worker changes are present.

## Known limitations

This package was built without applying the migration to the bank's real Supabase project. A complete production build was not possible in the authoring environment: it has Node 22 and could not obtain missing npm packages. Static TypeScript/JS parse and import resolution checks were performed, and focused regression tests passed. The broader suite has longstanding Node/runtime failures and historical brittle assertions; the errors are not silenced. See the release notes.

Do not interpret `approved`, `held` or a provider-accepted message as successfully delivered to a customer's inbox or phone. No customer dispatch is enabled by Batch 6.
