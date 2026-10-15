-- CHARIS 033 | Batch 5: internal loan follow-ups + staff inbox (NO customer dispatch).
-- Apply once AFTER successfully applying corrected Migration 032. Preserve all existing bank data.
-- Server-action calls never write these tables directly: audited SECURITY DEFINER RPCs enforce access.
BEGIN;
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('credit_followups.view','View loan follow-ups','Credit','View assigned or created tasks for authorised customers'),
 ('credit_followups.create','Create loan follow-ups','Credit','Set a due date and assign a personal task'),
 ('credit_followups.manage','Manage team loan follow-ups','Credit','Assign or update permitted team tasks')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;

CREATE TABLE IF NOT EXISTS public.charis_credit_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 request_key uuid NOT NULL,
 loan_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 assigned_to uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 due_at timestamptz NOT NULL,
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1200),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,request_key),
 FOREIGN KEY(organization_id,loan_id) REFERENCES public.charis_loans(organization_id,id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id),
 FOREIGN KEY(organization_id,assigned_to) REFERENCES public.organization_members(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS charis_credit_followups_due_033 ON public.charis_credit_followups(organization_id,status,due_at);
CREATE INDEX IF NOT EXISTS charis_credit_followups_staff_033 ON public.charis_credit_followups(organization_id,assigned_to,status,due_at);
ALTER TABLE public.charis_credit_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_credit_followups FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_credit_followups TO authenticated;
-- No broad bank-wide RLS bypass. Row visibility also depends on bank customer scope.
CREATE POLICY charis_credit_followups_read_033 ON public.charis_credit_followups FOR SELECT TO authenticated
 USING(
  public.charis_can_view_customer(organization_id,contact_id)
  AND (public.charis_has_permission(organization_id,'credit_followups.view') OR public.charis_has_permission(organization_id,'credit_followups.manage'))
  AND (assigned_to=(SELECT auth.uid()) OR created_by=(SELECT auth.uid()) OR public.charis_has_permission(organization_id,'credit_followups.manage'))
 );

CREATE TABLE IF NOT EXISTS public.charis_staff_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 recipient_id uuid NOT NULL REFERENCES auth.users(id),
 event_key text NOT NULL CHECK(length(event_key) BETWEEN 6 AND 160),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 140),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=300),
 target_path text NOT NULL CHECK(target_path IN ('/dashboard/credit-followups')),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(organization_id,recipient_id,event_key),
 FOREIGN KEY(organization_id,recipient_id) REFERENCES public.organization_members(organization_id,user_id)
);
CREATE INDEX IF NOT EXISTS charis_staff_notifications_inbox_033 ON public.charis_staff_notifications(organization_id,recipient_id,created_at DESC);
ALTER TABLE public.charis_staff_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_staff_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_staff_notifications TO authenticated;
CREATE POLICY charis_staff_notifications_own_033 ON public.charis_staff_notifications FOR SELECT TO authenticated
 USING(recipient_id=(SELECT auth.uid()) AND EXISTS(
  SELECT 1 FROM public.organizations o JOIN public.organization_members m ON m.organization_id=o.id
  WHERE o.id=public.charis_staff_notifications.organization_id AND o.slug='charis-mfb' AND o.status='active' AND m.user_id=(SELECT auth.uid())));

-- Helper intentionally never exposes another member's sensitive customer/loan data.
CREATE OR REPLACE FUNCTION public.charis_followup_assignee_in_scope(p_org uuid,p_contact uuid,p_staff uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_org AND m.user_id=p_staff)
 AND (EXISTS(SELECT 1 FROM public.charis_staff_scope_settings s WHERE s.organization_id=p_org AND s.user_id=p_staff AND s.bank_wide)
  OR EXISTS(SELECT 1 FROM public.charis_customer_locations loc
    JOIN public.charis_staff_branch_assignments a ON a.organization_id=loc.organization_id AND a.branch_id=loc.branch_id
    WHERE loc.organization_id=p_org AND loc.contact_id=p_contact AND a.user_id=p_staff)
  OR (p_staff=auth.uid() AND public.charis_can_view_customer(p_org,p_contact)));
$$;
REVOKE ALL ON FUNCTION public.charis_followup_assignee_in_scope(uuid,uuid,uuid) FROM PUBLIC,anon;
-- Only used inside guarded internal functions; not exposed as an authenticated RPC.

