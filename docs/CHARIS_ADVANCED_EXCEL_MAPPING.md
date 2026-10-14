# Charis Campaign Centre | Advanced Excel Column Mapping

## What has changed

The previous Step 2 mapped four columns (first name, last name, email and phone). A checkbox silently selected up to twelve others. The new importer keeps those four main mappings and displays **every column in the uploaded file** below them. Staff can choose each additional field individually, rename it, and review the first five rows of both main and extra fields before importing.

- Supports CSV and XLSX, at most 5 MB, 5,000 data rows and 60 spreadsheet columns.
- Maps four core contact fields and up to **12 explicit extra fields** to customer campaign details.
- No blind import of all unmapped columns; unselected columns are omitted.
- Suggested fields include Branch, Product, City and Customer Type. Financial account references require explicit selection and are reduced to the final four digits before upload.
- Existing authenticated import API checks, organisation ownership, duplicate handling, group creation and audit trail remain in place.
- Imports continue to use **Unknown** marketing consent. An imported contact is not automatically eligible for email marketing.
- Import requests with extra fields use 25 rows per batch to respect the existing 95 KB request limit.

## Installation

Use the **small patch ZIP** for a repository already running Charis migration 021 and matching the October 13 commit `27e91e0`. Extract it into the GitHub project root and overwrite the included paths. Alternatively, use the full project ZIP (preserve your `.git` directory).

**Changed/new source files**:

- `components/contact-import-wizard.tsx` — full-column mapping UI and review.
- `app/api/contacts/import/route.ts` — stronger custom-field validation.
- `lib/contacts/import-mapping.mjs` — column normalization and masked values.
- `lib/contacts/import-mapping.d.mts` — TypeScript declarations.
- `tests/charis-mapping-columns.test.mjs` — regression tests.

No new Supabase migration is required for this import UI if migrations 001–021 have already been installed. Do not rerun the complete SQL installation or overwrite customer records.

Use Node.js 24:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

After the checks succeed:

```bash
git add -A
git commit -m "Improve Charis Excel column mapping"
git push origin main
```

## How to use

1. Sign in to Charis and open **Import contacts**.
2. Upload the CSV or XLSX file. Check the four core mappings. Ensure Email or Phone is set.
3. Under **Other spreadsheet columns**, tick each detail you want saved. You can change its field name (example: `branch_name`, `product`, `account_reference`). You can also click **Select suggested fields** for common non-sensitive options.
4. Use **Step 3** to select an existing group or create a new group.
5. Check the preview table in **Step 4**. It shows selected additional fields, with account references masked. Then import.
6. Manage contacts and use approved details in campaigns. Email marketing still requires documented consent, a verified sending identity and independent approval.

**Why only twelve extra fields?** The current Supabase import contract intentionally limits the per-customer custom JSON object to twelve keys. The new UI exposes this limit clearly rather than pretending all spreadsheet columns are stored. Supporting an unlimited number would require a separately reviewed data design and different privacy and performance controls.

## Important banking precautions

Do not bulk-import full account numbers, customer balances, BVN, NIN, passwords, PINs, card data or sensitive personal identifiers as marketing personalization fields. The importer blocks obvious sensitive column names and shortens approved account references. Verify that the spreadsheet contains only bank-authorised communication information before uploading it.

## Verification scope

The focused JavaScript mapping and existing CSV parsing tests passed. The modified TypeScript source parsed successfully. **A full Next.js production build and live Supabase/Resend import still need verification in your environment.** No live database or GitHub changes were made here.
