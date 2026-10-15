-- CHARIS 029 | Bank-managed branches, staff data scope and customer routing.
-- Apply after 028. Additive; no department, branch or customer records are removed.
-- No emails/SMS are sent by this migration.
BEGIN;

INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('branches.manage','Manage branch directory','Administration','Create and archive bank branches'),
 ('customers.assign','Assign customer branches','Customers','Route customers to authorised branches')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;

CREATE TABLE IF NOT EXISTS public.charis_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 100),
 code text NOT NULL CHECK(code ~ '^[A-Z0-9_-]{2,20}$'),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=300),
 active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,code)
);
CREATE TABLE IF NOT EXISTS public.charis_staff_scope_settings (
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL,
 bank_wide boolean NOT NULL DEFAULT false,
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE
);
-- Preserve existing staff visibility: only memberships present at initial installation are grandfathered.
-- Staff invited after 029 have no bank-wide access until deliberately assigned by an administrator.
INSERT INTO public.charis_staff_scope_settings(organization_id,user_id,bank_wide)
SELECT m.organization_id,m.user_id,true FROM public.organization_members m
JOIN public.organizations o ON o.id=m.organization_id AND o.slug='charis-mfb'
ON CONFLICT(organization_id,user_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.charis_staff_branch_assignments (
 organization_id uuid NOT NULL, user_id uuid NOT NULL, branch_id uuid NOT NULL,
 assigned_by uuid REFERENCES auth.users(id), assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id,branch_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,branch_id) REFERENCES public.charis_branches(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS charis_staff_branch_lookup ON public.charis_staff_branch_assignments(organization_id,branch_id,user_id);
CREATE TABLE IF NOT EXISTS public.charis_customer_locations (
 organization_id uuid NOT NULL, contact_id uuid NOT NULL,
 branch_id uuid NOT NULL, department_id uuid,
 assigned_by uuid REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,contact_id),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,branch_id) REFERENCES public.charis_branches(organization_id,id),
 FOREIGN KEY(organization_id,department_id) REFERENCES public.charis_departments(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_customer_branch_lookup ON public.charis_customer_locations(organization_id,branch_id);

CREATE OR REPLACE FUNCTION public.charis_is_bankwide(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_platform_super_admin() OR EXISTS(
  SELECT 1 FROM public.charis_staff_scope_settings s
   JOIN public.organizations o ON o.id=s.organization_id AND o.slug='charis-mfb' AND o.status='active'
   WHERE s.organization_id=p_org AND s.user_id=(SELECT auth.uid()) AND s.bank_wide
 );
$$;
REVOKE ALL ON FUNCTION public.charis_is_bankwide(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_is_bankwide(uuid) TO authenticated;

-- Enforce scoped permissions at the root, not just by hiding links in the interface.
-- Branch-only users may view explicitly assigned customers. Wide campaign/report access is
-- unavailable until later migration hardens the older campaign/report RPCs too.
CREATE OR REPLACE FUNCTION public.charis_has_permission(p_org uuid,p_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_member public.organization_members;v_override boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.charis_permission_catalog WHERE permission_key=p_key) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active') THEN RETURN false;END IF;
 IF public.is_platform_super_admin() THEN RETURN true;END IF;
 SELECT * INTO v_member FROM public.organization_members WHERE organization_id=p_org AND user_id=(SELECT auth.uid());
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_key=ANY(ARRAY['customers.manage','customers.assign','campaigns.view','campaigns.create',
  'campaigns.approve','campaigns.send','reports.view','audit.view'])
  AND NOT public.charis_is_bankwide(p_org) THEN RETURN false;END IF;
 SELECT allowed INTO v_override FROM public.charis_staff_permissions
  WHERE organization_id=p_org AND user_id=(SELECT auth.uid()) AND permission_key=p_key;
 IF FOUND THEN RETURN v_override;END IF;
 IF EXISTS(SELECT 1 FROM public.charis_staff_access_roles a
  JOIN public.charis_access_roles r ON r.organization_id=a.organization_id AND r.id=a.role_id AND r.active
  JOIN public.charis_role_permissions p ON p.organization_id=r.organization_id AND p.role_id=r.id
  WHERE a.organization_id=p_org AND a.user_id=(SELECT auth.uid()) AND p.permission_key=p_key) THEN RETURN true;END IF;
 RETURN public.charis_base_role_permission(v_member.role,p_key) OR EXISTS (
  SELECT 1 FROM public.charis_additional_roles a WHERE a.organization_id=p_org AND a.user_id=(SELECT auth.uid())
   AND public.charis_base_role_permission(a.role,p_key));
END;$$;
REVOKE ALL ON FUNCTION public.charis_has_permission(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_has_permission(uuid,text) TO authenticated;

-- Viewing customer PII additionally requires both a capability and a matching branch assignment.
CREATE OR REPLACE FUNCTION public.charis_can_view_customer(p_org uuid,p_contact uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (public.charis_has_permission(p_org,'customers.view') OR public.charis_has_permission(p_org,'customers.manage'))
 AND (public.charis_is_bankwide(p_org) OR EXISTS (
  SELECT 1 FROM public.charis_customer_locations c
  JOIN public.charis_staff_branch_assignments a ON a.organization_id=c.organization_id
    AND a.branch_id=c.branch_id AND a.user_id=(SELECT auth.uid())
  JOIN public.charis_branches b ON b.organization_id=c.organization_id AND b.id=c.branch_id AND b.active
  WHERE c.organization_id=p_org AND c.contact_id=p_contact
 ));
$$;
REVOKE ALL ON FUNCTION public.charis_can_view_customer(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_can_view_customer(uuid,uuid) TO authenticated;

-- 029 only enables branch-scoped *read* access. Existing privileged customer mutations
-- continue to require bank-wide customers.manage so old SECURITY DEFINER endpoints cannot
-- be used by a branch-only user to update a different branch's customers.
CREATE OR REPLACE FUNCTION public.can_manage_contacts(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'customers.manage') AND public.charis_is_bankwide(p_org);
$$;
REVOKE ALL ON FUNCTION public.can_manage_contacts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_contacts(uuid) TO authenticated;
DROP POLICY IF EXISTS "authorized company staff view contacts" ON public.contacts;
DROP POLICY IF EXISTS charis_customer_scoped_read_029 ON public.contacts;
CREATE POLICY charis_customer_scoped_read_029 ON public.contacts FOR SELECT TO authenticated
 USING(public.charis_can_view_customer(organization_id,id));

CREATE OR REPLACE FUNCTION public.charis_branch_save(p_org uuid,p_id uuid,p_name text,p_code text,p_description text,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_code text;
BEGIN
 IF NOT (public.charis_has_permission(p_org,'branches.manage') OR public.charis_has_permission(p_org,'departments.manage')) THEN
  RAISE EXCEPTION 'Branch management required';END IF;
 v_code:=upper(btrim(coalesce(p_code,'')));
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 100 OR v_code !~ '^[A-Z0-9_-]{2,20}$'
    OR length(coalesce(p_description,''))>300 THEN RAISE EXCEPTION 'Check branch details';END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.charis_branches(organization_id,name,code,description,active,created_by)
  VALUES(p_org,btrim(p_name),v_code,coalesce(p_description,''),true,auth.uid()) RETURNING id INTO v_id;
 ELSE
  SELECT id INTO v_id FROM public.charis_branches WHERE organization_id=p_org AND id=p_id FOR UPDATE;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Branch unavailable';END IF;
  IF NOT p_active AND EXISTS(SELECT 1 FROM public.charis_customer_locations WHERE organization_id=p_org AND branch_id=p_id)
   THEN RAISE EXCEPTION 'Reassign customers before archiving this branch';END IF;
  UPDATE public.charis_branches SET name=btrim(p_name),code=v_code,description=coalesce(p_description,''),active=p_active
   WHERE organization_id=p_org AND id=p_id;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'branch.saved','branch',v_id::text,jsonb_build_object('active',coalesce(p_active,true)));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_branch_save(uuid,uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_branch_save(uuid,uuid,text,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_staff_scope_save(p_org uuid,p_staff uuid,p_bank_wide boolean,p_branch uuid,p_assign boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'access.manage') OR NOT public.charis_is_bankwide(p_org)
  THEN RAISE EXCEPTION 'Access administration required';END IF;
 IF p_staff=auth.uid() THEN RAISE EXCEPTION 'You cannot change your own data scope';END IF;
 IF EXISTS(SELECT 1 FROM public.platform_staff WHERE user_id=p_staff AND role='super_admin') THEN
  RAISE EXCEPTION 'System owner scope cannot be delegated';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_staff)
  THEN RAISE EXCEPTION 'Staff member unavailable';END IF;
 IF p_branch IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.charis_branches WHERE organization_id=p_org AND id=p_branch AND active)
  THEN RAISE EXCEPTION 'Active branch required';END IF;
 INSERT INTO public.charis_staff_scope_settings(organization_id,user_id,bank_wide,updated_by)
 VALUES(p_org,p_staff,coalesce(p_bank_wide,false),auth.uid())
 ON CONFLICT(organization_id,user_id) DO UPDATE SET bank_wide=excluded.bank_wide,updated_by=excluded.updated_by,updated_at=now();
 IF p_branch IS NOT NULL THEN
  IF p_assign THEN
   INSERT INTO public.charis_staff_branch_assignments(organization_id,user_id,branch_id,assigned_by)
   VALUES(p_org,p_staff,p_branch,auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
   DELETE FROM public.charis_staff_branch_assignments WHERE organization_id=p_org AND user_id=p_staff AND branch_id=p_branch;
  END IF;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.data_scope_changed','staff',p_staff::text,
 jsonb_build_object('bank_wide',p_bank_wide,'branch_id',p_branch,'branch_assigned',p_assign));
END;$$;
REVOKE ALL ON FUNCTION public.charis_staff_scope_save(uuid,uuid,boolean,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_scope_save(uuid,uuid,boolean,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_customer_location_save(p_org uuid,p_contact uuid,p_branch uuid,p_department uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_manage_contacts(p_org) OR NOT (public.charis_has_permission(p_org,'customers.assign')
  OR public.charis_has_permission(p_org,'departments.manage')) THEN
  RAISE EXCEPTION 'Customer allocation permission required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE organization_id=p_org AND id=p_contact) THEN RAISE EXCEPTION 'Customer unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_branches WHERE organization_id=p_org AND id=p_branch AND active) THEN RAISE EXCEPTION 'Choose an active branch';END IF;
 IF p_department IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.charis_departments
  WHERE organization_id=p_org AND id=p_department AND active) THEN RAISE EXCEPTION 'Choose an active department';END IF;
 INSERT INTO public.charis_customer_locations(organization_id,contact_id,branch_id,department_id,assigned_by)
 VALUES(p_org,p_contact,p_branch,p_department,auth.uid())
 ON CONFLICT(organization_id,contact_id) DO UPDATE SET branch_id=excluded.branch_id,department_id=excluded.department_id,
 assigned_by=excluded.assigned_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'customer.branch_assigned','contact',p_contact::text,jsonb_build_object('branch_id',p_branch,'department_id',p_department));
END;$$;
REVOKE ALL ON FUNCTION public.charis_customer_location_save(uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_customer_location_save(uuid,uuid,uuid,uuid) TO authenticated;

ALTER TABLE public.charis_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_staff_scope_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_staff_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_customer_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_branches,public.charis_staff_scope_settings,public.charis_staff_branch_assignments,public.charis_customer_locations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_branches,public.charis_staff_scope_settings,public.charis_staff_branch_assignments,public.charis_customer_locations TO authenticated;
CREATE POLICY charis_branches_read_029 ON public.charis_branches FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'departments.manage') OR public.charis_has_permission(organization_id,'branches.manage')
 OR EXISTS(SELECT 1 FROM public.charis_staff_branch_assignments a WHERE a.organization_id=charis_branches.organization_id AND a.branch_id=charis_branches.id AND a.user_id=(SELECT auth.uid())));
CREATE POLICY charis_scope_settings_read_029 ON public.charis_staff_scope_settings FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public.charis_has_permission(organization_id,'access.manage'));
CREATE POLICY charis_staff_branches_read_029 ON public.charis_staff_branch_assignments FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR public.charis_has_permission(organization_id,'access.manage'));
CREATE POLICY charis_customer_locations_read_029 ON public.charis_customer_locations FOR SELECT TO authenticated
 USING(public.can_manage_contacts(organization_id) OR public.charis_can_view_customer(organization_id,contact_id));

-- Remove historical organisation-wide read policies for sensitive communication records.
-- Restricted staff cannot query campaign or delivery content directly through Supabase.
DROP POLICY IF EXISTS "members read campaigns" ON public.campaign_drafts;
CREATE POLICY charis_campaigns_scoped_read_029 ON public.campaign_drafts FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS "members read campaign revisions" ON public.campaign_revisions;
CREATE POLICY charis_campaign_revisions_scoped_read_029 ON public.campaign_revisions FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS "members read campaign runs" ON public.campaign_runs;
CREATE POLICY charis_campaign_runs_scoped_read_029 ON public.campaign_runs FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS "sms campaigns members read" ON public.charis_sms_campaigns;
CREATE POLICY charis_sms_campaigns_scoped_read_029 ON public.charis_sms_campaigns FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS "sms test history members read" ON public.charis_sms_tests;
CREATE POLICY charis_sms_tests_scoped_read_029 ON public.charis_sms_tests FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS "members read test history" ON public.email_test_attempts;
CREATE POLICY charis_email_tests_scoped_read_029 ON public.email_test_attempts FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'campaigns.view'));
DROP POLICY IF EXISTS "members read suppressions" ON public.email_suppressions;
CREATE POLICY charis_email_suppressions_scoped_read_029 ON public.email_suppressions FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'customers.manage'));
COMMIT;
