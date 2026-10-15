-- CHARIS 030 | Batch 2B access-policy reinforcement.
-- Run only AFTER 029. Additive and safe for existing customers, campaigns,
-- departments, branches, and sender configuration. No delivery is enabled.
-- PostgreSQL combines PERMISSIVE RLS policies with OR; restrictive policies
-- below ensure an older permissive SELECT policy cannot expose a bank-wide row.
BEGIN;

-- The permission list used by menus must match server access checks.
-- Branch-restricted employees cannot retain bank-wide administrative actions.
CREATE OR REPLACE FUNCTION public.charis_has_permission(p_org uuid,p_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_member public.organization_members;v_override boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.charis_permission_catalog WHERE permission_key=p_key) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active') THEN RETURN false; END IF;
 IF public.is_platform_super_admin() THEN RETURN true; END IF;
 SELECT * INTO v_member FROM public.organization_members
 WHERE organization_id=p_org AND user_id=(SELECT auth.uid());
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_key=ANY(ARRAY[
  'staff.manage','access.manage','departments.manage','branches.manage',
  'providers.manage','settings.manage','customers.manage','customers.assign',
  'campaigns.view','campaigns.create','campaigns.approve','campaigns.send',
  'reports.view','audit.view'
 ]) AND NOT public.charis_is_bankwide(p_org) THEN RETURN false; END IF;
 SELECT allowed INTO v_override FROM public.charis_staff_permissions
 WHERE organization_id=p_org AND user_id=(SELECT auth.uid()) AND permission_key=p_key;
 IF FOUND THEN RETURN v_override; END IF;
 IF EXISTS(SELECT 1 FROM public.charis_staff_access_roles a
   JOIN public.charis_access_roles r ON r.organization_id=a.organization_id AND r.id=a.role_id AND r.active
   JOIN public.charis_role_permissions p ON p.organization_id=r.organization_id AND p.role_id=r.id
   WHERE a.organization_id=p_org AND a.user_id=(SELECT auth.uid()) AND p.permission_key=p_key) THEN RETURN true; END IF;
 RETURN public.charis_base_role_permission(v_member.role,p_key) OR EXISTS (
   SELECT 1 FROM public.charis_additional_roles a WHERE a.organization_id=p_org
   AND a.user_id=(SELECT auth.uid()) AND public.charis_base_role_permission(a.role,p_key));
END;$$;
REVOKE ALL ON FUNCTION public.charis_has_permission(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_has_permission(uuid,text) TO authenticated;

-- An authorised bank-wide customer viewer can resolve assigned branch names
-- without obtaining branch administration rights.
DROP POLICY IF EXISTS charis_branches_read_029 ON public.charis_branches;
CREATE POLICY charis_branches_read_029 ON public.charis_branches
 FOR SELECT TO authenticated USING(
  public.charis_has_permission(organization_id,'branches.manage')
  OR public.charis_has_permission(organization_id,'departments.manage')
  OR (public.charis_is_bankwide(organization_id) AND
      public.charis_has_permission(organization_id,'customers.view'))
  OR EXISTS(SELECT 1 FROM public.charis_staff_branch_assignments a
    WHERE a.organization_id=charis_branches.organization_id
      AND a.branch_id=charis_branches.id AND a.user_id=(SELECT auth.uid()))
 );

-- A contact must be within the viewer's explicitly authorised branch scope.
-- This is an additional AND condition on every authenticated SELECT policy.
DROP POLICY IF EXISTS charis_contacts_guard_030 ON public.contacts;
CREATE POLICY charis_contacts_guard_030 ON public.contacts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_can_view_customer(organization_id,id));

-- List metadata, segment rules and import batches belong only to authorised
-- bank-wide customer administrators until dedicated branch-scoped audiences exist.
DROP POLICY IF EXISTS charis_lists_guard_030 ON public.contact_lists;
CREATE POLICY charis_lists_guard_030 ON public.contact_lists
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_contacts(organization_id));
DROP POLICY IF EXISTS charis_list_members_guard_030 ON public.contact_list_members;
CREATE POLICY charis_list_members_guard_030 ON public.contact_list_members
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_contacts(organization_id));
DROP POLICY IF EXISTS charis_segments_guard_030 ON public.contact_segments;
CREATE POLICY charis_segments_guard_030 ON public.contact_segments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_contacts(organization_id));
DROP POLICY IF EXISTS charis_import_batches_guard_030 ON public.contact_import_batches;
CREATE POLICY charis_import_batches_guard_030 ON public.contact_import_batches
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_contacts(organization_id));

