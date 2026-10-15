# Charis Credit Reminder Centre — Migration 032 SQL correction

## Issue
Migration 032 failed with PostgreSQL error `42830: there is no unique constraint matching given keys for referenced table "charis_credit_reminder_items"`.

## Cause and correction
The `charis_credit_delivery_holds` table has a composite foreign key `(organization_id, item_id)` pointing to `charis_credit_reminder_items (organization_id, id)`.
The referenced pair lacked a corresponding unique key. A non-partial `CREATE UNIQUE INDEX IF NOT EXISTS ... ON public.charis_credit_reminder_items(organization_id,id)` now runs after the referenced table is created and before the delivery-holds table is created.

## Safest steps for existing Charis Supabase project
1. **Do not drop any table or reset the database.** Ensure migrations 001–031 are already installed.
2. Use the complete corrected file `supabase/migrations/032_charis_credit_reminder_centre.sql` in Supabase SQL Editor, running it as **one script from `BEGIN;` through `COMMIT;`**. The first version was enclosed in a transaction, so a failed attempt would normally have rolled back its changes.
3. Confirm Supabase displays a successful execution. If it gives a *different* error, save the exact message; do not keep rerunning migrations blindly. Objects created in separate manual attempts can make policy creation report `already exists`.
4. Verify the foreign key exists with the read-only verification SQL in `Charis_032_Verify.sql` supplied separately.
5. Keep customer-message delivery disabled until the existing separate operational approval and provider checks are complete.

## Safe verification
The unique index only prevents duplicate `(organization_id,id)` pairs, which are already unique because `id` is the table primary key. No rows are deleted or updated.

## What has been tested
The correction was checked against the source of migrations 031–032 for reference-key consistency and confirmed to appear before the foreign key. It has **not** been executed against the bank's hosted Supabase database; this package is not a production database acceptance certificate.
