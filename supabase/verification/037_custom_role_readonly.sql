-- Charis 037 role setup verification. Read-only; safe to run in SQL Editor.
SELECT o.slug,r.name,r.active,coalesce(count(a.user_id),0) AS assignments
FROM public.organizations o
LEFT JOIN public.charis_access_roles r ON r.organization_id=o.id
LEFT JOIN public.charis_staff_access_roles a ON a.organization_id=o.id AND a.role_id=r.id
WHERE o.slug='charis-mfb'
GROUP BY o.slug,r.name,r.active
ORDER BY r.name NULLS FIRST;

SELECT p.proname AS rpc_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='charis_staff_roles_sync';
