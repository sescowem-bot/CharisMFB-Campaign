-- CHARIS 032 | Credit reminder drafting, bank-authorised review and HELD delivery queue.
-- Requires 001-031 in the SAME bank Supabase database. Back up and test in staging.
-- Additive: NEVER deletes a customer, loan, repayment, campaign or provider record.
-- No network dispatch, email or SMS provider invocation is defined by this migration.
BEGIN;
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('credit_reminders.view','View authorised credit reminders','Credit','See reminders for loan customers in permitted branches'),
 ('credit_reminders.create','Prepare loan repayment reminders','Credit','Draft an individual or selected-loan batch'),
 ('credit_reminders.approve','Review credit reminder batches','Credit','Approve or reject according to bank policy'),
 ('credit_reminders.direct_approve','Permit own-batch approval when enabled','Credit','Only effective with Credit policy in authorised-direct mode'),
 ('credit_reminders.queue','Hold approved reminders for delivery','Credit','Prepare delivery records but do not send messages'),
 ('credit_reminders.settings','Manage credit reminder approval policy','Administration','Configure the bank-specific approval mode')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;

CREATE TABLE IF NOT EXISTS public.charis_credit_reminder_policy (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 approval_mode text NOT NULL DEFAULT 'independent' CHECK(approval_mode IN ('independent','authorised_direct')),
 daily_recipient_limit int NOT NULL DEFAULT 100 CHECK(daily_recipient_limit BETWEEN 1 AND 500),
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Use an existing bank organisation; no new tenant is created.
INSERT INTO public.charis_credit_reminder_policy(organization_id)
 SELECT id FROM public.organizations WHERE slug='charis-mfb' AND status='active'
ON CONFLICT(organization_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.charis_credit_reminder_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 request_key uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 140),
 message_template text NOT NULL CHECK(length(btrim(message_template)) BETWEEN 15 AND 800),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','held','cancelled')),
 reconciled_attestation boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 submitted_by uuid REFERENCES auth.users(id),
 reviewed_by uuid REFERENCES auth.users(id),
 approved_at timestamptz,
 review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,request_key)
);
CREATE INDEX IF NOT EXISTS charis_credit_batch_recent_idx ON public.charis_credit_reminder_batches(organization_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS public.charis_credit_reminder_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 loan_id uuid NOT NULL,
 contact_id uuid NOT NULL,
 loan_reference text NOT NULL,
 due_on date NOT NULL,
 outstanding_snapshot numeric(18,2) NOT NULL CHECK(outstanding_snapshot>0),
 channel_destination text NOT NULL,
 recipient_message text NOT NULL CHECK(length(recipient_message) BETWEEN 15 AND 1500),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,batch_id,loan_id),
 UNIQUE(organization_id,batch_id,contact_id), -- no duplicate recipient within one batch
 FOREIGN KEY(organization_id,batch_id) REFERENCES public.charis_credit_reminder_batches(organization_id,id),
 FOREIGN KEY(organization_id,loan_id) REFERENCES public.charis_loans(organization_id,id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_credit_item_loan_idx ON public.charis_credit_reminder_items(organization_id,loan_id);

-- A composite FOREIGN KEY in the delivery-holds table references (organization_id, id).
-- The UUID id PRIMARY KEY does not by itself make that column PAIR a unique key.
-- A non-partial unique index satisfies PostgreSQL's referenced-key requirement and
-- can also repair an existing reminder-items table after a prior partial SQL run.
CREATE UNIQUE INDEX IF NOT EXISTS charis_credit_reminder_items_org_id_uidx_032
 ON public.charis_credit_reminder_items(organization_id,id);

-- No worker consumes these records in Batch 4. State is intentionally HELD.
CREATE TABLE IF NOT EXISTS public.charis_credit_delivery_holds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 item_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 status text NOT NULL DEFAULT 'held' CHECK(status='held'),
 held_reason text NOT NULL DEFAULT 'Channel and compliance approval required',
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,item_id),
 FOREIGN KEY(organization_id,batch_id) REFERENCES public.charis_credit_reminder_batches(organization_id,id),
 FOREIGN KEY(organization_id,item_id) REFERENCES public.charis_credit_reminder_items(organization_id,id)
);

ALTER TABLE public.charis_credit_reminder_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_credit_reminder_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_credit_reminder_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_credit_delivery_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_credit_reminder_policy,public.charis_credit_reminder_batches,public.charis_credit_reminder_items,public.charis_credit_delivery_holds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_credit_reminder_policy,public.charis_credit_reminder_batches,public.charis_credit_reminder_items,public.charis_credit_delivery_holds TO authenticated;

