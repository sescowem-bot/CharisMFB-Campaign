-- CHARIS 031 | Internal loan register, repayments and account-service notice drafts.
-- Apply only after 030 to the existing Charis database, after backup and staging review.
-- This migration DOES NOT configure, enable or send any email or SMS.
BEGIN;
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('loans.view','View assigned loan accounts','Credit','View loan positions for customers within authorised branch scope'),
 ('loans.manage','Register loan accounts','Credit','Register new loans for authorised customers'),
 ('loans.repayments','Record loan repayments','Credit','Post individual repayments with a unique receipt reference'),
 ('service_notices.view','View account-service notices','Communications','View assigned customer notice drafts'),
 ('service_notices.create','Prepare account-service notices','Communications','Draft and submit individual non-promotional notices'),
 ('service_notices.approve','Review account-service notices','Communications','Independently approve or reject submitted drafts')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;

CREATE TABLE IF NOT EXISTS public.charis_loans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 contact_id uuid NOT NULL,
 loan_reference text NOT NULL CHECK (length(loan_reference) BETWEEN 3 AND 64),
 principal numeric(18,2) NOT NULL CHECK(principal>0 AND principal<=1000000000000),
 total_due numeric(18,2) NOT NULL CHECK(total_due>=principal AND total_due<=1000000000000),
 currency text NOT NULL DEFAULT 'NGN' CHECK(currency='NGN'),
 disbursed_on date NOT NULL,
 due_on date NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','settled')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,loan_reference),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id),
 CONSTRAINT charis_loan_dates CHECK(due_on>=disbursed_on)
);
CREATE INDEX IF NOT EXISTS charis_loans_contact_idx ON public.charis_loans(organization_id,contact_id,status);
CREATE INDEX IF NOT EXISTS charis_loans_due_idx ON public.charis_loans(organization_id,status,due_on);

