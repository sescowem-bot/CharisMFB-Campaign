# Charis Campaign Centre — Import Review and Customer Permissions

## Purpose

This release clarifies marketing permission and adds **row-by-row review for new customer imports**. It preserves the current Charis design, customer management, imported groups, campaign approval rules, and all migrations 001–021.

## The permission field

**Not confirmed**: The bank has a customer record but has not documented permission for promotional emails. The record can be saved, searched, added to a group, and maintained; it is not eligible for marketing broadcast.

**Agreed**: Staff can record consent evidence for the bank's approved marketing use. The existing database requires evidence. Do not assume consent based on an account relationship or spreadsheet import.

**Opted out**: The customer has declined marketing. Ordinary editing must not bypass the opt-out. A separate, properly approved re-subscription process is needed if the customer later opts in.

**Account and service notices are different from marketing.** Do not treat the current marketing-filtered broadcast as authorisation to send account alerts indiscriminately; the bank should approve a separate service-notice purpose and compliance controls before implementing that.

## New import review workflow

1. Open **Import contacts**, upload CSV or XLSX and choose the core and permitted extra columns.
2. Select your saved customer group (or create one) and import.
3. Review **Added**, **Duplicates** and **Invalid** counts. If there are exceptions, use **Review those rows**.
4. In **Review duplicate and invalid rows**, select the import batch. Each exception has its original Excel row number, imported identity fields, plain-English reason and current resolution status.
5. For duplicates: click **Find customer** to look up the existing record and **Keep existing customer** if appropriate. An import never overwrites marketing consent or customer details.
6. For invalid rows: click **Correct and retry** and enter correct email / E.164 phone details. The retry inserts a new customer if valid and not already present. It does not update a current customer, automatically grant marketing consent, or restore excluded extra data.
7. Use **Download review CSV** for Excel-based review, or **Mark reviewed** if a row should not be added.
8. In **Customers**, filter by **Marketing permission**. Open **Edit** on a record to document a legitimate change.

### Migration 022

Run `supabase/migrations/022_charis_import_exception_review.sql` **once**, after 021, on the existing Charis Supabase project. Take a backup beforehand.

- Adds `contact_import_issues`, a Row Level Security-protected table of *failed or duplicate* input identities and reasons (no imported custom attributes or credentials).
- Enhances the existing `import_contact_batch` RPC without changing its return signature; remains idempotent by `batch_key`.
- Adds `charis_review_import_issue`, recording staff decisions with an audit log.
- Staff without permission to manage contacts cannot read or resolve issues.
- **Historic imports**: older batch totals remain, but exact rejected and duplicate rows were not saved before 022 and cannot be reconstructed from totals. Re-upload the original spreadsheet to get a fresh review.
- Reviewed exceptions remain in the database. Agree on a retention policy with Charis's data governance team, and avoid retaining exports longer than necessary.

## Testing after deployment

- Import a 4-row CSV with one new email, one duplicate email, one invalid phone and one row missing both email and phone. Confirm 1 added, 1 duplicate, 2 invalid when there are no other existing matches.
- Review each exception by row number. Find an existing contact for the duplicate; retry the invalid row with a proper number and confirm it is added.
- Confirm marketing permission remains **Not confirmed** for imported customers, and a declined customer is not silently resubscribed.
- Verify a staff user without `can_manage_contacts` gets HTTP 403 from the review API.
- Verify the review page does not expose another organisation's records.
- Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` under Node 24.

No new environment variables or email-provider configuration are needed.