-- Require an authorised capability AND at least one visible customer in the batch.
CREATE OR REPLACE FUNCTION public.charis_can_view_credit_batch(p_org uuid,p_batch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'credit_reminders.view') AND EXISTS(
  SELECT 1 FROM public.charis_credit_reminder_items i WHERE i.organization_id=p_org AND i.batch_id=p_batch
   AND public.charis_can_view_customer(p_org,i.contact_id));
$$;
REVOKE ALL ON FUNCTION public.charis_can_view_credit_batch(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_can_view_credit_batch(uuid,uuid) TO authenticated;

CREATE POLICY charis_credit_policy_read_032 ON public.charis_credit_reminder_policy FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'credit_reminders.view') OR public.charis_has_permission(organization_id,'credit_reminders.settings'));
CREATE POLICY charis_credit_batch_read_032 ON public.charis_credit_reminder_batches FOR SELECT TO authenticated
 USING(public.charis_can_view_credit_batch(organization_id,id));
CREATE POLICY charis_credit_items_read_032 ON public.charis_credit_reminder_items FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'credit_reminders.view') AND public.charis_can_view_customer(organization_id,contact_id));
CREATE POLICY charis_credit_holds_read_032 ON public.charis_credit_delivery_holds FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.charis_credit_reminder_items i WHERE i.organization_id=charis_credit_delivery_holds.organization_id
  AND i.id=charis_credit_delivery_holds.item_id AND public.charis_has_permission(i.organization_id,'credit_reminders.view')
  AND public.charis_can_view_customer(i.organization_id,i.contact_id)));

CREATE OR REPLACE FUNCTION public.charis_credit_policy_set(p_org uuid,p_mode text,p_limit integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'credit_reminders.settings') THEN RAISE EXCEPTION 'Credit policy administration required';END IF;
 IF p_mode IS NULL OR p_mode NOT IN('independent','authorised_direct') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
  RAISE EXCEPTION 'Invalid reminder policy';END IF;
 INSERT INTO public.charis_credit_reminder_policy(organization_id,approval_mode,daily_recipient_limit,updated_by,updated_at)
 VALUES(p_org,p_mode,p_limit,auth.uid(),now())
 ON CONFLICT(organization_id) DO UPDATE SET approval_mode=excluded.approval_mode,daily_recipient_limit=excluded.daily_recipient_limit,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.policy_changed','credit_policy',p_org::text,jsonb_build_object('approval_mode',p_mode,'daily_limit',p_limit));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_policy_set(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_credit_policy_set(uuid,text,integer) TO authenticated;