-- Campaign data and dispatch status require bank-wide campaigns.view. A
-- branch-only staff member cannot infer other branches' campaign activity.
DROP POLICY IF EXISTS charis_campaign_drafts_guard_030 ON public.campaign_drafts;
CREATE POLICY charis_campaign_drafts_guard_030 ON public.campaign_drafts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS charis_campaign_revisions_guard_030 ON public.campaign_revisions;
CREATE POLICY charis_campaign_revisions_guard_030 ON public.campaign_revisions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS charis_campaign_runs_guard_030 ON public.campaign_runs;
CREATE POLICY charis_campaign_runs_guard_030 ON public.campaign_runs
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS charis_sms_campaigns_guard_030 ON public.charis_sms_campaigns;
CREATE POLICY charis_sms_campaigns_guard_030 ON public.charis_sms_campaigns
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS charis_sms_tests_guard_030 ON public.charis_sms_tests;
CREATE POLICY charis_sms_tests_guard_030 ON public.charis_sms_tests
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS charis_email_test_guard_030 ON public.email_test_attempts;
CREATE POLICY charis_email_test_guard_030 ON public.email_test_attempts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS charis_email_suppressions_guard_030 ON public.email_suppressions;
CREATE POLICY charis_email_suppressions_guard_030 ON public.email_suppressions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_manage_contacts(organization_id));

