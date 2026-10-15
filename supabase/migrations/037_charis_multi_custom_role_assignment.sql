-- CHARIS 037: atomic, bank-scoped, multiple custom-role assignment.
-- Apply only after the prior bank migrations are verified. No existing roles are deleted by installation.
BEGIN;
CREATE OR REPLACE FUNCTION public.charis_staff_roles_sync(
 p_org uuid, p_user uuid, p_roles uuid[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_roles uuid[] := coalesce(p_roles, ARRAY[]::uuid[]);
 v_member public.organization_members;
BEGIN
 IF NOT public.charis_has_permission(p_org,'access.manage') THEN
  RAISE EXCEPTION 'Permission management required';
 END IF;
 IF (SELECT auth.uid()) IS NULL OR p_user=(SELECT auth.uid()) THEN
  RAISE EXCEPTION 'You cannot change your own roles';
 END IF;
 IF cardinality(v_roles)>30 THEN
  RAISE EXCEPTION 'Too many custom roles selected';
 END IF;
 IF cardinality(v_roles)<>(SELECT count(DISTINCT id) FROM unnest(v_roles) AS ids(id)) THEN
  RAISE EXCEPTION 'Duplicate custom roles were submitted';
 END IF;
 IF array_position(v_roles,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Invalid custom role selection';
 END IF;
 SELECT * INTO v_member FROM public.organization_members
  WHERE organization_id=p_org AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Staff member unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_staff WHERE user_id=p_user AND role='super_admin') THEN
  RAISE EXCEPTION 'System owner access is managed separately';
 END IF;
 IF v_member.role='company_admin' AND NOT public.is_platform_super_admin() THEN
  RAISE EXCEPTION 'Only the system owner may edit an administrator’s roles';
 END IF;
 -- Check that every incoming role belongs to this bank and remains active.
 IF EXISTS(
  SELECT 1 FROM unnest(v_roles) AS ids(id)
  LEFT JOIN public.charis_access_roles r ON r.organization_id=p_org AND r.id=ids.id AND r.active
  WHERE r.id IS NULL
 ) THEN RAISE EXCEPTION 'One or more custom roles are unavailable'; END IF;
 -- Prevent delegated administrators from editing a colleague who already holds
 -- any capability they do not themselves hold (base, custom, or direct grants).
 IF EXISTS(
   SELECT 1 FROM public.charis_permission_catalog c
   WHERE public.charis_base_role_permission(v_member.role,c.permission_key)
   AND NOT public.charis_has_permission(p_org,c.permission_key)
 ) OR EXISTS(
   SELECT 1 FROM public.charis_staff_permissions gp
   WHERE gp.organization_id=p_org AND gp.user_id=p_user AND gp.allowed
   AND NOT public.charis_has_permission(p_org,gp.permission_key)
 ) OR EXISTS(
   SELECT 1 FROM public.charis_staff_access_roles a
   JOIN public.charis_role_permissions g ON g.organization_id=a.organization_id AND g.role_id=a.role_id
   WHERE a.organization_id=p_org AND a.user_id=p_user
   AND NOT public.charis_has_permission(p_org,g.permission_key)
 ) OR EXISTS(
   SELECT 1 FROM public.charis_additional_roles a
   CROSS JOIN public.charis_permission_catalog c
   WHERE a.organization_id=p_org AND a.user_id=p_user
   AND public.charis_base_role_permission(a.role,c.permission_key)
   AND NOT public.charis_has_permission(p_org,c.permission_key)
 ) THEN RAISE EXCEPTION 'This staff member has permissions you cannot manage'; END IF;
 -- Never grant a custom role containing a capability that the grantor lacks.
 IF EXISTS(
  SELECT 1 FROM unnest(v_roles) AS ids(id)
  JOIN public.charis_role_permissions g ON g.organization_id=p_org AND g.role_id=ids.id
  WHERE NOT public.charis_has_permission(p_org,g.permission_key)
 ) THEN RAISE EXCEPTION 'One or more selected roles include permissions you cannot delegate'; END IF;

 DELETE FROM public.charis_staff_access_roles
 WHERE organization_id=p_org AND user_id=p_user AND NOT (role_id=ANY(v_roles));

 INSERT INTO public.charis_staff_access_roles(organization_id,user_id,role_id,assigned_by)
 SELECT p_org,p_user,ids.id,(SELECT auth.uid())
 FROM unnest(v_roles) AS ids(id)
 ON CONFLICT(organization_id,user_id,role_id) DO NOTHING;

 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.staff_custom_roles_synced','staff',p_user::text,
 jsonb_build_object('role_ids',to_jsonb(v_roles),'count',cardinality(v_roles)));
END;
$$;
REVOKE ALL ON FUNCTION public.charis_staff_roles_sync(uuid,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_roles_sync(uuid,uuid,uuid[]) TO authenticated;
COMMIT;
