-- CHARIS 056 | Credit repayment due-date reminders: detection ONLY, never automatic sending.
-- Run after migration 055 in staging first. Additive: no existing loans, batches or holds are deleted.
BEGIN;

CREATE TABLE IF NOT EXISTS public.charis_credit_auto_rules_056 (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 enabled boolean NOT NULL DEFAULT false,
 offsets integer[] NOT NULL DEFAULT ARRAY[4,3,0]::integer[],
 channel text NOT NULL DEFAULT 'email' CHECK(channel IN ('email','sms')),
 max_daily integer NOT NULL DEFAULT 100 CHECK(max_daily BETWEEN 1 AND 200),
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT credit_auto_offsets_056 CHECK(cardinality(offsets) BETWEEN 1 AND 8)
);
INSERT INTO public.charis_credit_auto_rules_056(organization_id)
 SELECT organization_id FROM public.charis_credit_reminder_policy
 ON CONFLICT(organization_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.charis_credit_auto_candidates_056 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 loan_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 due_on date NOT NULL,
 offset_days integer NOT NULL CHECK(offset_days BETWEEN -14 AND 30),
 scheduled_for date NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','drafted','dismissed','stale')),
 batch_id uuid,
 resolved_by uuid REFERENCES auth.users(id),
 generated_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT credit_auto_loan_fk_056 FOREIGN KEY (organization_id,loan_id) REFERENCES public.charis_loans(organization_id,id),
 CONSTRAINT credit_auto_contact_fk_056 FOREIGN KEY (organization_id,contact_id) REFERENCES public.contacts(organization_id,id),
 CONSTRAINT credit_auto_batch_fk_056 FOREIGN KEY (organization_id,batch_id) REFERENCES public.charis_credit_reminder_batches(organization_id,id),
 CONSTRAINT credit_auto_unique_056 UNIQUE (organization_id,loan_id,channel,offset_days,due_on)
);
CREATE INDEX IF NOT EXISTS credit_auto_pending_056 ON public.charis_credit_auto_candidates_056(organization_id,status,scheduled_for DESC);
CREATE INDEX IF NOT EXISTS credit_auto_loan_056 ON public.charis_credit_auto_candidates_056(organization_id,loan_id);
ALTER TABLE public.charis_credit_auto_rules_056 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_credit_auto_candidates_056 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_credit_auto_rules_056,public.charis_credit_auto_candidates_056 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_credit_auto_rules_056,public.charis_credit_auto_candidates_056 TO authenticated;
DROP POLICY IF EXISTS credit_auto_rules_read_056 ON public.charis_credit_auto_rules_056;
CREATE POLICY credit_auto_rules_read_056 ON public.charis_credit_auto_rules_056 FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'credit_reminders.view') OR public.charis_has_permission(organization_id,'credit_reminders.settings'));
DROP POLICY IF EXISTS credit_auto_candidate_read_056 ON public.charis_credit_auto_candidates_056;
CREATE POLICY credit_auto_candidate_read_056 ON public.charis_credit_auto_candidates_056 FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'credit_reminders.view') AND public.charis_can_view_customer(organization_id,contact_id));

