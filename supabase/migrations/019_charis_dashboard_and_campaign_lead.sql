-- Charis Campaign Centre | 019 | Fast dashboard + Campaign Lead
-- Run in the EXISTING Charis Supabase database after migration 018.
-- Non-destructive. Existing roles, campaigns, recipients and approval history are preserved.
BEGIN;

-- Extend only the permitted membership / invitation roles; no permission bypass.
ALTER TABLE public.organization_members
 DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.organization_members
 ADD CONSTRAINT organization_members_role_check
 CHECK (role IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer'));
ALTER TABLE public.team_invitations
 DROP CONSTRAINT IF EXISTS team_invitations_role_check;
ALTER TABLE public.team_invitations
 ADD CONSTRAINT team_invitations_role_check
 CHECK (role IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer'));

-- A campaign lead may create, approve other creators' campaigns and dispatch approved runs.
-- Existing campaign_transition() enforces a different creator/submitter for approval.
CREATE OR REPLACE FUNCTION public.can_edit_campaigns(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND status='active')
  AND (public.is_platform_super_admin() OR EXISTS (
   SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND user_id=(SELECT auth.uid())
    AND role IN ('company_admin','manager','campaign_lead','designer')));
$$;
CREATE OR REPLACE FUNCTION public.can_approve_campaigns(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND status='active')
  AND (public.is_platform_super_admin() OR EXISTS (
   SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND user_id=(SELECT auth.uid())
    AND role IN ('company_admin','campaign_lead','approver')));
$$;
CREATE OR REPLACE FUNCTION public.can_dispatch_campaigns(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND status='active')
  AND (public.is_platform_super_admin() OR EXISTS (
   SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND user_id=(SELECT auth.uid())
    AND role IN ('company_admin','manager','campaign_lead')));
$$;
REVOKE ALL ON FUNCTION public.can_edit_campaigns(uuid),public.can_approve_campaigns(uuid),public.can_dispatch_campaigns(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_edit_campaigns(uuid),public.can_approve_campaigns(uuid),public.can_dispatch_campaigns(uuid) TO authenticated;

-- Existing staff role assignment, preserving last-company-admin protection.
CREATE OR REPLACE FUNCTION public.team_member_save(p_org uuid,p_email text,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_previous text;
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable';END IF;
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Not authorized';END IF;
 IF p_email IS NULL OR length(p_email)>254 OR p_role IS NULL
  OR p_role NOT IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer','remove')
  THEN RAISE EXCEPTION 'Invalid member';END IF;
 SELECT id INTO v_user FROM auth.users WHERE lower(email)=lower(trim(p_email)) AND email_confirmed_at IS NOT NULL;
 IF v_user IS NULL THEN RAISE EXCEPTION 'A verified account is required';END IF;
 SELECT role INTO v_previous FROM public.organization_members WHERE organization_id=p_org AND user_id=v_user;
 IF v_previous='company_admin' AND p_role<>'company_admin'
  AND NOT EXISTS(SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND role='company_admin' AND user_id<>v_user)
  THEN RAISE EXCEPTION 'Keep at least one company administrator';END IF;
 IF p_role='remove' THEN DELETE FROM public.organization_members WHERE organization_id=p_org AND user_id=v_user;
 ELSE INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(p_org,v_user,p_role)
  ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role;END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'team.member_saved','membership',v_user::text,jsonb_build_object('role',p_role));
END;$$;
REVOKE ALL ON FUNCTION public.team_member_save(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.team_member_save(uuid,text,text) TO authenticated;

-- Invite new staff into the exact allowed roles; keep verified-user and expiry checks.
CREATE OR REPLACE FUNCTION public.team_invite_prepare(p_org uuid,p_email text,p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;v_user_id uuid;
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Not authorized';END IF;
 IF p_org IS NULL OR p_email IS NULL OR p_role IS NULL THEN RAISE EXCEPTION 'Invalid invitation';END IF;
 v_email:=lower(btrim(p_email));
 IF length(v_email) NOT BETWEEN 3 AND 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR p_role NOT IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer')
    THEN RAISE EXCEPTION 'Invalid invitation';END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Charis workspace is not active';END IF;
 SELECT id INTO v_user_id FROM auth.users WHERE lower(email)=v_email AND email_confirmed_at IS NOT NULL LIMIT 1;
 IF v_user_id IS NOT NULL THEN
   PERFORM public.team_member_save(p_org,v_email,p_role);
   UPDATE public.team_invitations SET status='accepted',accepted_at=now()
    WHERE organization_id=p_org AND email=v_email AND status='pending';
   RETURN 'member_added';
 END IF;
 INSERT INTO public.team_invitations(organization_id,email,role,invited_by)
 VALUES(p_org,v_email,p_role,auth.uid())
 ON CONFLICT(organization_id,email) DO UPDATE
 SET role=EXCLUDED.role,status='pending',invited_by=auth.uid(),invited_at=now(),
     expires_at=now()+interval '7 days',accepted_at=NULL;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'team.invitation_prepared','invitation',v_email,jsonb_build_object('role',p_role));
 RETURN 'invitation_pending';
END;$$;
REVOKE ALL ON FUNCTION public.team_invite_prepare(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.team_invite_prepare(uuid,text,text) TO authenticated;

-- One RLS-gated server-side request replaces many dashboard requests and returns NO customer PII.
CREATE OR REPLACE FUNCTION public.charis_dashboard_overview(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text;v_status text;
BEGIN
 IF auth.uid() IS NULL OR p_org IS NULL THEN RETURN NULL;END IF;
 IF NOT (public.is_platform_super_admin() OR EXISTS (
   SELECT 1 FROM public.organization_members m
   WHERE m.organization_id=p_org AND m.user_id=auth.uid())) THEN RETURN NULL;END IF;
 SELECT name,status INTO v_name,v_status FROM public.organizations WHERE id=p_org;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object(
  'name',v_name,'status',v_status,
  'contacts',(SELECT count(*) FROM public.contacts WHERE organization_id=p_org AND archived_at IS NULL),
  'groups',(SELECT count(*) FROM public.contact_lists WHERE organization_id=p_org),
  'campaigns',(SELECT count(*) FROM public.campaign_drafts WHERE organization_id=p_org),
  'pending',(SELECT count(*) FROM public.campaign_drafts WHERE organization_id=p_org AND status='pending_approval'),
  'approved',(SELECT count(*) FROM public.campaign_drafts WHERE organization_id=p_org AND status='approved'),
  'queued',(SELECT count(*) FROM public.campaign_runs WHERE organization_id=p_org AND status IN ('queued','running')),
  'recent',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.updated_at DESC)
    FROM (SELECT id,name,status,updated_at FROM public.campaign_drafts
          WHERE organization_id=p_org ORDER BY updated_at DESC LIMIT 5) q),'[]'::jsonb)
 );
END;$$;
REVOKE ALL ON FUNCTION public.charis_dashboard_overview(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_dashboard_overview(uuid) TO authenticated;
-- Campaign authors (including Campaign Lead) may send a small test to their OWN verified email.
-- Provider budget, one-per-minute, and 10-per-day limits are retained.
CREATE OR REPLACE FUNCTION public.email_test_reserve(p_org uuid,p_sender uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_provider text;p public.email_provider_settings;v_count integer;
BEGIN
 IF NOT (public.can_manage_senders(p_org) OR public.can_edit_campaigns(p_org))
  THEN RAISE EXCEPTION 'Not authorized';END IF;
 SELECT sd.provider INTO v_provider FROM public.sender_identities si
 JOIN public.sending_domains sd ON sd.id=si.domain_id AND sd.organization_id=si.organization_id
 WHERE si.id=p_sender AND si.organization_id=p_org AND si.is_active AND sd.verification_status='verified';
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified sender unavailable';END IF;
 SELECT * INTO p FROM public.email_provider_settings WHERE provider=v_provider FOR UPDATE;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 IF NOT p.enabled THEN RAISE EXCEPTION 'Provider unavailable';END IF;
 SELECT count(*) INTO v_count FROM public.delivery_quota_reservations
 WHERE provider=v_provider AND reserved_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
 SELECT v_count+count(*) INTO v_count FROM public.email_test_attempts t
 JOIN public.sender_identities si ON si.id=t.sender_id
 JOIN public.sending_domains sd ON sd.id=si.domain_id
 WHERE sd.provider=v_provider AND t.created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
 IF v_count>=p.daily_limit OR p.last_dispatch_at>now()-make_interval(secs=>p.minimum_interval_seconds)
 THEN RAISE EXCEPTION 'Provider allowance or spacing limit reached';END IF;
 IF EXISTS(SELECT 1 FROM public.email_test_attempts WHERE organization_id=p_org AND created_at>now()-interval '1 minute')
  OR (SELECT count(*) FROM public.email_test_attempts WHERE organization_id=p_org AND created_at>now()-interval '24 hours')>=10
 THEN RAISE EXCEPTION 'Test limit reached';END IF;
 INSERT INTO public.email_test_attempts(organization_id,sender_id,actor_id)
 VALUES(p_org,p_sender,auth.uid()) RETURNING id INTO v_id;
 UPDATE public.email_provider_settings SET last_dispatch_at=now() WHERE provider=v_provider;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'email_test.reserved','email_test',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.email_test_reserve(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.email_test_reserve(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_campaign_test_reserve(p_org uuid,p_campaign uuid,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.campaign_drafts;s public.sender_identities;b public.organization_branding;v_attempt uuid;v_email text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active')
 OR NOT public.can_edit_campaigns(p_org)
 THEN RAISE EXCEPTION 'An authorised campaign creator must sign in to test a campaign';END IF;
 SELECT email INTO v_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Verified account email required';END IF;
 SELECT * INTO c FROM public.campaign_drafts WHERE id=p_campaign AND organization_id=p_org;
 IF NOT FOUND OR c.status='archived' THEN RAISE EXCEPTION 'Saved active campaign required';END IF;
 IF c.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Campaign changed. Reload before testing';END IF;
 SELECT * INTO s FROM public.sender_identities WHERE id=c.sender_id AND organization_id=p_org AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select a verified sender and save your draft first';END IF;
 SELECT * INTO b FROM public.organization_branding WHERE organization_id=p_org;
 IF length(trim(coalesce(b.postal_address,'')))<6 THEN RAISE EXCEPTION 'Save your business postal address before testing';END IF;
 v_attempt:=public.email_test_reserve(p_org,c.sender_id);
 UPDATE public.email_test_attempts SET campaign_id=c.id,campaign_revision=c.revision WHERE id=v_attempt;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'campaign.test_reserved','campaign',c.id::text,jsonb_build_object('revision',c.revision,'attempt',v_attempt));
 RETURN jsonb_build_object('attempt',v_attempt,'campaign',to_jsonb(c),'sender',to_jsonb(s),'brand',to_jsonb(b),'recipient',v_email);
END;$$;
REVOKE ALL ON FUNCTION public.charis_campaign_test_reserve(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_campaign_test_reserve(uuid,uuid,integer) TO authenticated;
COMMIT;
