-- CHARIS 027: single-bank delegated access and administrator-managed departments.
-- Additive after 026. No default departments are inserted. Existing data is retained.
-- Do not run a fresh installer; apply only after a staging backup and review.
BEGIN;
CREATE TABLE IF NOT EXISTS public.charis_permission_catalog (
 permission_key text PRIMARY KEY CHECK(permission_key ~ '^[a-z][a-z0-9_.]{2,70}$'),
 label text NOT NULL, category text NOT NULL,
 description text NOT NULL DEFAULT ''
);
INSERT INTO public.charis_permission_catalog(permission_key,label,category,description) VALUES
 ('staff.manage','Manage staff invitations and access','Administration','Add or remove bank staff'),
 ('access.manage','Manage permission grants and roles','Administration','Delegate only permissions already held'),
 ('departments.manage','Manage bank departments','Administration','Create, rename and archive departments'),
 ('providers.manage','Manage email provider settings','Administration','Configure bank-approved sender integrations'),
 ('settings.manage','Manage communication settings','Administration','Change approved operational policies'),
 ('customers.view','View authorised customer records','Customers','Subject to the existing data access policies'),
 ('customers.manage','Manage customers and lists','Customers','Import, update and organise customer details'),
 ('campaigns.view','View communications','Communications','Subject to organisation and other access restrictions'),
 ('campaigns.create','Prepare communications','Communications','Draft, edit and submit campaigns'),
 ('campaigns.approve','Approve communications','Communications','Independent approval only; never self-approval'),
 ('campaigns.send','Dispatch approved communications','Communications','Does not enable customer delivery or bypass consent'),
 ('templates.manage','Manage designs and branding','Design','Edit email templates and approved brand assets'),
 ('reports.view','View authorised reports','Oversight','Read permitted delivery and performance reports'),
 ('audit.view','Review audit activity','Oversight','Read permitted change and delivery history'),
 ('reminders.view','View department reminders','Departments','Subject to department membership'),
 ('reminders.manage','Manage department reminders','Departments','Subject to department membership')
ON CONFLICT(permission_key) DO UPDATE SET label=excluded.label,category=excluded.category,description=excluded.description;

