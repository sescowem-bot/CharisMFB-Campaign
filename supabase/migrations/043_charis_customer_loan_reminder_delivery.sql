-- Charis 043 | Customer loan-reminder emails and staff-task separation.
-- Apply only after migrations 001-042 as applicable. No records removed; no send on install.
-- Actual email sending requires explicit Vercel gates and bank/provider approval.
BEGIN;
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('credit_reminders.dispatch','Send approved customer loan reminders','Credit','Submit an individually approved held reminder to the bank-authorised service email provider')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;
-- A hold belongs to the credit reminder batch. Composite unique index supports scoped FKs.
CREATE UNIQUE INDEX IF NOT EXISTS charis_credit_holds_org_id_uidx_043
 ON public.charis_credit_delivery_holds(organization_id,id);

CREATE TABLE IF NOT EXISTS public.charis_credit_email_dispatches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 hold_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 item_id uuid NOT NULL,
 recipient_id uuid NOT NULL,
 provider text NOT NULL DEFAULT 'brevo' CHECK(provider='brevo'),
 status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','accepted','delivered','failed','uncertain','blocked','bounced','complained','unsubscribed')),
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 provider_message_id text,
 result_reason text,
 requested_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,hold_id),
 FOREIGN KEY(organization_id,hold_id) REFERENCES public.charis_credit_delivery_holds(organization_id,id),
 FOREIGN KEY(organization_id,item_id) REFERENCES public.charis_credit_reminder_items(organization_id,id),
 FOREIGN KEY(organization_id,batch_id) REFERENCES public.charis_credit_reminder_batches(organization_id,id),
 FOREIGN KEY(organization_id,recipient_id) REFERENCES public.contacts(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_credit_dispatch_recent_043 ON public.charis_credit_email_dispatches(organization_id,requested_at DESC);
ALTER TABLE public.charis_credit_email_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_credit_email_dispatches FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_credit_email_dispatches TO authenticated;
CREATE POLICY charis_credit_dispatch_scope_read_043 ON public.charis_credit_email_dispatches FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'credit_reminders.view') AND public.charis_can_view_customer(organization_id,recipient_id));