-- Rules are controlled by bank staff holding the existing credit-reminder settings capability.
CREATE OR REPLACE FUNCTION public.charis_credit_auto_rules_save_056(
 p_org uuid,p_enabled boolean,p_offsets integer[],p_channel text,p_max integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'credit_reminders.settings') THEN RAISE EXCEPTION 'Reminder settings permission required'; END IF;
 IF p_enabled IS NULL OR p_offsets IS NULL OR cardinality(p_offsets) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT v) FROM unnest(p_offsets) v)<>cardinality(p_offsets)
  OR EXISTS (SELECT 1 FROM unnest(p_offsets) v WHERE v IS NULL OR v NOT BETWEEN -14 AND 30)
  OR p_channel NOT IN ('email','sms') OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'Choose 1-8 different day offsets (14 days overdue to 30 days before), one channel and a valid daily limit'; END IF;
 INSERT INTO public.charis_credit_auto_rules_056(organization_id,enabled,offsets,channel,max_daily,updated_by,updated_at)
 VALUES (p_org,p_enabled,p_offsets,p_channel,p_max,auth.uid(),now())
 ON CONFLICT(organization_id) DO UPDATE SET enabled=excluded.enabled,offsets=excluded.offsets,
 channel=excluded.channel,max_daily=excluded.max_daily,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.auto_rules_changed','credit_reminder_rules',p_org::text,
 jsonb_build_object('enabled',p_enabled,'offsets',p_offsets,'channel',p_channel,'max_daily',p_max));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_auto_rules_save_056(uuid,boolean,integer[],text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_credit_auto_rules_save_056(uuid,boolean,integer[],text,integer) TO authenticated;

-- Inference from the internal loan register is not reconciliation of the core banking ledger.
-- This function ONLY creates candidate suggestions. It never calls a delivery provider or creates an attested batch.
CREATE OR REPLACE FUNCTION public.charis_credit_auto_generate_056(p_org uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rule public.charis_credit_auto_rules_056;v_today date:=(now() AT TIME ZONE 'Africa/Lagos')::date;v_count integer:=0;v_today_count integer:=0;
BEGIN
 IF auth.role()<>'service_role' AND NOT public.charis_has_permission(p_org,'credit_reminders.settings')
 THEN RAISE EXCEPTION 'Reminder automation access required';END IF;
 SELECT * INTO v_rule FROM public.charis_credit_auto_rules_056 WHERE organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR NOT v_rule.enabled THEN RETURN 0; END IF;
 -- Expire suggestions which no longer match the loan register. Staff must recheck core banking data.
 UPDATE public.charis_credit_auto_candidates_056 s SET status='stale',updated_at=now()
 WHERE s.organization_id=p_org AND s.status='pending' AND
 (NOT EXISTS(SELECT 1 FROM public.charis_loans l JOIN public.contacts c
     ON c.organization_id=l.organization_id AND c.id=l.contact_id
     WHERE l.organization_id=s.organization_id AND l.id=s.loan_id AND l.status='active'
      AND l.due_on=s.due_on AND c.archived_at IS NULL
      AND (CASE WHEN s.channel='email' THEN nullif(btrim(coalesce(c.email,'')),'')
                ELSE nullif(btrim(coalesce(c.phone,'')),'') END) IS NOT NULL)
   OR NOT EXISTS(SELECT 1 FROM public.charis_loans l WHERE l.organization_id=s.organization_id AND l.id=s.loan_id
      AND l.total_due>(SELECT coalesce(sum(r.amount),0) FROM public.charis_loan_repayments r
       WHERE r.organization_id=l.organization_id AND r.loan_id=l.id)));

 SELECT count(*) INTO v_today_count FROM public.charis_credit_auto_candidates_056
 WHERE organization_id=p_org AND (generated_at AT TIME ZONE 'Africa/Lagos')::date=v_today;
 IF v_today_count>=v_rule.max_daily THEN RETURN 0; END IF;
 WITH eligible AS (
  SELECT l.organization_id,l.id AS loan_id,l.contact_id,l.due_on,o.offset_days,v_rule.channel AS channel
  FROM public.charis_loans l JOIN public.contacts c
    ON c.organization_id=l.organization_id AND c.id=l.contact_id
  CROSS JOIN LATERAL unnest(v_rule.offsets) AS o(offset_days)
  WHERE l.organization_id=p_org AND l.status='active' AND c.archived_at IS NULL
   AND l.due_on-o.offset_days=v_today
   AND (CASE WHEN v_rule.channel='email' THEN nullif(btrim(coalesce(c.email,'')),'')
              ELSE nullif(btrim(coalesce(c.phone,'')),'') END) IS NOT NULL
   AND (v_rule.channel<>'email' OR NOT EXISTS (
     SELECT 1 FROM public.email_suppressions s
     WHERE s.organization_id=p_org AND lower(s.email)=lower(c.email)))
   AND l.total_due>(SELECT coalesce(sum(r.amount),0) FROM public.charis_loan_repayments r
     WHERE r.organization_id=p_org AND r.loan_id=l.id)
   AND NOT EXISTS (SELECT 1 FROM public.charis_credit_auto_candidates_056 old
      WHERE old.organization_id=p_org AND old.loan_id=l.id AND old.channel=v_rule.channel
       AND old.offset_days=o.offset_days AND old.due_on=l.due_on)
   ORDER BY l.due_on,l.id,o.offset_days DESC LIMIT (v_rule.max_daily-v_today_count)
 ), inserted AS (
   INSERT INTO public.charis_credit_auto_candidates_056
      (organization_id,loan_id,contact_id,due_on,offset_days,scheduled_for,channel)
   SELECT organization_id,loan_id,contact_id,due_on,offset_days,v_today,channel FROM eligible WHERE true
   ON CONFLICT(organization_id,loan_id,channel,offset_days,due_on) DO NOTHING
   RETURNING id
 ) SELECT count(*) INTO v_count FROM inserted;
 IF v_count>0 THEN
  INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  VALUES(p_org,auth.uid(),'credit.auto_candidates_generated','credit_reminder_rules',p_org::text,
   jsonb_build_object('count',v_count,'day',v_today));
 END IF;
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_auto_generate_056(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_credit_auto_generate_056(uuid) TO authenticated,service_role;

-- Resolve suggestions only through audited authenticated RPCs; batch drafts require actual ledger attestation.
CREATE OR REPLACE FUNCTION public.charis_credit_auto_resolve_056(p_org uuid,p_id uuid,p_action text,p_batch uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_s public.charis_credit_auto_candidates_056;
BEGIN
 IF NOT public.charis_has_permission(p_org,'credit_reminders.create') OR NOT public.charis_has_permission(p_org,'credit_reminders.view')
 THEN RAISE EXCEPTION 'Reminder preparation permission required'; END IF;
 SELECT * INTO v_s FROM public.charis_credit_auto_candidates_056 WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR v_s.status<>'pending' OR NOT public.charis_can_view_customer(p_org,v_s.contact_id)
 THEN RAISE EXCEPTION 'Suggestion is unavailable or already handled';END IF;
 IF p_action='drafted' THEN
  IF p_batch IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.charis_credit_reminder_batches b
    JOIN public.charis_credit_reminder_items i ON i.organization_id=b.organization_id AND i.batch_id=b.id
    WHERE b.organization_id=p_org AND b.id=p_batch AND b.created_by=auth.uid()
     AND b.reconciled_attestation AND b.channel=v_s.channel
     AND i.loan_id=v_s.loan_id AND i.due_on=v_s.due_on
  ) THEN RAISE EXCEPTION 'A verified draft for this exact loan and channel is required'; END IF;
 ELSIF p_action='dismiss' THEN
  IF p_batch IS NOT NULL THEN RAISE EXCEPTION 'Unexpected batch';END IF;
 ELSE RAISE EXCEPTION 'Unsupported suggestion action'; END IF;
 UPDATE public.charis_credit_auto_candidates_056 SET status=CASE WHEN p_action='drafted' THEN 'drafted' ELSE 'dismissed' END,
 batch_id=CASE WHEN p_action='drafted' THEN p_batch ELSE NULL END,resolved_by=auth.uid(),updated_at=now()
 WHERE organization_id=p_org AND id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES (p_org,auth.uid(),'credit.auto_suggestion_'||p_action,'credit_reminder',p_id::text,
 jsonb_build_object('batch_id',p_batch));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_auto_resolve_056(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_credit_auto_resolve_056(uuid,uuid,text,uuid) TO authenticated;
COMMIT;
