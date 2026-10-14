-- CHARIS ACCESS DIAGNOSTIC: read-only; safe to run in the correct Supabase SQL Editor.
-- This reports stored roles/status, NOT the value of auth.uid() in a user's browser session.
select
 u.email,
 u.email_confirmed_at is not null as verified_email,
 o.id as charis_org_uuid,
 o.name as workspace_name,
 o.status as workspace_status,
 coalesce(m.role,'NO COMPANY ROLE') as company_role,
 coalesce(p.role,'NO PLATFORM ROLE') as platform_role,
 case when o.status<>'active' then 'Activate workspace first'
      when p.role='super_admin' or m.role in ('company_admin','manager','designer') then 'Stored role SHOULD permit campaign editing. Check browser login, can_edit_campaigns RPC and latest migrations.'
      else 'Assign company_admin, manager or designer to edit campaigns' end as next_check
from auth.users u
cross join (select id,name,status from public.organizations where slug='charis-mfb') o
left join public.organization_members m on m.organization_id=o.id and m.user_id=u.id
left join public.platform_staff p on p.user_id=u.id
where lower(u.email)='sescowemp@gmail.com';

select p.proname as required_rpc,
       case when p.oid is null then 'MISSING' else 'PRESENT' end as status
from (values ('can_edit_campaigns'),('can_approve_campaigns'),('charis_campaign_test_reserve'),
('charis_contact_archive'),('charis_contact_delete')) v(name)
left join pg_proc p on p.proname=v.name and p.pronamespace='public'::regnamespace;
