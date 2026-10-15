-- CHARIS 034 | Batch 6: permission-scoped operational insight counters.
-- Additive, read-only reporting function. Requires successfully applied migrations 031-033.
-- Never enable customer delivery or change existing transaction records.
BEGIN;
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('operations.view','View operational insights','Oversight','See aggregated credit and account-service activity within permitted customer branches')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;

CREATE OR REPLACE FUNCTION public.charis_operational_insights(
 p_org uuid,p_from timestamptz,p_until timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_loans jsonb;
 v_followups jsonb;
 v_reminders jsonb;
 v_notices jsonb;
 v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
 -- All four sections are conditioned on the caller's EXISTING capabilities. A reports
 -- grant alone never provides access to a customer's loan, notice or reminder.
 IF p_org IS NULL OR NOT (public.charis_has_permission(p_org,'operations.view')
  OR public.charis_has_permission(p_org,'reports.view')) THEN
  RAISE EXCEPTION 'Operational reporting permission required';
 END IF;
 IF p_from IS NULL OR p_until IS NULL OR p_until <= p_from
    OR p_until - p_from > interval '366 days' THEN
  RAISE EXCEPTION 'Select a valid report window of up to 366 days';
 END IF;

 WITH visible AS (
  SELECT l.id,l.due_on,l.status,
   greatest(l.total_due-coalesce((
    SELECT sum(r.amount) FROM public.charis_loan_repayments r
    WHERE r.organization_id=l.organization_id AND r.loan_id=l.id
   ),0),0)::numeric(18,2) AS due
  FROM public.charis_loans l
  WHERE l.organization_id=p_org
   AND (public.charis_has_permission(p_org,'loans.view')
    OR public.charis_has_permission(p_org,'loans.manage')
    OR public.charis_has_permission(p_org,'loans.repayments'))
   AND public.charis_can_view_customer(p_org,l.contact_id)
 )
 SELECT jsonb_build_object(
   'active',count(*) FILTER(WHERE status='active' AND due>0),
   'overdue',count(*) FILTER(WHERE status='active' AND due>0 AND due_on<v_today),
   'due_soon',count(*) FILTER(WHERE status='active' AND due>0 AND due_on BETWEEN v_today AND v_today+7),
   'outstanding',coalesce(sum(due) FILTER(WHERE status='active'),0)
 ) INTO v_loans FROM visible;

 SELECT jsonb_build_object(
  'open',count(*) FILTER(WHERE f.status='open'),
  'overdue',count(*) FILTER(WHERE f.status='open' AND f.due_at<now()),
  'completed_in_period',count(*) FILTER(WHERE f.status='done' AND f.completed_at>=p_from AND f.completed_at<p_until)
 ) INTO v_followups
 FROM public.charis_credit_followups f
 WHERE f.organization_id=p_org
  AND (public.charis_has_permission(p_org,'credit_followups.view')
    OR public.charis_has_permission(p_org,'credit_followups.manage'))
  AND (f.assigned_to=auth.uid() OR f.created_by=auth.uid()
    OR public.charis_has_permission(p_org,'credit_followups.manage'))
  AND public.charis_can_view_customer(p_org,f.contact_id);

 SELECT jsonb_build_object(
  'submitted',count(*) FILTER(WHERE b.status='submitted'),
  'approved',count(*) FILTER(WHERE b.status='approved'),
  'held',count(*) FILTER(WHERE b.status='held'),
  'created_in_period',count(*) FILTER(WHERE b.created_at>=p_from AND b.created_at<p_until)
 ) INTO v_reminders
 FROM public.charis_credit_reminder_batches b
 WHERE b.organization_id=p_org
  AND public.charis_has_permission(p_org,'credit_reminders.view')
  AND EXISTS(SELECT 1 FROM public.charis_credit_reminder_items i
   WHERE i.organization_id=p_org AND i.batch_id=b.id
    AND public.charis_can_view_customer(p_org,i.contact_id));

 SELECT jsonb_build_object(
  'submitted',count(*) FILTER(WHERE s.status='submitted'),
  'approved',count(*) FILTER(WHERE s.status='approved'),
  'created_in_period',count(*) FILTER(WHERE s.created_at>=p_from AND s.created_at<p_until)
 ) INTO v_notices
 FROM public.charis_service_notices s
 WHERE s.organization_id=p_org
  AND public.charis_has_permission(p_org,'service_notices.view')
  AND public.charis_can_view_customer(p_org,s.contact_id);

 RETURN jsonb_build_object('as_of',now(),'period_from',p_from,'period_until',p_until,
  'loans',v_loans,'followups',v_followups,'reminders',v_reminders,'notices',v_notices);
END;$$;
REVOKE ALL ON FUNCTION public.charis_operational_insights(uuid,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_operational_insights(uuid,timestamptz,timestamptz) TO authenticated;

COMMIT;