-- Ensure a bank branch cannot be archived while staff remain assigned to it.
-- Preserve the function signature consumed by the existing Branches server action.
CREATE OR REPLACE FUNCTION public.charis_branch_save(
  p_org uuid,p_id uuid,p_name text,p_code text,p_description text,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_code text;
BEGIN
 IF NOT (public.charis_has_permission(p_org,'branches.manage') OR
         public.charis_has_permission(p_org,'departments.manage')) THEN
  RAISE EXCEPTION 'Branch management required';
 END IF;
 v_code:=upper(btrim(coalesce(p_code,'')));
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 100
   OR v_code !~ '^[A-Z0-9_-]{2,20}$'
   OR length(coalesce(p_description,''))>300 THEN
  RAISE EXCEPTION 'Check branch details';
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.charis_branches(organization_id,name,code,description,active,created_by)
  VALUES(p_org,btrim(p_name),v_code,coalesce(p_description,''),true,auth.uid())
  RETURNING id INTO v_id;
 ELSE
  SELECT id INTO v_id FROM public.charis_branches
  WHERE organization_id=p_org AND id=p_id FOR UPDATE;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Branch unavailable'; END IF;
  IF NOT p_active THEN
   IF EXISTS(SELECT 1 FROM public.charis_customer_locations
     WHERE organization_id=p_org AND branch_id=p_id) THEN
    RAISE EXCEPTION 'Reassign customers before archiving this branch';
   END IF;
   IF EXISTS(SELECT 1 FROM public.charis_staff_branch_assignments
     WHERE organization_id=p_org AND branch_id=p_id) THEN
    RAISE EXCEPTION 'Remove staff assignments before archiving this branch';
   END IF;
  END IF;
  UPDATE public.charis_branches SET
    name=btrim(p_name),code=v_code,description=coalesce(p_description,''),active=p_active
  WHERE organization_id=p_org AND id=p_id;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'branch.saved','branch',v_id::text,
        jsonb_build_object('active',coalesce(p_active,true)));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_branch_save(uuid,uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_branch_save(uuid,uuid,text,text,text,boolean) TO authenticated;

-- Dashboard must never disclose organization-wide aggregates to a
-- branch-restricted user. Keep the response shape expected by the existing UI.
CREATE OR REPLACE FUNCTION public.charis_dashboard_overview(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text;v_status text;v_campaigns boolean;v_customers boolean;v_groups boolean;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR p_org IS NULL THEN RETURN NULL; END IF;
 IF NOT (public.is_platform_super_admin() OR EXISTS(
   SELECT 1 FROM public.organization_members
   WHERE organization_id=p_org AND user_id=(SELECT auth.uid()))) THEN RETURN NULL; END IF;
 SELECT name,status INTO v_name,v_status FROM public.organizations
 WHERE id=p_org AND slug='charis-mfb';
 IF NOT FOUND THEN RETURN NULL; END IF;
 v_campaigns:=public.charis_has_permission(p_org,'campaigns.view');
 v_customers:=public.charis_has_permission(p_org,'customers.view') OR
              public.charis_has_permission(p_org,'customers.manage');
 v_groups:=public.can_manage_contacts(p_org);
 RETURN jsonb_build_object(
  'name',v_name,'status',v_status,
  'contacts',CASE WHEN v_customers THEN
    (SELECT count(*) FROM public.contacts c
      WHERE c.organization_id=p_org AND c.archived_at IS NULL
        AND public.charis_can_view_customer(p_org,c.id)) ELSE 0 END,
  'groups',CASE WHEN v_groups THEN
    (SELECT count(*) FROM public.contact_lists WHERE organization_id=p_org) ELSE 0 END,
  'campaigns',CASE WHEN v_campaigns THEN
    (SELECT count(*) FROM public.campaign_drafts WHERE organization_id=p_org) ELSE 0 END,
  'pending',CASE WHEN v_campaigns THEN
    (SELECT count(*) FROM public.campaign_drafts WHERE organization_id=p_org AND status='pending_approval') ELSE 0 END,
  'approved',CASE WHEN v_campaigns THEN
    (SELECT count(*) FROM public.campaign_drafts WHERE organization_id=p_org AND status='approved') ELSE 0 END,
  'queued',CASE WHEN v_campaigns THEN
    (SELECT count(*) FROM public.campaign_runs WHERE organization_id=p_org AND status IN ('queued','running')) ELSE 0 END,
  'recent',CASE WHEN v_campaigns THEN coalesce((
    SELECT jsonb_agg(to_jsonb(q) ORDER BY q.updated_at DESC)
    FROM (SELECT id,name,status,updated_at FROM public.campaign_drafts
      WHERE organization_id=p_org ORDER BY updated_at DESC LIMIT 5) q),'[]'::jsonb) ELSE '[]'::jsonb END
 );
END;$$;
REVOKE ALL ON FUNCTION public.charis_dashboard_overview(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_dashboard_overview(uuid) TO authenticated;

-- SECURITY DEFINER APIs run with elevated database privileges and bypass table RLS.
-- The previous implementation checked only organisation membership; require a
-- bank-wide authorised capability before returning counts or delivery details.

-- Authorised reporting/recipient lookup: preserve the existing function logic.
CREATE OR REPLACE FUNCTION public.campaign_audience_count(p_org uuid,p_type text,p_audience uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
declare v_rules jsonb; v_count integer;
begin
 if not (public.charis_has_permission(p_org,'campaigns.view') or public.charis_has_permission(p_org,'campaigns.create')) then raise exception 'Not authorized'; end if;
 if p_type='list' and not exists(select 1 from public.contact_lists where id=p_audience and organization_id=p_org) then raise exception 'List unavailable'; end if;
 if p_type='segment' then
  select rules into v_rules from public.contact_segments where id=p_audience and organization_id=p_org;
  if not found then raise exception 'Segment unavailable'; end if;
 elsif p_type not in ('all','list') then raise exception 'Invalid audience'; end if;
 select count(*) into v_count from public.contacts c where c.organization_id=p_org and c.email is not null
 and c.consent_status='granted' and c.unsubscribed_at is null
 and (p_type<>'list' or exists(select 1 from public.contact_list_members lm where lm.organization_id=p_org and lm.list_id=p_audience and lm.contact_id=c.id))
 and (p_type<>'segment' or (
 (not(v_rules?'source') or c.source=v_rules->>'source') and
 (not(v_rules?'consent_status') or c.consent_status=v_rules->>'consent_status') and
 (not(v_rules?'has_email') or (c.email is not null)=(v_rules->>'has_email')::boolean)));
 return v_count;
end;$$;

-- Authorised reporting/recipient lookup: preserve the existing function logic.
CREATE OR REPLACE FUNCTION public.campaign_analytics(p_org uuid,p_from timestamptz,p_until timestamptz,p_run uuid default null,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not public.charis_has_permission(p_org,'reports.view') then raise exception 'Not authorized';end if;
 if p_org is null or p_from is null or p_until is null or p_until<=p_from or p_until-p_from>interval '366 days'
 or p_limit is null or p_limit not between 1 and 1000 or p_offset is null or p_offset not between 0 and 100000 then raise exception 'Invalid report range';end if;
 if p_run is not null and not exists(select 1 from public.campaign_runs where id=p_run and organization_id=p_org) then raise exception 'Run unavailable';end if;
 with cohort as materialized (
  select r.id,r.snapshot->'campaign'->>'name' as name,r.provider,r.status,r.created_at,r.scheduled_at
  from public.campaign_runs r where r.organization_id=p_org and r.created_at>=p_from and r.created_at<p_until and (p_run is null or r.id=p_run)
 ), flags as (
  select d.run_id,d.status,d.provider_message_id is not null as submitted,d.attempts,
   coalesce(e.delivered,false) as delivered,coalesce(e.opened,false) as opened,coalesce(e.clicked,false) as clicked,
   coalesce(e.bounced,false) as bounced,coalesce(e.complained,false) as complained,
   (d.unsubscribe_recorded_at is not null or coalesce(e.unsubscribed,false)) as unsubscribed
  from public.email_deliveries d join cohort c on c.id=d.run_id
  left join lateral (select bool_or(event_type='delivered') as delivered,bool_or(event_type='opened') as opened,bool_or(event_type='clicked') as clicked,
   bool_or(event_type='bounce') as bounced,bool_or(event_type='complaint') as complained,bool_or(event_type='unsubscribe') as unsubscribed
   from public.email_delivery_events where delivery_id=d.id) e on true
  where d.organization_id=p_org
 ), metrics as materialized (
  select c.id,c.name,c.provider,c.status,c.created_at,c.scheduled_at,
   count(f.run_id) as recipients,count(*) filter(where f.submitted) as submitted,
   count(*) filter(where f.delivered) as delivered,count(*) filter(where f.opened) as opened,count(*) filter(where f.clicked) as clicked,
   count(*) filter(where f.bounced) as bounced,count(*) filter(where f.complained) as complained,count(*) filter(where f.unsubscribed) as unsubscribed,
   count(*) filter(where f.status='failed') as failed,count(*) filter(where f.status='unknown') as unknown,
   count(*) filter(where f.status='skipped') as skipped,count(*) filter(where f.status in ('pending','leased','dispatching')) as waiting,
   coalesce(sum(f.attempts),0) as attempts
  from cohort c left join flags f on f.run_id=c.id group by c.id,c.name,c.provider,c.status,c.created_at,c.scheduled_at
 ), daily as (
  select (created_at at time zone 'UTC')::date as day,count(*) as runs,sum(recipients) as recipients,sum(submitted) as submitted,sum(delivered) as delivered
  from metrics group by (created_at at time zone 'UTC')::date
 )
 select jsonb_build_object('generated_at',now(),'total_runs',(select count(*) from metrics),
  'totals',(select jsonb_build_object('recipients',coalesce(sum(recipients),0),'submitted',coalesce(sum(submitted),0),'delivered',coalesce(sum(delivered),0),
   'opened',coalesce(sum(opened),0),'clicked',coalesce(sum(clicked),0),'bounced',coalesce(sum(bounced),0),'complained',coalesce(sum(complained),0),
   'unsubscribed',coalesce(sum(unsubscribed),0),'failed',coalesce(sum(failed),0),'unknown',coalesce(sum(unknown),0),'skipped',coalesce(sum(skipped),0),
   'waiting',coalesce(sum(waiting),0),'attempts',coalesce(sum(attempts),0)) from metrics),
  'runs',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc) from (select * from metrics order by created_at desc,id desc limit p_limit offset p_offset) x),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily),'[]'::jsonb)) into v_result;
 return v_result;
end;$$;

-- Authorised reporting/recipient lookup: preserve the existing function logic.
CREATE OR REPLACE FUNCTION public.delivery_summary(p_org uuid,p_run uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not (public.charis_has_permission(p_org,'reports.view') or public.charis_has_permission(p_org,'campaigns.view')) then raise exception 'Not authorized';end if;
 select jsonb_object_agg(status,cnt) into v_result from (select status,count(*) cnt from public.email_deliveries where organization_id=p_org and run_id=p_run group by status) x;
 return coalesce(v_result,'{}');
end;$$;

-- Authorised reporting/recipient lookup: preserve the existing function logic.
CREATE OR REPLACE FUNCTION public.charis_delivery_provider_summary(p_org uuid,p_run uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_out jsonb;
BEGIN
 IF NOT (public.charis_has_permission(p_org,'reports.view') OR public.charis_has_permission(p_org,'campaigns.view')) THEN RAISE EXCEPTION 'Not authorised';END IF;
 SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO v_out FROM (
  SELECT coalesce(q.provider,r.provider) AS provider,q.status,count(*)::integer AS count
  FROM public.email_deliveries q JOIN public.campaign_runs r ON r.id=q.run_id
  WHERE q.organization_id=p_org AND q.run_id=p_run GROUP BY 1,2 ORDER BY 1,2) x;
 RETURN v_out;
END;$$;

COMMIT;