CREATE OR REPLACE FUNCTION public.charis_credit_followup_create(
 p_org uuid,p_loan uuid,p_assignee uuid,p_due timestamptz,p_priority text,p_notes text,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_loan public.charis_loans;v_id uuid;v_existing public.charis_credit_followups;
BEGIN
 IF NOT public.charis_has_permission(p_org,'credit_followups.create') OR NOT public.charis_has_permission(p_org,'loans.view')
  OR NOT (public.charis_has_permission(p_org,'credit_followups.view') OR public.charis_has_permission(p_org,'credit_followups.manage'))
 THEN RAISE EXCEPTION 'Loan follow-up creation permission required';END IF;
 IF p_key IS NULL OR p_loan IS NULL OR p_assignee IS NULL OR p_due IS NULL OR p_due<now()-interval '1 day'
  OR p_due>now()+interval '2 years' OR p_priority IS NULL OR p_priority NOT IN ('low','normal','high')
  OR length(coalesce(p_notes,''))>1200 THEN RAISE EXCEPTION 'Check the follow-up details';END IF;
 SELECT * INTO v_existing FROM public.charis_credit_followups WHERE organization_id=p_org AND request_key=p_key;
 IF FOUND THEN
  IF v_existing.created_by=auth.uid() AND v_existing.loan_id=p_loan THEN RETURN v_existing.id;END IF;
  RAISE EXCEPTION 'Follow-up request key already used';
 END IF;
 SELECT * INTO v_loan FROM public.charis_loans WHERE organization_id=p_org AND id=p_loan;
 IF NOT FOUND OR v_loan.status<>'active' OR NOT public.charis_can_view_customer(p_org,v_loan.contact_id)
 THEN RAISE EXCEPTION 'The loan is unavailable';END IF;
 IF p_assignee<>auth.uid() AND NOT public.charis_has_permission(p_org,'credit_followups.manage')
 THEN RAISE EXCEPTION 'Team assignment permission required';END IF;
 IF NOT public.charis_followup_assignee_in_scope(p_org,v_loan.contact_id,p_assignee)
 THEN RAISE EXCEPTION 'Assigned staff member has no access to this customer branch';END IF;
 INSERT INTO public.charis_credit_followups(organization_id,request_key,loan_id,contact_id,assigned_to,created_by,due_at,priority,notes)
 VALUES(p_org,p_key,p_loan,v_loan.contact_id,p_assignee,auth.uid(),p_due,p_priority,coalesce(p_notes,'')) RETURNING id INTO v_id;
 INSERT INTO public.charis_staff_notifications(organization_id,recipient_id,event_key,title,body,target_path)
 VALUES(p_org,p_assignee,'followup.created.'||v_id::text,'Credit follow-up assigned',
  'A loan follow-up has been assigned to you. Open the Credit follow-ups page.','/dashboard/credit-followups')
 ON CONFLICT(organization_id,recipient_id,event_key) DO NOTHING;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.followup_created','credit_followup',v_id::text,
  jsonb_build_object('loan_id',p_loan,'assigned_to',p_assignee,'due_at',p_due));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_followup_create(uuid,uuid,uuid,timestamptz,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_credit_followup_create(uuid,uuid,uuid,timestamptz,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_credit_followup_status(p_org uuid,p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_task public.charis_credit_followups;
BEGIN
 IF p_status IS NULL OR p_status NOT IN('open','done','cancelled') THEN RAISE EXCEPTION 'Invalid follow-up status';END IF;
 SELECT * INTO v_task FROM public.charis_credit_followups WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.charis_can_view_customer(p_org,v_task.contact_id)
  OR NOT (public.charis_has_permission(p_org,'credit_followups.view') OR public.charis_has_permission(p_org,'credit_followups.manage'))
  OR NOT (v_task.assigned_to=auth.uid() OR v_task.created_by=auth.uid() OR public.charis_has_permission(p_org,'credit_followups.manage'))
 THEN RAISE EXCEPTION 'Follow-up unavailable';END IF;
 IF v_task.status=p_status THEN RETURN;END IF;
 UPDATE public.charis_credit_followups SET status=p_status,
  completed_at=CASE WHEN p_status='done' THEN now() ELSE NULL END,updated_at=now()
 WHERE organization_id=p_org AND id=p_id;
 IF v_task.created_by<>auth.uid() THEN
  INSERT INTO public.charis_staff_notifications(organization_id,recipient_id,event_key,title,body,target_path)
  VALUES(p_org,v_task.created_by,'followup.status.'||p_id::text||'.'||p_status,
   'Credit follow-up updated','A loan follow-up you created has changed status.','/dashboard/credit-followups')
  ON CONFLICT(organization_id,recipient_id,event_key) DO NOTHING;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.followup_status','credit_followup',p_id::text,jsonb_build_object('status',p_status));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_followup_status(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_credit_followup_status(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_staff_notification_read(p_org uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
   WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND o.slug='charis-mfb' AND o.status='active') THEN
   RAISE EXCEPTION 'Active bank membership required';END IF;
 UPDATE public.charis_staff_notifications SET read_at=coalesce(read_at,now())
 WHERE organization_id=p_org AND recipient_id=auth.uid() AND id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Notification unavailable'; END IF;
END;$$;
REVOKE ALL ON FUNCTION public.charis_staff_notification_read(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_notification_read(uuid,uuid) TO authenticated;
COMMIT;
