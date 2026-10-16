-- Charis 045 — restore legitimate sender-administrator read access to email budgets.
-- Root defect: migration 025 revoked SELECT on charis_email_monthly_budget
-- but did not re-grant it or create a SELECT policy. This breaks provider routing UI.
-- Safe: no sends, no recipient changes, no route changes, no data deletion.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.charis_email_monthly_budget') IS NULL THEN
    RAISE EXCEPTION 'Required table missing. Inspect migration 025 before applying repair 045.';
  END IF;
END $$;

GRANT SELECT ON TABLE public.charis_email_monthly_budget TO authenticated;

DROP POLICY IF EXISTS charis_email_budget_admin_read_045
  ON public.charis_email_monthly_budget;
CREATE POLICY charis_email_budget_admin_read_045
  ON public.charis_email_monthly_budget
  FOR SELECT TO authenticated
  USING (public.can_manage_senders(organization_id));

NOTIFY pgrst, 'reload schema';
COMMIT;