-- Bank operator must explicitly request each dispatch. A failure or timeout never automatically retries.
-- Guard in a single database transaction and lock the held row. No balance/contact details are audited.
CREATE OR REPLACE FUNCTION public.charis_credit_email_claim_043(p_org uuid,p_hold uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_h public.charis_credit_delivery_holds;v_i public.charis_credit_reminder_items;
 v_batch public.charis_credit_reminder_batches;v_loan public.charis_loans;v_contact public.contacts;
 v_amount numeric(18,2);v_from text;v_reply text;v_name text;v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.charis_has_permission(p_org,'credit_reminders.dispatch')
  OR NOT public.charis_has_permission(p_org,'credit_reminders.queue')
  OR NOT public.charis_has_permission(p_org,'credit_reminders.view')
 THEN RAISE EXCEPTION 'Loan reminder dispatch permission required'; END IF;
 SELECT * INTO v_h FROM public.charis_credit_delivery_holds WHERE organization_id=p_org AND id=p_hold FOR UPDATE;
 IF NOT FOUND OR v_h.status<>'held' OR v_h.channel<>'email' THEN RAISE EXCEPTION 'An approved held email is required';END IF;
 IF EXISTS(SELECT 1 FROM public.charis_credit_email_dispatches WHERE organization_id=p_org AND hold_id=p_hold) THEN
   RAISE EXCEPTION 'This loan reminder already has a delivery attempt. Check its recorded outcome; do not resend.';
 END IF;
 SELECT * INTO v_batch FROM public.charis_credit_reminder_batches WHERE organization_id=p_org AND id=v_h.batch_id;
 SELECT * INTO v_i FROM public.charis_credit_reminder_items WHERE organization_id=p_org AND id=v_h.item_id AND batch_id=v_h.batch_id;
 IF NOT FOUND OR v_batch.status<>'held' OR v_batch.approved_at IS NULL OR v_batch.reviewed_by IS NULL
  OR v_batch.channel<>'email' OR NOT v_batch.reconciled_attestation THEN RAISE EXCEPTION 'Unapproved or incomplete reminder'; END IF;
 IF NOT public.charis_can_view_customer(p_org,v_i.contact_id) THEN RAISE EXCEPTION 'Customer branch access denied'; END IF;
 IF v_batch.approved_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'Approval has expired. Reconcile loan and obtain fresh approval.';END IF;
 SELECT * INTO v_loan FROM public.charis_loans WHERE organization_id=p_org AND id=v_i.loan_id;
 IF NOT FOUND OR v_loan.status<>'active' THEN RAISE EXCEPTION 'Loan is no longer active';END IF;
 SELECT * INTO v_contact FROM public.contacts WHERE organization_id=p_org AND id=v_i.contact_id;
 IF NOT FOUND OR v_contact.archived_at IS NOT NULL
  OR lower(btrim(coalesce(v_contact.email,'')))<>lower(btrim(v_i.channel_destination))
 THEN RAISE EXCEPTION 'Loan or customer record changed. Prepare a new reminder.'; END IF;
 SELECT (v_loan.total_due-coalesce(sum(r.amount),0))::numeric(18,2) INTO v_amount FROM public.charis_loan_repayments r
 WHERE r.organization_id=p_org AND r.loan_id=v_i.loan_id;
 IF v_amount<=0 OR abs(v_amount-v_i.outstanding_snapshot)>0.009 OR v_loan.due_on<>v_i.due_on
 THEN RAISE EXCEPTION 'Repayment balance or due date changed. Reconcile before another reminder.';END IF;
 IF EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.organization_id=p_org AND lower(s.email)=lower(v_i.channel_destination))
 THEN RAISE EXCEPTION 'Email is suppressed. Do not send.'; END IF;
 -- The provider must be enabled and specifically approved for SERVICE notices.
 SELECT s.from_email,s.reply_to,s.from_name INTO v_from,v_reply,v_name
 FROM public.charis_email_routes cr JOIN public.email_provider_settings ep ON ep.provider=cr.provider
 JOIN public.sender_identities s ON s.id=cr.sender_id AND s.organization_id=cr.organization_id
 JOIN public.sending_domains d ON d.id=s.domain_id AND d.organization_id=s.organization_id
 WHERE cr.organization_id=p_org AND cr.provider='brevo' AND cr.enabled AND cr.permission_confirmed
  AND cr.allowed_kind='service' AND ep.enabled AND s.is_active AND d.verification_status='verified'
  AND d.provider='brevo' AND d.charis_connected=true LIMIT 1;
 IF v_from IS NULL THEN RAISE EXCEPTION 'Approved Brevo service-email sender is not configured';END IF;
 INSERT INTO public.charis_credit_email_dispatches(organization_id,hold_id,batch_id,item_id,recipient_id,requested_by)
 VALUES(p_org,p_hold,v_i.batch_id,v_i.id,v_i.contact_id,auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.email_dispatch_reserved','credit_reminder',v_i.batch_id::text,jsonb_build_object('dispatch_id',v_id,'channel','email','provider','brevo'));
 RETURN jsonb_build_object('dispatch_id',v_id,'recipient',v_i.channel_destination,'subject',v_batch.subject,
  'message',v_i.recipient_message,'sender',v_from,'sender_name',v_name,'reply_to',coalesce(nullif(v_reply,''),v_from));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_email_claim_043(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_credit_email_claim_043(uuid,uuid) TO authenticated;

-- Only a server-side service-role worker may record the provider outcome.
CREATE OR REPLACE FUNCTION public.charis_credit_email_finish_043(p_org uuid,p_dispatch uuid,p_status text,p_message text,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_batch uuid;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Privileged delivery reconciliation only'; END IF;
 IF p_status NOT IN('accepted','failed','uncertain') THEN RAISE EXCEPTION 'Invalid provider outcome'; END IF;
 IF length(coalesce(p_message,''))>300 OR length(coalesce(p_reason,''))>200 THEN RAISE EXCEPTION 'Invalid provider metadata';END IF;
 UPDATE public.charis_credit_email_dispatches SET status=p_status,provider_message_id=nullif(p_message,''),result_reason=nullif(p_reason,''),updated_at=now()
 WHERE organization_id=p_org AND id=p_dispatch AND status='sending' RETURNING id,batch_id INTO v_id,v_batch;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery outcome already recorded or unavailable';END IF;
 -- A webhook may arrive before the API acknowledgement is written. Reconcile it after the message id is stored.
 IF p_status='accepted' AND nullif(p_message,'') IS NOT NULL THEN
  UPDATE public.charis_credit_email_dispatches SET status=ev.final_status,updated_at=now()
  FROM (SELECT CASE e.event_type WHEN 'delivered' THEN 'delivered' WHEN 'bounce' THEN 'bounced'
   WHEN 'complaint' THEN 'complained' WHEN 'unsubscribe' THEN 'unsubscribed'
   WHEN 'blocked' THEN 'blocked' WHEN 'failed' THEN 'failed' ELSE 'accepted' END AS final_status
   FROM public.charis_credit_brevo_events_043 e WHERE e.provider_message_id=trim(both '<>' from p_message)
   AND e.event_type IN ('delivered','bounce','complaint','unsubscribe','blocked','failed')
   ORDER BY CASE WHEN e.event_type IN ('bounce','complaint','unsubscribe','blocked') THEN 1 ELSE 0 END DESC,
   e.occurred_at DESC LIMIT 1) ev
  WHERE organization_id=p_org AND id=p_dispatch AND status='accepted';
  INSERT INTO public.email_suppressions(organization_id,email,reason)
   SELECT d.organization_id,lower(i.channel_destination),
     CASE WHEN d.status='unsubscribed' THEN 'unsubscribe' WHEN d.status='complained' THEN 'complaint'
      WHEN d.status='blocked' THEN 'blocked' ELSE 'bounce' END
   FROM public.charis_credit_email_dispatches d JOIN public.charis_credit_reminder_items i
   ON i.organization_id=d.organization_id AND i.id=d.item_id
   WHERE d.organization_id=p_org AND d.id=p_dispatch AND d.status IN('bounced','complained','unsubscribed','blocked')
   ON CONFLICT(organization_id,email) DO NOTHING;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,null,'credit.email_delivery_'||p_status,'credit_reminder',v_batch::text,jsonb_build_object('dispatch_id',v_id,'provider','brevo','reason',p_reason));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_email_finish_043(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_credit_email_finish_043(uuid,uuid,text,text,text) TO service_role;
-- Separate reconciliation of Brevo's service-email events. No re-sending occurs here.
CREATE TABLE IF NOT EXISTS public.charis_credit_brevo_events_043 (
 event_key text PRIMARY KEY,
 provider_message_id text NOT NULL,
 event_type text NOT NULL CHECK(event_type IN('accepted','delivered','bounce','complaint','unsubscribe','blocked','failed','delayed','opened','clicked')),
 occurred_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.charis_credit_brevo_events_043 FROM PUBLIC,anon,authenticated;
ALTER TABLE public.charis_credit_brevo_events_043 ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS charis_credit_brevo_messages_043 ON public.charis_credit_brevo_events_043(provider_message_id,occurred_at DESC);
-- Match Brevo callbacks to confirmed service-message ids, even if callback arrived before the send acknowledgement.
CREATE OR REPLACE FUNCTION public.charis_brevo_credit_event_043(p_key text,p_message text,p_type text,p_time timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server event reconciliation only';END IF;
 IF length(coalesce(p_key,''))<>64 OR length(coalesce(p_message,''))>300 OR length(coalesce(p_message,''))<1
  OR p_type NOT IN('accepted','delivered','bounce','complaint','unsubscribe','blocked','failed','delayed','opened','clicked')
 THEN RAISE EXCEPTION 'Invalid provider event';END IF;
 INSERT INTO public.charis_credit_brevo_events_043(event_key,provider_message_id,event_type,occurred_at)
 VALUES(p_key,trim(both '<>' from p_message),p_type,p_time) ON CONFLICT(event_key) DO NOTHING;
 v_status:=CASE p_type WHEN 'delivered' THEN 'delivered' WHEN 'bounce' THEN 'bounced'
  WHEN 'complaint' THEN 'complained' WHEN 'unsubscribe' THEN 'unsubscribed'
  WHEN 'blocked' THEN 'blocked' WHEN 'failed' THEN 'failed' ELSE NULL END;
 IF v_status IS NOT NULL THEN
  UPDATE public.charis_credit_email_dispatches SET status=v_status,updated_at=now()
  WHERE provider_message_id=trim(both '<>' from p_message) AND status NOT IN('bounced','complained','unsubscribed','blocked')
   AND (status<>'delivered' OR v_status IN ('bounced','complained','unsubscribed','blocked'));
  IF v_status IN ('bounced','complained','unsubscribed','blocked') THEN
   INSERT INTO public.email_suppressions(organization_id,email,reason)
   SELECT d.organization_id,lower(i.channel_destination),
    CASE WHEN v_status='unsubscribed' THEN 'unsubscribe' WHEN v_status='complained' THEN 'complaint' WHEN v_status='blocked' THEN 'blocked' ELSE 'bounce' END
   FROM public.charis_credit_email_dispatches d JOIN public.charis_credit_reminder_items i
    ON i.organization_id=d.organization_id AND i.id=d.item_id
   WHERE d.provider_message_id=trim(both '<>' from p_message)
   ON CONFLICT(organization_id,email) DO NOTHING;
  END IF;
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.charis_brevo_credit_event_043(text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_brevo_credit_event_043(text,text,text,timestamptz) TO service_role;
-- One authorised Brevo staff test per bank every 15 minutes (not a marketing campaign).
CREATE TABLE IF NOT EXISTS public.charis_brevo_staff_tests_043 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 requested_by uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN('reserved','accepted','failed','uncertain')),
 provider_message_id text,
 requested_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.charis_brevo_staff_tests_043 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_brevo_staff_tests_043 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_brevo_staff_tests_043 TO authenticated;
CREATE POLICY charis_brevo_test_admin_read_043 ON public.charis_brevo_staff_tests_043 FOR SELECT TO authenticated
 USING(public.can_manage_senders(organization_id));
CREATE OR REPLACE FUNCTION public.charis_brevo_staff_test_reserve_043(p_org uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.can_manage_senders(p_org) THEN RAISE EXCEPTION 'Sender administration required';END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_org::text));
 IF EXISTS(SELECT 1 FROM public.charis_brevo_staff_tests_043 WHERE organization_id=p_org AND requested_at>now()-interval '15 minutes')
 THEN RAISE EXCEPTION 'Wait 15 minutes before another staff verification email';END IF;
 INSERT INTO public.charis_brevo_staff_tests_043(organization_id,requested_by) VALUES(p_org,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_brevo_staff_test_reserve_043(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_brevo_staff_test_reserve_043(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.charis_brevo_staff_test_finish_043(p_org uuid,p_id uuid,p_status text,p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server reconciliation only';END IF;
 IF p_status NOT IN('accepted','failed','uncertain') OR length(coalesce(p_message,''))>300 THEN RAISE EXCEPTION 'Invalid outcome';END IF;
 UPDATE public.charis_brevo_staff_tests_043 SET status=p_status,provider_message_id=nullif(p_message,''),updated_at=now()
 WHERE organization_id=p_org AND id=p_id AND status='reserved';
 IF NOT FOUND THEN RAISE EXCEPTION 'Provider test not in reserved state';END IF;
END;$$;
REVOKE ALL ON FUNCTION public.charis_brevo_staff_test_finish_043(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_brevo_staff_test_finish_043(uuid,uuid,text,text) TO service_role;
-- Legacy database table name "charis_reminders" is retained for existing records,
-- but its presentation is Staff Tasks. Assigned staff receive private in-app alerts.
ALTER TABLE public.charis_staff_notifications DROP CONSTRAINT IF EXISTS charis_staff_notifications_target_path_check;
ALTER TABLE public.charis_staff_notifications ADD CONSTRAINT charis_staff_notifications_target_path_check
 CHECK(target_path IN ('/dashboard/credit-followups','/dashboard/tasks'));
CREATE OR REPLACE FUNCTION public.charis_staff_task_alert_043()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.charis_staff_notifications(organization_id,recipient_id,event_key,title,body,target_path)
  VALUES(NEW.organization_id,NEW.assigned_to,'task.assigned.'||NEW.id::text,'New staff task',
   'A team task has been assigned to you. Open My Tasks to review the due date.','/dashboard/tasks')
  ON CONFLICT(organization_id,recipient_id,event_key) DO NOTHING;
 ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.created_by<>NEW.assigned_to THEN
  INSERT INTO public.charis_staff_notifications(organization_id,recipient_id,event_key,title,body,target_path)
  VALUES(NEW.organization_id,NEW.created_by,'task.status.'||NEW.id::text||'.'||NEW.status,
   'Staff task updated','A task you created has changed status.','/dashboard/tasks')
  ON CONFLICT(organization_id,recipient_id,event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS charis_staff_task_alert_trigger_043 ON public.charis_reminders;
CREATE TRIGGER charis_staff_task_alert_trigger_043 AFTER INSERT OR UPDATE OF status ON public.charis_reminders
 FOR EACH ROW EXECUTE FUNCTION public.charis_staff_task_alert_043();
REVOKE ALL ON FUNCTION public.charis_staff_task_alert_043() FROM PUBLIC,anon,authenticated;
-- Notify assigned staff about overdue tasks when they open their private alerts inbox.
-- It is NOT an email/SMS scheduler and never contacts customers.
CREATE OR REPLACE FUNCTION public.charis_staff_due_alerts_043(p_org uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer :=0;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
  WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND o.status='active' AND o.slug='charis-mfb')
 THEN RAISE EXCEPTION 'Authorised staff membership required';END IF;
 INSERT INTO public.charis_staff_notifications(organization_id,recipient_id,event_key,title,body,target_path)
 SELECT p_org,auth.uid(),'task.overdue.'||t.id::text||'.'||to_char(now() AT TIME ZONE 'Africa/Lagos','YYYYMMDD'),
  'Overdue staff task','A task assigned to you is overdue. Open My Tasks to review it.','/dashboard/tasks'
 FROM public.charis_reminders t WHERE t.organization_id=p_org AND t.assigned_to=auth.uid()
  AND t.status='open' AND t.due_at<now() AND public.charis_department_access(p_org,t.department_id)
 ORDER BY t.due_at ASC LIMIT 50
 ON CONFLICT(organization_id,recipient_id,event_key) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.charis_staff_due_alerts_043(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_due_alerts_043(uuid) TO authenticated;
COMMIT;
