-- CHARIS READ-ONLY VERIFICATION
-- Run after first install. All key functions should exist and Charis should have an active internal entitlement.
select
  (select count(*) from public.organizations where slug='charis-mfb' and status='active') as active_charis_workspaces,
  (select count(*) from public.organization_subscriptions s join public.organizations o on o.id=s.organization_id where o.slug='charis-mfb' and s.status='active') as active_charis_allowances,
  to_regprocedure('public.charis_recipient_search(uuid,text,integer)') is not null as individual_recipient_search_ready,
  to_regprocedure('public.charis_campaign_save_selected(uuid,uuid,integer,text,text,text,jsonb,uuid,timestamptz,uuid[])') is not null as selected_recipients_save_ready,
  to_regprocedure('public.charis_import_batch_to_list(uuid,uuid,jsonb,uuid)') is not null as import_groups_ready;

select id as single_company_org_id,name,status from public.organizations where slug='charis-mfb';
