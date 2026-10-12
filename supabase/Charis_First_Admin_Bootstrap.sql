-- CHARIS | SET FIRST ADMIN ONCE, AFTER SUPABASE AUTH ACCOUNT CONFIRMATION
-- 1. First register/login with your own real email in the Charis app;
-- 2. Confirm the email; 3. Replace the value below; 4. Run in SQL Editor.
-- NEVER assign this elevated role to ordinary campaign staff.
-- Does not create any Supabase Auth account or password.

begin;
do $charis_owner$
declare
  p_verified_email text := 'REPLACE_WITH_YOUR_VERIFIED_EMAIL';
  v_user uuid;
  v_org uuid;
begin
  if p_verified_email='REPLACE_WITH_YOUR_VERIFIED_EMAIL'
     or position('@' in p_verified_email)<2 then
     raise exception 'Edit p_verified_email with the exact verified sign-in address before running';
  end if;
  select id into v_user from auth.users
   where lower(email)=lower(trim(p_verified_email))
     and email_confirmed_at is not null;
  if v_user is null then
    raise exception 'The account must exist in Supabase Authentication and have a confirmed email';
  end if;
  select id into v_org from public.organizations
   where slug='charis-mfb' and status='active';
  if v_org is null then
    raise exception 'Charis workspace not found. Run the COMPLETE fresh installer first';
  end if;
  insert into public.platform_staff (user_id,role)
    values(v_user,'super_admin')
    on conflict(user_id) do update set role='super_admin';
  insert into public.organization_members (organization_id,user_id,role)
    values(v_org,v_user,'company_admin')
    on conflict(organization_id,user_id) do update set role='company_admin';
end;
$charis_owner$;
commit;

select o.id as single_company_org_id,o.name,m.role as membership_role,
       s.role as platform_role
from public.organizations o
join public.organization_members m on m.organization_id=o.id
join public.platform_staff s on s.user_id=m.user_id
where o.slug='charis-mfb';
