-- Charis 039: read-only verification. No customer records or secrets.
SELECT
 to_regprocedure('public.charis_staff_profile_save(uuid,uuid,text,text[],uuid[],jsonb,jsonb)') IS NOT NULL AS profile_save_installed,
 to_regprocedure('public.charis_staff_access_matrix_save(uuid,uuid,text,text[],uuid[],jsonb)') IS NOT NULL AS access_matrix_installed,
 to_regprocedure('public.charis_department_assign(uuid,uuid,uuid,text,boolean)') IS NOT NULL AS department_assign_installed,
 to_regclass('public.charis_department_members') IS NOT NULL AS department_members_table,
 to_regclass('public.charis_staff_permissions') IS NOT NULL AS staff_permissions_table;
-- Confirm customer delivery gates remain OFF in Vercel separately.
