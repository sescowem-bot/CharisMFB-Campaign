-- CHARIS 038: read-only post-install checks. Run in Supabase SQL Editor.
-- Object existence does NOT prove cross-account RLS correctness.
SELECT '038 staff matrix' AS check_name,
       to_regprocedure('public.charis_staff_access_matrix_save(uuid,uuid,text,text[],uuid[],jsonb)') IS NOT NULL AS installed
UNION ALL
SELECT '038 custom role matrix',
       to_regprocedure('public.charis_role_permissions_replace(uuid,uuid,text[])') IS NOT NULL
UNION ALL
SELECT '037 custom roles sync',
       to_regprocedure('public.charis_staff_roles_sync(uuid,uuid,uuid[])') IS NOT NULL;

SELECT o.slug,
       (SELECT count(*) FROM public.organization_members m WHERE m.organization_id=o.id) AS members,
       (SELECT count(*) FROM public.charis_access_roles r WHERE r.organization_id=o.id AND r.active) AS active_custom_roles,
       (SELECT count(*) FROM public.charis_staff_access_roles ar WHERE ar.organization_id=o.id) AS custom_role_assignments,
       (SELECT count(*) FROM public.charis_staff_permissions p WHERE p.organization_id=o.id) AS individual_overrides
FROM public.organizations o WHERE o.slug='charis-mfb';