-- Formatting never embeds passwords, account numbers, BVNs or other secrets.
-- A staff-confirmed core-ledger reconciliation is REQUIRED before saving a batch.
CREATE OR REPLACE FUNCTION public.charis_credit_reminder_create(
 p_org uuid,p_loans uuid[],p_channel text,p_subject text,p_template text,p_key uuid,p_reconciled boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_batch uuid;v_loan public.charis_loans;v_contact public.contacts;v_due numeric(18,2);
 v_count integer;v_added integer:=0;v_dest text;v_msg text;
BEGIN
 IF NOT public.charis_has_permission(p_org,'credit_reminders.create') OR NOT public.charis_has_permission(p_org,'credit_reminders.view') OR
    NOT public.charis_has_permission(p_org,'loans.view') THEN RAISE EXCEPTION 'Credit reminder access required'; END IF;
 IF p_reconciled IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm account balances against the core ledger';END IF;
 IF p_key IS NULL OR p_loans IS NULL OR array_length(p_loans,1) IS NULL OR array_length(p_loans,1)>50 OR
    p_channel NOT IN('email','sms') OR length(btrim(coalesce(p_subject,''))) NOT BETWEEN 3 AND 140 OR
    length(btrim(coalesce(p_template,''))) NOT BETWEEN 15 AND 800 THEN RAISE EXCEPTION 'Check recipient selection and message'; END IF;
 IF p_template ~ '\{\{[^}]*\}\}' AND
  regexp_replace(p_template,'\{\{(first_name|loan_reference|outstanding|due_date|bank_name)\}\}','','g') ~ '\{\{[^}]*\}\}' THEN
  RAISE EXCEPTION 'Unsupported message placeholder';END IF;
 IF cardinality(p_loans) <> (SELECT count(DISTINCT x) FROM unnest(p_loans) AS loan_values(x)) THEN RAISE EXCEPTION 'Select each loan once';END IF;
 SELECT id INTO v_batch FROM public.charis_credit_reminder_batches WHERE organization_id=p_org AND request_key=p_key AND created_by=auth.uid();
 IF FOUND THEN RETURN v_batch;END IF; -- idempotent browser resubmission, NOT a second draft
 INSERT INTO public.charis_credit_reminder_batches(organization_id,request_key,channel,subject,message_template,created_by,reconciled_attestation)
 VALUES(p_org,p_key,p_channel,btrim(p_subject),btrim(p_template),auth.uid(),true) RETURNING id INTO v_batch;
 FOR v_loan IN SELECT * FROM public.charis_loans WHERE organization_id=p_org AND id=ANY(p_loans) ORDER BY id LOOP
  IF NOT public.charis_can_view_customer(p_org,v_loan.contact_id) OR v_loan.status<>'active' THEN
   RAISE EXCEPTION 'One or more selected loan accounts is not available';END IF;
  SELECT * INTO v_contact FROM public.contacts WHERE organization_id=p_org AND id=v_loan.contact_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected customer is not active';END IF;
  SELECT (v_loan.total_due-coalesce(sum(amount),0))::numeric(18,2) INTO v_due
   FROM public.charis_loan_repayments WHERE organization_id=p_org AND loan_id=v_loan.id;
  IF v_due<=0 THEN RAISE EXCEPTION 'Settled accounts cannot be reminded';END IF;
  v_dest:=CASE WHEN p_channel='email' THEN nullif(btrim(coalesce(v_contact.email,'')),'') ELSE nullif(btrim(coalesce(v_contact.phone,'')),'') END;
  IF v_dest IS NULL THEN RAISE EXCEPTION 'Selected recipient is missing a contact address for this channel';END IF;
  v_msg:=replace(replace(replace(replace(replace(p_template,
   '{{first_name}}',coalesce(nullif(btrim(v_contact.first_name),''),'Customer')),
   '{{loan_reference}}',v_loan.loan_reference),
   '{{outstanding}}','NGN '||to_char(v_due,'FM999,999,999,999,990.00')),
   '{{due_date}}',to_char(v_loan.due_on,'DD Mon YYYY')),
   '{{bank_name}}','Charis Microfinance Bank');
  IF length(v_msg)>1500 THEN RAISE EXCEPTION 'The generated customer reminder is too long';END IF;
  INSERT INTO public.charis_credit_reminder_items(organization_id,batch_id,loan_id,contact_id,loan_reference,due_on,outstanding_snapshot,channel_destination,recipient_message)
   VALUES(p_org,v_batch,v_loan.id,v_loan.contact_id,v_loan.loan_reference,v_loan.due_on,v_due,v_dest,v_msg);
  v_added:=v_added+1;
 END LOOP;
 IF v_added<>cardinality(p_loans) THEN RAISE EXCEPTION 'Some loan accounts were unavailable';END IF;
 -- This check avoids repeated reminders to one recipient for multiple accounts in one batch.
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.batch_created','credit_reminder',v_batch::text,jsonb_build_object('count',v_added,'channel',p_channel,'reconciled',true));
 RETURN v_batch;
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_reminder_create(uuid,uuid[],text,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_credit_reminder_create(uuid,uuid[],text,text,text,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_credit_reminder_transition(p_org uuid,p_batch uuid,p_action text,p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_batch public.charis_credit_reminder_batches;v_mode text;v_count int;v_today date;
BEGIN
 SELECT * INTO v_batch FROM public.charis_credit_reminder_batches WHERE organization_id=p_org AND id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reminder batch unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_credit_reminder_items i WHERE i.organization_id=p_org AND i.batch_id=p_batch) OR
    EXISTS(SELECT 1 FROM public.charis_credit_reminder_items i WHERE i.organization_id=p_org AND i.batch_id=p_batch
      AND NOT public.charis_can_view_customer(p_org,i.contact_id)) THEN RAISE EXCEPTION 'Recipient access or batch membership changed';END IF;
 IF length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Review note is too long';END IF;
 IF p_action='submit' THEN
  IF NOT public.charis_has_permission(p_org,'credit_reminders.create') OR v_batch.created_by<>auth.uid() OR v_batch.status NOT IN('draft','rejected') THEN
   RAISE EXCEPTION 'Only the drafter can submit this batch'; END IF;
  UPDATE public.charis_credit_reminder_batches SET status='submitted',submitted_by=auth.uid(),review_note='',reviewed_by=NULL,updated_at=now() WHERE id=p_batch;
 ELSIF p_action IN('approve','reject') THEN
  IF NOT public.charis_has_permission(p_org,'credit_reminders.approve') OR v_batch.status<>'submitted' THEN RAISE EXCEPTION 'Review access required';END IF;
  SELECT approval_mode INTO v_mode FROM public.charis_credit_reminder_policy WHERE organization_id=p_org;
  IF (v_batch.created_by=auth.uid() OR v_batch.submitted_by=auth.uid()) AND
     NOT(coalesce(v_mode,'independent')='authorised_direct' AND public.charis_has_permission(p_org,'credit_reminders.direct_approve')) THEN
   RAISE EXCEPTION 'Independent review is required for this batch';END IF;
  IF p_action='reject' AND length(btrim(coalesce(p_note,'')))<3 THEN RAISE EXCEPTION 'Explain the required correction';END IF;
  UPDATE public.charis_credit_reminder_batches SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,
   reviewed_by=auth.uid(),review_note=coalesce(p_note,''),approved_at=CASE WHEN p_action='approve' THEN now() ELSE NULL END,updated_at=now() WHERE id=p_batch;
 ELSIF p_action='hold' THEN
  IF NOT public.charis_has_permission(p_org,'credit_reminders.queue') OR v_batch.status<>'approved' THEN RAISE EXCEPTION 'Approved reminder and queue permission required';END IF;
  -- Serialize held-queue capacity checks for this bank.
  PERFORM 1 FROM public.charis_credit_reminder_policy WHERE organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit reminder policy is unavailable';END IF;
  -- Re-evaluate current balances and contact eligibility. A stale or paid-off loan is not queued.
  IF EXISTS(SELECT 1 FROM public.charis_credit_reminder_items i JOIN public.charis_loans l
    ON l.organization_id=i.organization_id AND l.id=i.loan_id
    JOIN public.contacts c ON c.organization_id=i.organization_id AND c.id=i.contact_id
    LEFT JOIN LATERAL (SELECT coalesce(sum(r.amount),0) AS amount_paid FROM public.charis_loan_repayments r
      WHERE r.organization_id=i.organization_id AND r.loan_id=i.loan_id) r ON true
    WHERE i.organization_id=p_org AND i.batch_id=p_batch AND
     (l.status<>'active' OR l.total_due-r.amount_paid<=0 OR abs((l.total_due-r.amount_paid)-i.outstanding_snapshot)>0.009
      OR c.archived_at IS NOT NULL OR (CASE WHEN v_batch.channel='email' THEN nullif(btrim(coalesce(c.email,'')),'') ELSE nullif(btrim(coalesce(c.phone,'')),'') END) IS DISTINCT FROM i.channel_destination))
  THEN RAISE EXCEPTION 'Account balance or recipient contact changed. Review and prepare a fresh batch'; END IF;
  v_today=(now() AT TIME ZONE 'Africa/Lagos')::date;
  -- Do not stage another reminder for the same loan/channel on the same day.
  IF EXISTS(SELECT 1 FROM public.charis_credit_reminder_items i
    JOIN public.charis_credit_reminder_items previous_i ON previous_i.organization_id=i.organization_id AND previous_i.loan_id=i.loan_id
    JOIN public.charis_credit_delivery_holds h ON h.organization_id=previous_i.organization_id AND h.item_id=previous_i.id
    WHERE i.organization_id=p_org AND i.batch_id=p_batch AND h.channel=v_batch.channel AND
     (h.created_at AT TIME ZONE 'Africa/Lagos')::date=v_today) THEN
     RAISE EXCEPTION 'A reminder for one of these loans was already held today';END IF;
  -- Bank-wide limit for staged recipients, not a provider daily dispatch allowance.
  SELECT count(*) INTO v_count FROM public.charis_credit_delivery_holds h WHERE h.organization_id=p_org AND
    (h.created_at AT TIME ZONE 'Africa/Lagos')::date=v_today;
  IF v_count+(SELECT count(*) FROM public.charis_credit_reminder_items WHERE organization_id=p_org AND batch_id=p_batch)>
     (SELECT daily_recipient_limit FROM public.charis_credit_reminder_policy WHERE organization_id=p_org)
  THEN RAISE EXCEPTION 'Daily held-recipient limit reached';END IF;
  INSERT INTO public.charis_credit_delivery_holds(organization_id,batch_id,item_id,channel,created_by)
   SELECT i.organization_id,i.batch_id,i.id,v_batch.channel,auth.uid() FROM public.charis_credit_reminder_items i
   WHERE i.organization_id=p_org AND i.batch_id=p_batch;
  UPDATE public.charis_credit_reminder_batches SET status='held',updated_at=now() WHERE id=p_batch;
 ELSIF p_action='cancel' THEN
  IF NOT public.charis_has_permission(p_org,'credit_reminders.create') OR v_batch.created_by<>auth.uid() OR v_batch.status NOT IN('draft','rejected','submitted') THEN
   RAISE EXCEPTION 'This batch cannot be cancelled';END IF;
  UPDATE public.charis_credit_reminder_batches SET status='cancelled',updated_at=now() WHERE id=p_batch;
 ELSE RAISE EXCEPTION 'Unknown batch action';END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'credit.batch_'||p_action,'credit_reminder',p_batch::text,
 jsonb_build_object('note',coalesce(p_note,''),'channel',v_batch.channel));
END;$$;
REVOKE ALL ON FUNCTION public.charis_credit_reminder_transition(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_credit_reminder_transition(uuid,uuid,text,text) TO authenticated;
COMMIT;