-- Custom role templates are editable; permissions are independently revocable per staff member.
CREATE TABLE IF NOT EXISTS public.charis_access_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 80),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=300),
 active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,name)
);
CREATE TABLE IF NOT EXISTS public.charis_role_permissions (
 organization_id uuid NOT NULL,
 role_id uuid NOT NULL,
 permission_key text NOT NULL REFERENCES public.charis_permission_catalog(permission_key),
 PRIMARY KEY(organization_id,role_id,permission_key),
 FOREIGN KEY(organization_id,role_id) REFERENCES public.charis_access_roles(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.charis_staff_access_roles (
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role_id uuid NOT NULL,
 assigned_by uuid REFERENCES auth.users(id),
 PRIMARY KEY(organization_id,user_id,role_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,role_id) REFERENCES public.charis_access_roles(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.charis_staff_permissions (
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL,
 permission_key text NOT NULL REFERENCES public.charis_permission_catalog(permission_key),
 allowed boolean NOT NULL,
 granted_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id,permission_key),
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS charis_staff_roles_role_idx ON public.charis_staff_access_roles(organization_id,role_id);

-- Keep the previously implemented additional responsibilities working.
CREATE OR REPLACE FUNCTION public.charis_base_role_permission(p_role text,p_key text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE
  WHEN p_role='company_admin' THEN true
  WHEN p_role='manager' THEN p_key=ANY(ARRAY['customers.view','customers.manage','campaigns.view','campaigns.create','campaigns.send','templates.manage','reports.view','reminders.view','reminders.manage'])
  WHEN p_role='campaign_lead' THEN p_key=ANY(ARRAY['customers.view','campaigns.view','campaigns.create','campaigns.approve','campaigns.send','templates.manage','reports.view'])
  WHEN p_role='designer' THEN p_key=ANY(ARRAY['campaigns.view','campaigns.create','templates.manage'])
  WHEN p_role='approver' THEN p_key=ANY(ARRAY['campaigns.view','campaigns.approve','reports.view'])
  WHEN p_role='analyst' THEN p_key=ANY(ARRAY['campaigns.view','reports.view'])
  WHEN p_role='viewer' THEN p_key=ANY(ARRAY['campaigns.view'])
  ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.charis_base_role_permission(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_base_role_permission(text,text) TO authenticated;

-- This evaluator intentionally does NOT call can_manage_team/can_edit_campaigns:
-- it is the root of the permission hierarchy, so no recursive checks occur.
-- The sealed platform Super Admin remains separate from delegated access.
CREATE OR REPLACE FUNCTION public.charis_has_permission(p_org uuid,p_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_member public.organization_members;v_override boolean;v_found boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.charis_permission_catalog WHERE permission_key=p_key) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active') THEN RETURN false;END IF;
 IF public.is_platform_super_admin() THEN RETURN true;END IF;
 SELECT * INTO v_member FROM public.organization_members WHERE organization_id=p_org AND user_id=(SELECT auth.uid());
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT allowed INTO v_override FROM public.charis_staff_permissions
  WHERE organization_id=p_org AND user_id=(SELECT auth.uid()) AND permission_key=p_key;
 v_found:=FOUND;
 IF v_found THEN RETURN v_override;END IF;
 IF EXISTS(SELECT 1 FROM public.charis_staff_access_roles a
  JOIN public.charis_access_roles r ON r.organization_id=a.organization_id AND r.id=a.role_id AND r.active
  JOIN public.charis_role_permissions p ON p.organization_id=r.organization_id AND p.role_id=r.id
  WHERE a.organization_id=p_org AND a.user_id=(SELECT auth.uid()) AND p.permission_key=p_key) THEN RETURN true;END IF;
 -- Keep primary and supplementary roles working unless deliberately overridden.
 RETURN public.charis_base_role_permission(v_member.role,p_key) OR EXISTS (
  SELECT 1 FROM public.charis_additional_roles a WHERE a.organization_id=p_org
  AND a.user_id=(SELECT auth.uid()) AND public.charis_base_role_permission(a.role,p_key));
END;$$;
REVOKE ALL ON FUNCTION public.charis_has_permission(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_has_permission(uuid,text) TO authenticated;

-- Navigation reads one bounded permission list, while server/database permissions remain authoritative.
CREATE OR REPLACE FUNCTION public.charis_permission_list(p_org uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(array_agg(c.permission_key ORDER BY c.permission_key),ARRAY[]::text[])
 FROM public.charis_permission_catalog c WHERE public.charis_has_permission(p_org,c.permission_key);
$$;
REVOKE ALL ON FUNCTION public.charis_permission_list(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_permission_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_staff_permission_set(p_org uuid,p_user uuid,p_key text,p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'access.manage') THEN RAISE EXCEPTION 'Permission management required';END IF;
 IF p_user=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot change your own access';END IF;
 IF NOT public.charis_has_permission(p_org,p_key) THEN RAISE EXCEPTION 'Cannot delegate a permission you do not hold';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Staff member unavailable';END IF;
 IF EXISTS(SELECT 1 FROM public.platform_staff WHERE user_id=p_user AND role='super_admin') THEN RAISE EXCEPTION 'Platform owner access is managed separately';END IF;
 INSERT INTO public.charis_staff_permissions(organization_id,user_id,permission_key,allowed,granted_by)
 VALUES(p_org,p_user,p_key,p_allowed,(SELECT auth.uid()))
 ON CONFLICT(organization_id,user_id,permission_key) DO UPDATE SET allowed=excluded.allowed,granted_by=excluded.granted_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.staff_permission_changed','staff',p_user::text,
 jsonb_build_object('permission',p_key,'allowed',p_allowed));
END;$$;
REVOKE ALL ON FUNCTION public.charis_staff_permission_set(uuid,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_permission_set(uuid,uuid,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_access_role_save(p_org uuid,p_role uuid,p_name text,p_description text,p_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.charis_has_permission(p_org,'access.manage') THEN RAISE EXCEPTION 'Permission management required';END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 80 OR length(coalesce(p_description,''))>300 THEN RAISE EXCEPTION 'Invalid role details';END IF;
 IF p_role IS NULL THEN
  INSERT INTO public.charis_access_roles(organization_id,name,description,created_by) VALUES(p_org,btrim(p_name),coalesce(p_description,''),auth.uid()) RETURNING id INTO v_id;
 ELSE
  UPDATE public.charis_access_roles SET name=btrim(p_name),description=coalesce(p_description,''),active=p_active
   WHERE id=p_role AND organization_id=p_org RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Role unavailable';END IF;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'access.role_saved','access_role',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_access_role_save(uuid,uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_access_role_save(uuid,uuid,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_role_permission_set(p_org uuid,p_role uuid,p_key text,p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'access.manage') OR NOT public.charis_has_permission(p_org,p_key) THEN RAISE EXCEPTION 'Not permitted to delegate this capability';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_access_roles WHERE organization_id=p_org AND id=p_role AND active) THEN RAISE EXCEPTION 'Role unavailable';END IF;
 IF p_allowed THEN INSERT INTO public.charis_role_permissions(organization_id,role_id,permission_key) VALUES(p_org,p_role,p_key) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.charis_role_permissions WHERE organization_id=p_org AND role_id=p_role AND permission_key=p_key;END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.role_permission_changed','access_role',p_role::text,jsonb_build_object('permission',p_key,'allowed',p_allowed));
END;$$;
REVOKE ALL ON FUNCTION public.charis_role_permission_set(uuid,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_role_permission_set(uuid,uuid,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_staff_role_set(p_org uuid,p_user uuid,p_role uuid,p_assign boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'access.manage') THEN RAISE EXCEPTION 'Permission management required';END IF;
 IF p_user=(SELECT auth.uid()) THEN RAISE EXCEPTION 'Cannot assign your own roles';END IF;
 IF EXISTS(SELECT 1 FROM public.charis_role_permissions p WHERE p.organization_id=p_org AND p.role_id=p_role
  AND NOT public.charis_has_permission(p_org,p.permission_key)) THEN RAISE EXCEPTION 'Role contains permissions you cannot delegate';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_access_roles WHERE id=p_role AND organization_id=p_org AND active) THEN RAISE EXCEPTION 'Role unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_user AND organization_id=p_org) THEN RAISE EXCEPTION 'Staff member unavailable';END IF;
 IF p_assign THEN
  INSERT INTO public.charis_staff_access_roles(organization_id,user_id,role_id,assigned_by) VALUES(p_org,p_user,p_role,auth.uid()) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM public.charis_staff_access_roles WHERE organization_id=p_org AND user_id=p_user AND role_id=p_role;END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.role_assignment','staff',p_user::text,jsonb_build_object('role_id',p_role,'assigned',p_assign));
END;$$;
REVOKE ALL ON FUNCTION public.charis_staff_role_set(uuid,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_role_set(uuid,uuid,uuid,boolean) TO authenticated;

-- Delegated staff administration cannot promote itself or grant more than the actor owns.
-- Protect the legacy primary-role and supplementary-role workflows as well as the new UI.
CREATE OR REPLACE FUNCTION public.team_member_save(p_org uuid,p_email text,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_previous text;
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' FOR UPDATE;
 IF NOT FOUND OR NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Staff management unavailable';END IF;
 IF p_email IS NULL OR length(p_email)>254 OR p_role NOT IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer','remove') THEN RAISE EXCEPTION 'Invalid member';END IF;
 SELECT id INTO v_user FROM auth.users WHERE lower(email)=lower(btrim(p_email)) AND email_confirmed_at IS NOT NULL;
 IF v_user IS NULL THEN RAISE EXCEPTION 'A verified account is required';END IF;
 IF v_user=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot change your own membership';END IF;
 SELECT role INTO v_previous FROM public.organization_members WHERE organization_id=p_org AND user_id=v_user;
 IF (p_role='company_admin' OR v_previous='company_admin') AND NOT public.is_platform_super_admin() THEN
  RAISE EXCEPTION 'Only the system owner can change administrator membership';END IF;
 IF p_role<>'remove' AND EXISTS(SELECT 1 FROM public.charis_permission_catalog c
  WHERE public.charis_base_role_permission(p_role,c.permission_key) AND NOT public.charis_has_permission(p_org,c.permission_key)) THEN
   RAISE EXCEPTION 'Cannot assign a role with capabilities you do not hold';END IF;
 IF v_previous IS NOT NULL AND EXISTS(SELECT 1 FROM public.charis_permission_catalog c
  WHERE public.charis_base_role_permission(v_previous,c.permission_key) AND NOT public.charis_has_permission(p_org,c.permission_key)) THEN
   RAISE EXCEPTION 'Cannot modify a more privileged staff member';END IF;
 IF EXISTS(SELECT 1 FROM public.charis_staff_permissions a WHERE a.organization_id=p_org AND a.user_id=v_user AND a.allowed
  AND NOT public.charis_has_permission(p_org,a.permission_key)) OR EXISTS(
  SELECT 1 FROM public.charis_staff_access_roles ar
   JOIN public.charis_access_roles r ON r.organization_id=ar.organization_id AND r.id=ar.role_id AND r.active
   JOIN public.charis_role_permissions rp ON rp.organization_id=r.organization_id AND rp.role_id=r.id
  WHERE ar.organization_id=p_org AND ar.user_id=v_user AND NOT public.charis_has_permission(p_org,rp.permission_key)) THEN
  RAISE EXCEPTION 'Cannot alter another administrator with broader privileges';END IF;
 IF v_previous='company_admin' AND p_role<>'company_admin' AND NOT EXISTS(
  SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND role='company_admin' AND user_id<>v_user) THEN
  RAISE EXCEPTION 'Keep at least one company administrator';END IF;
 IF p_role='remove' THEN DELETE FROM public.organization_members WHERE organization_id=p_org AND user_id=v_user;
 ELSE INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(p_org,v_user,p_role)
  ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role;END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'team.member_saved','membership',v_user::text,jsonb_build_object('role',p_role));
END;$$;

CREATE OR REPLACE FUNCTION public.team_invite_prepare(p_org uuid,p_email text,p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;v_user uuid;
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Staff management required';END IF;
 v_email:=lower(btrim(coalesce(p_email,'')));
 IF length(v_email) NOT BETWEEN 3 AND 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR p_role NOT IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer') THEN RAISE EXCEPTION 'Invalid invitation';END IF;
 IF p_role='company_admin' AND NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Only the system owner can invite company administrators';END IF;
 IF EXISTS(SELECT 1 FROM public.charis_permission_catalog c WHERE public.charis_base_role_permission(p_role,c.permission_key)
  AND NOT public.charis_has_permission(p_org,c.permission_key)) THEN RAISE EXCEPTION 'Cannot invite a more privileged role';END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Charis bank workspace unavailable';END IF;
 SELECT id INTO v_user FROM auth.users WHERE lower(email)=v_email AND email_confirmed_at IS NOT NULL LIMIT 1;
 IF v_user IS NOT NULL THEN
  PERFORM public.team_member_save(p_org,v_email,p_role);
  UPDATE public.team_invitations SET status='accepted',accepted_at=now()
   WHERE organization_id=p_org AND email=v_email AND status='pending';
  RETURN 'member_added';
 END IF;
 INSERT INTO public.team_invitations(organization_id,email,role,invited_by)
 VALUES(p_org,v_email,p_role,auth.uid())
 ON CONFLICT(organization_id,email) DO UPDATE SET role=excluded.role,status='pending',invited_by=excluded.invited_by,
 invited_at=now(),expires_at=now()+interval '7 days',accepted_at=NULL;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'team.invitation_prepared','invitation',v_email,jsonb_build_object('role',p_role));
 RETURN 'invitation_pending';
END;$$;

CREATE OR REPLACE FUNCTION public.charis_set_additional_roles(p_org uuid,p_user uuid,p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Staff management required';END IF;
 IF p_user=auth.uid() THEN RAISE EXCEPTION 'Cannot change your own responsibilities';END IF;
 IF p_roles IS NULL OR coalesce(array_length(p_roles,1),0)>6 OR EXISTS(
  SELECT 1 FROM unnest(p_roles) AS t(role) WHERE role NOT IN ('manager','campaign_lead','designer','approver','analyst','viewer')) THEN
  RAISE EXCEPTION 'Invalid responsibilities';END IF;
 IF (SELECT count(*) FROM unnest(p_roles))<>(SELECT count(DISTINCT x) FROM unnest(p_roles) x) THEN RAISE EXCEPTION 'Duplicate responsibilities';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_user AND organization_id=p_org) THEN RAISE EXCEPTION 'Staff member unavailable';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_roles) a(role) CROSS JOIN public.charis_permission_catalog c
  WHERE public.charis_base_role_permission(a.role,c.permission_key) AND NOT public.charis_has_permission(p_org,c.permission_key)) THEN
  RAISE EXCEPTION 'Cannot grant responsibilities you do not hold';END IF;
 DELETE FROM public.charis_additional_roles WHERE organization_id=p_org AND user_id=p_user;
 FOREACH v_role IN ARRAY p_roles LOOP
  INSERT INTO public.charis_additional_roles(organization_id,user_id,role,assigned_by)
  VALUES(p_org,p_user,v_role,auth.uid());
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'staff.additional_roles_updated','staff',p_user::text,jsonb_build_object('roles',to_jsonb(p_roles)));
END;$$;

-- Staff lookup is scoped to verified organisation members; it never enumerates bank customers.
CREATE OR REPLACE FUNCTION public.charis_access_staff_list(p_org uuid)
RETURNS TABLE(id uuid,email text,base_role text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT (public.charis_has_permission(p_org,'access.manage') OR public.charis_has_permission(p_org,'departments.manage')) THEN
  RAISE EXCEPTION 'Staff directory access required';END IF;
 RETURN QUERY SELECT m.user_id,u.email::text,m.role::text
 FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id
 WHERE m.organization_id=p_org AND u.email_confirmed_at IS NOT NULL ORDER BY u.email LIMIT 500;
END;$$;
REVOKE ALL ON FUNCTION public.charis_access_staff_list(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_access_staff_list(uuid) TO authenticated;

-- Overlay new permissions onto existing security-definer workflows; independent approval
-- and row policies in the original transition functions remain in force.
CREATE OR REPLACE FUNCTION public.can_manage_team(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'staff.manage');$$;
CREATE OR REPLACE FUNCTION public.can_manage_senders(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'providers.manage');$$;
CREATE OR REPLACE FUNCTION public.can_edit_campaigns(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'campaigns.create');$$;
CREATE OR REPLACE FUNCTION public.can_approve_campaigns(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'campaigns.approve');$$;
CREATE OR REPLACE FUNCTION public.can_dispatch_campaigns(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'campaigns.send');$$;
CREATE OR REPLACE FUNCTION public.can_manage_contacts(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'customers.manage');$$;
CREATE OR REPLACE FUNCTION public.can_edit_company_design(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_permission(p_org,'templates.manage');$$;

-- New department records are created solely by authorised staff through the UI.
-- Do not seed additional departments and do not delete previously assigned records.
CREATE OR REPLACE FUNCTION public.charis_department_save(p_org uuid,p_dept uuid,p_name text,p_description text,p_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_slug text;
BEGIN
 IF NOT public.charis_has_permission(p_org,'departments.manage') THEN RAISE EXCEPTION 'Department management required';END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 100 OR length(coalesce(p_description,''))>500 THEN RAISE EXCEPTION 'Check department name or description';END IF;
 IF p_dept IS NULL THEN
  v_slug:=left(regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','_','g'),35)||'_'||substr(gen_random_uuid()::text,1,8);
  IF v_slug !~ '^[a-z]' THEN v_slug:='d_'||v_slug;END IF;
  INSERT INTO public.charis_departments(organization_id,slug,name,description) VALUES(p_org,v_slug,btrim(p_name),coalesce(p_description,'')) RETURNING id INTO v_id;
 ELSE
  SELECT id INTO v_id FROM public.charis_departments WHERE id=p_dept AND organization_id=p_org FOR UPDATE;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Department unavailable';END IF;
  IF NOT p_active AND EXISTS(SELECT 1 FROM public.charis_reminders WHERE organization_id=p_org AND department_id=p_dept AND status='open') THEN
   RAISE EXCEPTION 'Close or move open reminders before archiving this department';END IF;
  UPDATE public.charis_departments SET name=btrim(p_name),description=coalesce(p_description,''),active=p_active WHERE id=v_id;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'department.saved','department',v_id::text,jsonb_build_object('active',p_active));
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_department_save(uuid,uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_department_save(uuid,uuid,text,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.charis_department_assign(p_org uuid,p_dept uuid,p_user uuid,p_role text,p_remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_has_permission(p_org,'departments.manage') THEN RAISE EXCEPTION 'Department management required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_departments WHERE organization_id=p_org AND id=p_dept AND active) THEN RAISE EXCEPTION 'Department unavailable';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user) THEN RAISE EXCEPTION 'Invite the staff member first';END IF;
 IF p_role NOT IN ('head','member','observer') THEN RAISE EXCEPTION 'Invalid responsibility';END IF;
 IF p_remove THEN DELETE FROM public.charis_department_members WHERE organization_id=p_org AND department_id=p_dept AND user_id=p_user;
 ELSE INSERT INTO public.charis_department_members(organization_id,department_id,user_id,department_role,assigned_by)
 VALUES(p_org,p_dept,p_user,p_role,auth.uid())
 ON CONFLICT(organization_id,department_id,user_id) DO UPDATE SET department_role=excluded.department_role,assigned_by=excluded.assigned_by,assigned_at=now();END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'department.membership_changed','department',p_dept::text,jsonb_build_object('user_id',p_user,'removed',p_remove,'responsibility',p_role));
END;$$;

ALTER TABLE public.charis_access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_staff_access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_permission_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_access_roles,public.charis_role_permissions,public.charis_staff_access_roles,public.charis_staff_permissions,public.charis_permission_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_access_roles,public.charis_role_permissions,public.charis_staff_access_roles,public.charis_staff_permissions,public.charis_permission_catalog TO authenticated;
DROP POLICY IF EXISTS charis_permission_catalog_read ON public.charis_permission_catalog;
CREATE POLICY charis_permission_catalog_read ON public.charis_permission_catalog FOR SELECT TO authenticated USING((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS charis_roles_read ON public.charis_access_roles;
CREATE POLICY charis_roles_read ON public.charis_access_roles FOR SELECT TO authenticated USING(public.charis_has_permission(organization_id,'access.manage'));
DROP POLICY IF EXISTS charis_role_permissions_read ON public.charis_role_permissions;
CREATE POLICY charis_role_permissions_read ON public.charis_role_permissions FOR SELECT TO authenticated USING(public.charis_has_permission(organization_id,'access.manage'));
DROP POLICY IF EXISTS charis_staff_roles_read ON public.charis_staff_access_roles;
CREATE POLICY charis_staff_roles_read ON public.charis_staff_access_roles FOR SELECT TO authenticated USING(public.charis_has_permission(organization_id,'access.manage') OR user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS charis_staff_permissions_read ON public.charis_staff_permissions;
CREATE POLICY charis_staff_permissions_read ON public.charis_staff_permissions FOR SELECT TO authenticated USING(public.charis_has_permission(organization_id,'access.manage') OR user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS charis_depts_read ON public.charis_departments;
CREATE POLICY charis_depts_read ON public.charis_departments FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'departments.manage') OR public.charis_department_access(organization_id,id));
DROP POLICY IF EXISTS charis_dept_members_read ON public.charis_department_members;
CREATE POLICY charis_dept_members_read ON public.charis_department_members FOR SELECT TO authenticated
 USING(public.charis_has_permission(organization_id,'departments.manage') OR user_id=(SELECT auth.uid()));
-- Delegated auditors may read only bank-scoped audit records, never global platform events.
DROP POLICY IF EXISTS charis_delegated_audit_read ON public.audit_logs;
CREATE POLICY charis_delegated_audit_read ON public.audit_logs FOR SELECT TO authenticated
 USING(organization_id IS NOT NULL AND public.charis_has_permission(organization_id,'audit.view'));
COMMIT;
