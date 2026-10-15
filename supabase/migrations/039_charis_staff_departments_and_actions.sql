-- Charis 039: one bank-authorised save for roles, action permissions and departments.
-- Requires 026, 027, 037, 038. Non-destructive and does not seed departments.
-- Apply to a reviewed backup/staging database before production.
BEGIN;

CREATE OR REPLACE FUNCTION public.charis_staff_profile_save(
 p_org uuid,
 p_user uuid,
 p_primary text,
 p_additional text[],
 p_custom uuid[],
 p_overrides jsonb,
 p_departments jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_dept_id_text text;
 v_role text;
 v_id uuid;
BEGIN
 -- A delegated administrator may not edit a Company Administrator's access,
 -- even when their primary role is left unchanged.
 IF NOT public.is_platform_super_admin() AND EXISTS (
  SELECT 1 FROM public.organization_members m
  WHERE m.organization_id=p_org AND m.user_id=p_user AND m.role='company_admin'
 ) THEN
  RAISE EXCEPTION 'Only the system owner can edit a bank administrator';
 END IF;

 -- NULL = department editor unavailable to this administrator: never replace or
 -- delete any existing department memberships in that case.
 IF p_departments IS NOT NULL THEN
  IF (SELECT auth.uid()) IS NULL OR NOT public.charis_has_permission(p_org, 'departments.manage')
     OR NOT public.charis_has_permission(p_org, 'staff.manage')
     OR NOT public.charis_has_permission(p_org, 'access.manage') THEN
   RAISE EXCEPTION 'Department and staff access management required';
  END IF;
  IF jsonb_typeof(p_departments) <> 'object' OR
     (SELECT count(*) FROM jsonb_object_keys(p_departments)) > 200 THEN
   RAISE EXCEPTION 'Invalid department selection';
  END IF;
  -- Check keys BEFORE any UUID conversion, preventing unexpected parse errors.
  IF EXISTS (
   SELECT 1 FROM jsonb_each_text(p_departments) v(dept_id, department_role)
   WHERE v.dept_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR v.department_role NOT IN ('none','member','head','observer')
      OR v.department_role IS NULL
  ) THEN
   RAISE EXCEPTION 'Invalid department or responsibility';
  END IF;
  IF EXISTS (
   SELECT 1 FROM jsonb_each_text(p_departments) v(dept_id, department_role)
   LEFT JOIN public.charis_departments d
     ON d.organization_id=p_org AND d.id=v.dept_id::uuid AND d.active
   WHERE d.id IS NULL
  ) THEN
   RAISE EXCEPTION 'A selected department is unavailable or archived';
  END IF;
 END IF;

 -- This routine already protects platform owners, privileged administrators,
 -- self-editing and delegated permissions; reuse it rather than duplicating its
 -- security boundary. Any subsequent error rolls back the WHOLE statement.
 PERFORM public.charis_staff_access_matrix_save(
   p_org,p_user,p_primary,p_additional,p_custom,p_overrides
 );

 IF p_departments IS NOT NULL THEN
  -- Update only the explicit, active department IDs in the submitted editor.
  -- Do not touch hidden or archived department memberships.
  FOR v_dept_id_text,v_role IN
   SELECT v.dept_id, v.department_role
   FROM jsonb_each_text(p_departments) v(dept_id,department_role)
  LOOP
   v_id:=v_dept_id_text::uuid;
   IF v_role='none' THEN
    DELETE FROM public.charis_department_members
    WHERE organization_id=p_org AND user_id=p_user AND department_id=v_id;
   ELSE
    INSERT INTO public.charis_department_members(
      organization_id,department_id,user_id,department_role,assigned_by
    ) VALUES (p_org,v_id,p_user,v_role,(SELECT auth.uid()))
    ON CONFLICT(organization_id,department_id,user_id) DO UPDATE
     SET department_role=excluded.department_role,
         assigned_by=excluded.assigned_by,
         assigned_at=now();
   END IF;
  END LOOP;
  INSERT INTO public.audit_logs(
   organization_id,actor_id,action,entity_type,entity_id,details
  ) VALUES (
   p_org,(SELECT auth.uid()),'access.staff_departments_saved','staff',p_user::text,
   jsonb_build_object('department_assignments',p_departments)
  );
 END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.charis_staff_profile_save(uuid,uuid,text,text[],uuid[],jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_staff_profile_save(uuid,uuid,text,text[],uuid[],jsonb,jsonb) TO authenticated;

COMMIT;

-- Prompt PostgREST to refresh the new RPC signature.
NOTIFY pgrst, 'reload schema';