CREATE TABLE IF NOT EXISTS public.charis_loan_repayments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL,
 loan_id uuid NOT NULL,
 amount numeric(18,2) NOT NULL CHECK(amount>0 AND amount<=1000000000000),
 paid_on date NOT NULL,
 receipt_reference text NOT NULL CHECK(length(receipt_reference) BETWEEN 3 AND 100),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=500),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,loan_id,receipt_reference),
 FOREIGN KEY(organization_id,loan_id) REFERENCES public.charis_loans(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_repayments_loan_idx ON public.charis_loan_repayments(organization_id,loan_id,paid_on DESC);

-- Branch-specific read rules require BOTH loan permission and prior customer RLS scope.
-- Loan mutations run only through guarded, audited RPC functions.
CREATE OR REPLACE FUNCTION public.charis_can_access_loan(p_org uuid,p_contact uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_can_view_customer(p_org,p_contact) AND
  (public.charis_has_permission(p_org,'loans.view') OR
   public.charis_has_permission(p_org,'loans.manage') OR
   public.charis_has_permission(p_org,'loans.repayments'));
$$;
REVOKE ALL ON FUNCTION public.charis_can_access_loan(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_can_access_loan(uuid,uuid) TO authenticated;

ALTER TABLE public.charis_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_loan_repayments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_loans,public.charis_loan_repayments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_loans,public.charis_loan_repayments TO authenticated;
DROP POLICY IF EXISTS charis_loans_read_031 ON public.charis_loans;
CREATE POLICY charis_loans_read_031 ON public.charis_loans FOR SELECT TO authenticated
 USING(public.charis_can_access_loan(organization_id,contact_id));
DROP POLICY IF EXISTS charis_loan_repayments_read_031 ON public.charis_loan_repayments;
CREATE POLICY charis_loan_repayments_read_031 ON public.charis_loan_repayments FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.charis_loans l WHERE l.organization_id=charis_loan_repayments.organization_id
   AND l.id=charis_loan_repayments.loan_id AND public.charis_can_access_loan(l.organization_id,l.contact_id)));

CREATE OR REPLACE FUNCTION public.charis_loan_create(p_org uuid,p_contact uuid,p_reference text,
 p_principal numeric,p_total_due numeric,p_disbursed date,p_due date,p_notes text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_ref text;
BEGIN
 IF NOT public.charis_has_permission(p_org,'loans.manage') OR
   NOT public.charis_can_view_customer(p_org,p_contact) THEN
  RAISE EXCEPTION 'You are not permitted to register this customer loan'; END IF;
 v_ref:=upper(btrim(coalesce(p_reference,'')));
 IF v_ref !~ '^[A-Z0-9][A-Z0-9_/-]{2,63}$' OR p_principal IS NULL OR
   p_principal<=0 OR p_total_due IS NULL OR p_total_due<p_principal OR
   p_principal>1000000000000 OR p_total_due>1000000000000 OR
   p_disbursed IS NULL OR p_disbursed>current_date OR p_due IS NULL OR p_due<p_disbursed OR p_due>current_date+interval '40 years' OR
   length(coalesce(p_notes,''))>1000 THEN
  RAISE EXCEPTION 'Check loan reference, amounts and dates'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE organization_id=p_org AND id=p_contact AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'Choose an active authorised customer'; END IF;
 INSERT INTO public.charis_loans(organization_id,contact_id,loan_reference,principal,total_due,disbursed_on,due_on,notes,created_by)
 VALUES(p_org,p_contact,v_ref,p_principal,p_total_due,p_disbursed,p_due,coalesce(p_notes,''),auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'loan.registered','loan',v_id::text,jsonb_build_object('reference',v_ref));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_loan_create(uuid,uuid,text,numeric,numeric,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_loan_create(uuid,uuid,text,numeric,numeric,date,date,text) TO authenticated;

-- Lock the parent loan row before checking totals. Prevents concurrent overpayments.
-- Receipt reference is unique per loan: accidental retries cannot double-post.
CREATE OR REPLACE FUNCTION public.charis_loan_repayment_add(p_org uuid,p_loan uuid,p_amount numeric,
 p_paid date,p_receipt text,p_notes text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_loan public.charis_loans;v_paid numeric(18,2);v_id uuid;v_ref text;
BEGIN
 IF NOT public.charis_has_permission(p_org,'loans.repayments') THEN RAISE EXCEPTION 'Repayment posting access required';END IF;
 SELECT * INTO v_loan FROM public.charis_loans WHERE organization_id=p_org AND id=p_loan FOR UPDATE;
 IF NOT FOUND OR NOT public.charis_can_view_customer(p_org,v_loan.contact_id) THEN RAISE EXCEPTION 'Loan unavailable'; END IF;
 v_ref:=upper(btrim(coalesce(p_receipt,'')));
 IF v_loan.status<>'active' OR p_amount IS NULL OR p_amount<=0 OR p_amount>1000000000000 OR
    p_paid IS NULL OR p_paid<v_loan.disbursed_on OR p_paid>current_date+1 OR
    length(v_ref) NOT BETWEEN 3 AND 100 OR length(coalesce(p_notes,''))>500 THEN
  RAISE EXCEPTION 'Check repayment amount, receipt, date and loan status';END IF;
 SELECT coalesce(sum(amount),0) INTO v_paid FROM public.charis_loan_repayments WHERE organization_id=p_org AND loan_id=p_loan;
 IF p_amount>v_loan.total_due-v_paid THEN RAISE EXCEPTION 'Payment exceeds the outstanding loan balance';END IF;
 INSERT INTO public.charis_loan_repayments(organization_id,loan_id,amount,paid_on,receipt_reference,notes,created_by)
 VALUES(p_org,p_loan,p_amount,p_paid,v_ref,coalesce(p_notes,''),auth.uid()) RETURNING id INTO v_id;
 IF v_paid+p_amount>=v_loan.total_due THEN
  UPDATE public.charis_loans SET status='settled',updated_at=now() WHERE id=p_loan;
 ELSE UPDATE public.charis_loans SET updated_at=now() WHERE id=p_loan; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'loan.repayment_recorded','loan',p_loan::text,
 jsonb_build_object('repayment_id',v_id,'receipt',v_ref,'amount',p_amount));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_loan_repayment_add(uuid,uuid,numeric,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_loan_repayment_add(uuid,uuid,numeric,date,text,text) TO authenticated;

-- Aggregate entire authorised repayment histories inside Postgres; do not rely on
-- paginated client reads to calculate financial balances.
CREATE OR REPLACE VIEW public.charis_loan_balances WITH (security_invoker=true) AS
 SELECT l.organization_id,l.id AS loan_id,
   coalesce(sum(r.amount),0)::numeric(18,2) AS amount_paid,
   (l.total_due-coalesce(sum(r.amount),0))::numeric(18,2) AS outstanding
 FROM public.charis_loans l LEFT JOIN public.charis_loan_repayments r
  ON r.organization_id=l.organization_id AND r.loan_id=l.id
 GROUP BY l.organization_id,l.id,l.total_due;
REVOKE ALL ON public.charis_loan_balances FROM PUBLIC,anon;
GRANT SELECT ON public.charis_loan_balances TO authenticated;

-- Account-service notices have their own lifecycle, separate from promotional campaigns.
-- There is intentionally NO external send function/worker in this migration.
CREATE TABLE IF NOT EXISTS public.charis_service_notices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 contact_id uuid NOT NULL,
 related_loan_id uuid,
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 140),
 message text NOT NULL CHECK(length(btrim(message)) BETWEEN 10 AND 1000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 submitted_by uuid REFERENCES auth.users(id),
 reviewed_by uuid REFERENCES auth.users(id),
 review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id),
 FOREIGN KEY(organization_id,related_loan_id) REFERENCES public.charis_loans(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_service_notices_status_idx ON public.charis_service_notices(organization_id,status,updated_at DESC);
ALTER TABLE public.charis_service_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_service_notices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_service_notices TO authenticated;
DROP POLICY IF EXISTS charis_service_notices_read_031 ON public.charis_service_notices;
CREATE POLICY charis_service_notices_read_031 ON public.charis_service_notices FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'service_notices.view') AND public.charis_can_view_customer(organization_id,contact_id));

CREATE OR REPLACE FUNCTION public.charis_service_notice_create(p_org uuid,p_contact uuid,p_loan uuid,
 p_channel text,p_subject text,p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.charis_has_permission(p_org,'service_notices.create') OR NOT public.charis_can_view_customer(p_org,p_contact) THEN
  RAISE EXCEPTION 'You are not permitted to prepare this customer notice'; END IF;
 IF p_channel NOT IN ('email','sms') OR length(btrim(coalesce(p_subject,''))) NOT BETWEEN 3 AND 140 OR
    length(btrim(coalesce(p_message,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Complete the notice details';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE organization_id=p_org AND id=p_contact AND archived_at IS NULL) THEN
  RAISE EXCEPTION 'Choose an active customer'; END IF;
 IF p_channel='email' AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE organization_id=p_org AND id=p_contact
  AND email IS NOT NULL AND length(btrim(email))>3) THEN RAISE EXCEPTION 'Customer has no email address'; END IF;
 IF p_channel='sms' AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE organization_id=p_org AND id=p_contact
  AND phone IS NOT NULL AND length(btrim(phone))>5) THEN RAISE EXCEPTION 'Customer has no phone number'; END IF;
 IF p_loan IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.charis_loans
  WHERE organization_id=p_org AND id=p_loan AND contact_id=p_contact AND public.charis_can_access_loan(p_org,p_contact)) THEN
  RAISE EXCEPTION 'Choose a loan belonging to this customer'; END IF;
 INSERT INTO public.charis_service_notices(organization_id,contact_id,related_loan_id,channel,subject,message,created_by)
 VALUES(p_org,p_contact,p_loan,p_channel,btrim(p_subject),btrim(p_message),auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'service_notice.created','service_notice',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_service_notice_create(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_service_notice_create(uuid,uuid,uuid,text,text,text) TO authenticated;

-- Rejected drafts can be edited by their original author; approved messages
-- stay immutable, and resubmission always starts a new independent review.
CREATE OR REPLACE FUNCTION public.charis_service_notice_update(p_org uuid,p_id uuid,
 p_channel text,p_subject text,p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.charis_service_notices;
BEGIN
 IF NOT public.charis_has_permission(p_org,'service_notices.create') THEN RAISE EXCEPTION 'Notice editing access required';END IF;
 SELECT * INTO v_row FROM public.charis_service_notices WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR v_row.created_by<>auth.uid() OR v_row.status NOT IN ('draft','rejected')
  OR NOT public.charis_can_view_customer(p_org,v_row.contact_id) THEN RAISE EXCEPTION 'Notice cannot be edited';END IF;
 IF p_channel NOT IN ('email','sms') OR length(btrim(coalesce(p_subject,''))) NOT BETWEEN 3 AND 140
  OR length(btrim(coalesce(p_message,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Check notice details';END IF;
 UPDATE public.charis_service_notices SET channel=p_channel,subject=btrim(p_subject),message=btrim(p_message),
  status='draft',review_note='',reviewed_by=NULL,updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'service_notice.revised','service_notice',p_id::text);
END;$$;
REVOKE ALL ON FUNCTION public.charis_service_notice_update(uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_service_notice_update(uuid,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_service_notice_submit(p_org uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.charis_service_notices;
BEGIN
 IF NOT public.charis_has_permission(p_org,'service_notices.create') THEN RAISE EXCEPTION 'Notice creation access required';END IF;
 SELECT * INTO v_row FROM public.charis_service_notices WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.charis_can_view_customer(p_org,v_row.contact_id) OR v_row.created_by<>auth.uid()
   OR v_row.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Notice cannot be submitted';END IF;
 UPDATE public.charis_service_notices SET status='submitted',submitted_by=auth.uid(),reviewed_by=NULL,review_note='',updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'service_notice.submitted','service_notice',p_id::text);
END;$$;
REVOKE ALL ON FUNCTION public.charis_service_notice_submit(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_service_notice_submit(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_service_notice_review(p_org uuid,p_id uuid,p_approve boolean,p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row public.charis_service_notices;
BEGIN
 IF NOT public.charis_has_permission(p_org,'service_notices.approve') OR
    NOT public.charis_has_permission(p_org,'service_notices.view') THEN RAISE EXCEPTION 'Review access required';END IF;
 SELECT * INTO v_row FROM public.charis_service_notices WHERE organization_id=p_org AND id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.charis_can_view_customer(p_org,v_row.contact_id) OR v_row.status<>'submitted'
  OR v_row.submitted_by=auth.uid() OR v_row.created_by=auth.uid() THEN RAISE EXCEPTION 'Independent review required';END IF;
 IF p_approve IS NULL OR length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Invalid review details';END IF;
 IF NOT p_approve AND length(btrim(coalesce(p_note,'')))<3 THEN RAISE EXCEPTION 'Explain the required changes'; END IF;
 UPDATE public.charis_service_notices SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_by=auth.uid(),review_note=coalesce(p_note,''),updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),CASE WHEN p_approve THEN 'service_notice.approved' ELSE 'service_notice.rejected' END,
  'service_notice',p_id::text,jsonb_build_object('review_note',coalesce(p_note,'')));
END;$$;
REVOKE ALL ON FUNCTION public.charis_service_notice_review(uuid,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_service_notice_review(uuid,uuid,boolean,text) TO authenticated;
COMMIT;
