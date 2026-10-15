-- CHARIS 038: atomic, audited bank staff access editor.
-- Prerequisite: 037_charis_multi_custom_role_assignment.sql.
-- Additive: leaves every staff member's current roles and permissions unchanged until
-- an authorised administrator explicitly saves changes in the Administration UI.
BEGIN;

-- Replace all capabilities of ONE custom role atomically.
CREATE OR REPLACE FUNCTION public.charis_role_permissions_replace(
 p_org uuid, p_role uuid, p_keys text[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_keys text[]:=coalesce(p_keys,ARRAY[]::text[]);
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.charis_has_permission(p_org,'access.manage') THEN
  RAISE EXCEPTION 'Role management permission required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active') THEN
  RAISE EXCEPTION 'Bank workspace unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.charis_access_roles WHERE id=p_role AND organization_id=p_org AND active) THEN
  RAISE EXCEPTION 'Select an active role'; END IF;
 IF cardinality(v_keys)>150 OR cardinality(v_keys)<>(SELECT count(DISTINCT k) FROM unnest(v_keys) k)
 OR array_position(v_keys,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid permission selection'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(v_keys) k LEFT JOIN public.charis_permission_catalog c ON c.permission_key=k WHERE c.permission_key IS NULL) THEN
  RAISE EXCEPTION 'Unknown permission'; END IF;
 -- No delegated admin can remove privileges it does not hold from a protected role.
 IF EXISTS(SELECT 1 FROM public.charis_role_permissions p WHERE p.organization_id=p_org AND p.role_id=p_role
  AND NOT public.charis_has_permission(p_org,p.permission_key)) THEN
  RAISE EXCEPTION 'This role has capabilities outside your delegation'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(v_keys) k WHERE NOT public.charis_has_permission(p_org,k)) THEN
  RAISE EXCEPTION 'Cannot grant an action you do not hold'; END IF;
 -- Serialize updates to this role to avoid concurrent lost changes.
 PERFORM 1 FROM public.charis_access_roles WHERE id=p_role AND organization_id=p_org FOR UPDATE;
 DELETE FROM public.charis_role_permissions WHERE organization_id=p_org AND role_id=p_role
  AND NOT (permission_key=ANY(v_keys));
 INSERT INTO public.charis_role_permissions(organization_id,role_id,permission_key)
 SELECT p_org,p_role,k FROM unnest(v_keys) k ON CONFLICT DO NOTHING;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.role_matrix_saved','access_role',p_role::text,
 jsonb_build_object('permissions',to_jsonb(v_keys),'count',cardinality(v_keys)));
END;$$;
REVOKE ALL ON FUNCTION public.charis_role_permissions_replace(uuid,uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_role_permissions_replace(uuid,uuid,text[]) TO authenticated;

-- A single commit updates the primary role, additional built-in roles, custom role
-- assignments, and explicit action overrides together (or NONE on any failure).
CREATE OR REPLACE FUNCTION public.charis_staff_access_matrix_save(
 p_org uuid,p_user uuid,p_primary text,p_additional text[],p_custom uuid[],p_overrides jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_email text;
 v_current text;
 v_extra text[]:=coalesce(p_additional,ARRAY[]::text[]);
 v_custom uuid[]:=coalesce(p_custom,ARRAY[]::uuid[]);
 v_changes jsonb:=coalesce(p_overrides,'{}'::jsonb);
 v_key text;v_value text;v_previous text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.charis_has_permission(p_org,'access.manage')
  OR NOT public.charis_has_permission(p_org,'staff.manage') THEN
  RAISE EXCEPTION 'Staff and access management permissions required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND slug='charis-mfb' AND status='active') THEN
  RAISE EXCEPTION 'Bank workspace unavailable'; END IF;
 IF p_user=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot change your own access'; END IF;
 IF EXISTS(SELECT 1 FROM public.platform_staff WHERE user_id=p_user AND role='super_admin') THEN
  RAISE EXCEPTION 'System owner access cannot be edited here'; END IF;
 SELECT u.email::text,m.role INTO v_email,v_current
 FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id
 WHERE m.organization_id=p_org AND m.user_id=p_user AND u.email_confirmed_at IS NOT NULL FOR UPDATE OF m;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Verified staff member unavailable'; END IF;
 IF p_primary IS NULL OR p_primary NOT IN ('company_admin','manager','campaign_lead','designer','approver','analyst','viewer') THEN
  RAISE EXCEPTION 'Invalid primary role'; END IF;
 IF cardinality(v_extra)>6 OR cardinality(v_extra)<>(SELECT count(DISTINCT x) FROM unnest(v_extra) x)
  OR array_position(v_extra,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid additional roles'; END IF;
 IF cardinality(v_custom)>30 OR cardinality(v_custom)<>(SELECT count(DISTINCT x) FROM unnest(v_custom) x)
  OR array_position(v_custom,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid custom roles'; END IF;
 IF jsonb_typeof(v_changes)<>'object' THEN
  RAISE EXCEPTION 'Invalid permission overrides'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(v_changes))>150 THEN
  RAISE EXCEPTION 'Invalid permission overrides'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(v_changes) v(k,val)
  LEFT JOIN public.charis_permission_catalog c ON c.permission_key=v.k
  WHERE c.permission_key IS NULL OR v.val NOT IN ('inherit','allow','deny')) THEN
  RAISE EXCEPTION 'Invalid action override'; END IF;

 -- Existing protected RPCs enforce delegation constraints, including protection
 -- against modifying higher-privileged staff and granting unheld capabilities.
 PERFORM public.charis_staff_roles_sync(p_org,p_user,v_custom);
 PERFORM public.charis_set_additional_roles(p_org,p_user,v_extra);
 IF p_primary<>v_current THEN PERFORM public.team_member_save(p_org,v_email,p_primary); END IF;

 FOR v_key,v_value IN SELECT k,val FROM jsonb_each_text(v_changes) v(k,val) LOOP
  SELECT CASE WHEN allowed THEN 'allow' ELSE 'deny' END INTO v_previous
    FROM public.charis_staff_permissions WHERE organization_id=p_org AND user_id=p_user AND permission_key=v_key;
  v_previous:=coalesce(v_previous,'inherit');
  IF v_value=v_previous THEN CONTINUE; END IF;
  IF NOT public.charis_has_permission(p_org,v_key) THEN
   RAISE EXCEPTION 'Cannot change an action outside your delegation: %',v_key;
  END IF;
  IF v_value='inherit' THEN
   DELETE FROM public.charis_staff_permissions
   WHERE organization_id=p_org AND user_id=p_user AND permission_key=v_key;
  ELSE
   PERFORM public.charis_staff_permission_set(p_org,p_user,v_key,v_value='allow');
  END IF;
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'access.staff_matrix_saved','staff',p_user::text,
 jsonb_build_object('primary_role',p_primary,'additional_roles',to_jsonb(v_extra),'custom_role_ids',to_jsonb(v_custom)));
END;$$;
REVOKE ALL ON FUNCTION public.charis_staff_access_matrix_save(uuid,uuid,text,text[],uuid[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_access_matrix_save(uuid,uuid,text,text[],uuid[],jsonb) TO authenticated;
COMMIT;
