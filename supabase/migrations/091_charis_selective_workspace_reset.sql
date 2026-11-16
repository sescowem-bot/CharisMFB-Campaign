-- 091: Selective, organisation-scoped Charis workspace cleanup.
-- The previous all-at-once reset is intentionally not used by the UI.
-- This migration adds an allowlisted preview + selected-category deletion RPC.
-- It never deletes users, staff, memberships, provider credentials, routing,
-- branding, core settings, permissions, or audit history.

begin;

create or replace function public.charis_reset_selective_is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.platform_staff ps
    where ps.user_id=auth.uid() and ps.role='super_admin'
  );
$$;
revoke all on function public.charis_reset_selective_is_admin() from public,anon,authenticated;

create or replace function public.charis_reset_selective_count(p_table text,p_org uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_count bigint;
begin
  if p_table not in (
    'campaign_drafts','campaign_revisions','campaign_runs','email_deliveries','charis_resend_broadcast_jobs',
    'contacts','contact_lists','contact_list_members','contact_segments','contact_import_batches',
    'contact_import_issues','charis_import_consent_records','email_suppressions','charis_optional_email_optouts',
    'charis_email_preference_tokens','charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
    'charis_direct_messages','charis_direct_recipients','charis_sms_campaigns','charis_sms_tests',
    'email_test_attempts','charis_zoho_broadcasts','charis_zoho_email_events','charis_zoho_email_suppressions',
    'charis_zoho_contact_lists','charis_zoho_contact_sync_runs','charis_zoho_contact_memberships',
    'charis_zoho_consent_attestations','charis_zoho_manual_letters','charis_zeptomail_notices'
  ) then raise exception 'Reset count table is not allowlisted'; end if;
  if to_regclass(format('public.%I',p_table)) is null then return 0; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='organization_id') then return 0; end if;
  execute format('select count(*) from public.%I where organization_id=$1',p_table) into v_count using p_org;
  return coalesce(v_count,0);
end;
$$;
revoke all on function public.charis_reset_selective_count(text,uuid) from public,anon,authenticated;

create or replace function public.charis_reset_selective_delete(p_table text,p_org uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_count bigint;
begin
  if p_table not in (
    'campaign_drafts','campaign_revisions','campaign_runs','email_deliveries','charis_resend_broadcast_jobs',
    'contacts','contact_lists','contact_list_members','contact_segments','contact_import_batches',
    'contact_import_issues','charis_import_consent_records','email_suppressions','charis_optional_email_optouts',
    'charis_email_preference_tokens','charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
    'charis_direct_messages','charis_direct_recipients','charis_sms_campaigns','charis_sms_tests',
    'email_test_attempts','charis_zoho_broadcasts','charis_zoho_email_events','charis_zoho_email_suppressions',
    'charis_zoho_contact_lists','charis_zoho_contact_sync_runs','charis_zoho_contact_memberships',
    'charis_zoho_consent_attestations','charis_zoho_manual_letters','charis_zeptomail_notices'
  ) then raise exception 'Reset delete table is not allowlisted'; end if;
  if to_regclass(format('public.%I',p_table)) is null then return 0; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='organization_id') then return 0; end if;
  execute format('delete from public.%I where organization_id=$1',p_table) using p_org;
  get diagnostics v_count=row_count;
  return coalesce(v_count,0);
end;
$$;
revoke all on function public.charis_reset_selective_delete(text,uuid) from public,anon,authenticated;

create or replace function public.charis_reset_workspace_selective_preview(p_org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_campaign bigint:=0; v_contacts bigint:=0; v_imports bigint:=0;
  v_direct bigint:=0; v_integrations bigint:=0; v_tests bigint:=0;
  v_delivery_events bigint:=0; v_quota bigint:=0; v_direct_events bigint:=0;
  v_categories jsonb;
begin
  if not public.charis_reset_selective_is_admin() then raise exception 'Only a platform Super Admin can preview workspace cleanup'; end if;
  if p_org is null or not exists(select 1 from public.organizations where id=p_org) then raise exception 'Workspace not found'; end if;

  v_campaign := public.charis_reset_selective_count('campaign_drafts',p_org)
    + public.charis_reset_selective_count('campaign_revisions',p_org)
    + public.charis_reset_selective_count('campaign_runs',p_org)
    + public.charis_reset_selective_count('email_deliveries',p_org)
    + public.charis_reset_selective_count('charis_resend_broadcast_jobs',p_org);
  if to_regclass('public.email_delivery_events') is not null and to_regclass('public.email_deliveries') is not null then
    select count(*) into v_delivery_events from public.email_delivery_events e
    join public.email_deliveries d on d.id=e.delivery_id where d.organization_id=p_org;
  end if;
  if to_regclass('public.delivery_quota_reservations') is not null then
    select count(*) into v_quota from public.delivery_quota_reservations where organization_id=p_org;
  end if;
  v_campaign:=v_campaign+v_delivery_events+v_quota;

  v_contacts := public.charis_reset_selective_count('contacts',p_org)
    + public.charis_reset_selective_count('contact_lists',p_org)
    + public.charis_reset_selective_count('contact_list_members',p_org)
    + public.charis_reset_selective_count('contact_segments',p_org)
    + public.charis_reset_selective_count('email_suppressions',p_org)
    + public.charis_reset_selective_count('charis_optional_email_optouts',p_org)
    + public.charis_reset_selective_count('charis_email_preference_tokens',p_org)
    + public.charis_reset_selective_count('charis_subscription_events',p_org)
    + public.charis_reset_selective_count('charis_resubscribe_requests',p_org)
    + public.charis_reset_selective_count('charis_subscription_sync',p_org);

  v_imports := public.charis_reset_selective_count('contact_import_batches',p_org)
    + public.charis_reset_selective_count('contact_import_issues',p_org)
    + public.charis_reset_selective_count('charis_import_consent_records',p_org);

  v_direct := public.charis_reset_selective_count('charis_direct_messages',p_org)
    + public.charis_reset_selective_count('charis_direct_recipients',p_org)
    + public.charis_reset_selective_count('charis_sms_campaigns',p_org)
    + public.charis_reset_selective_count('charis_sms_tests',p_org);
  if to_regclass('public.charis_direct_delivery_events_060') is not null
     and to_regclass('public.charis_direct_recipients') is not null then
    select count(*) into v_direct_events from public.charis_direct_delivery_events_060 e
    join public.charis_direct_recipients r on r.id=e.recipient_id where r.organization_id=p_org;
  end if;
  v_direct:=v_direct+v_direct_events;

  v_integrations := public.charis_reset_selective_count('charis_zoho_broadcasts',p_org)
    + public.charis_reset_selective_count('charis_zoho_email_events',p_org)
    + public.charis_reset_selective_count('charis_zoho_email_suppressions',p_org)
    + public.charis_reset_selective_count('charis_zoho_contact_lists',p_org)
    + public.charis_reset_selective_count('charis_zoho_contact_sync_runs',p_org)
    + public.charis_reset_selective_count('charis_zoho_contact_memberships',p_org)
    + public.charis_reset_selective_count('charis_zoho_consent_attestations',p_org)
    + public.charis_reset_selective_count('charis_zoho_manual_letters',p_org)
    + public.charis_reset_selective_count('charis_zeptomail_notices',p_org);

  v_tests:=public.charis_reset_selective_count('email_test_attempts',p_org);

  v_categories:=jsonb_build_array(
    jsonb_build_object('key','campaigns','label','Campaigns and delivery history','description','Campaign drafts, revisions, runs, recipient deliveries, provider events and quota reservations.','count',v_campaign),
    jsonb_build_object('key','contacts','label','Contacts and audience lists','description','Contacts, lists, memberships, segments, suppressions and customer email preference records.','count',v_contacts),
    jsonb_build_object('key','imports','label','Contact imports and import evidence','description','Import batches, import issues and consent evidence created by contact imports.','count',v_imports),
    jsonb_build_object('key','direct','label','Direct messages and SMS tests','description','Direct communication messages, recipients, delivery events, SMS campaigns and SMS test records.','count',v_direct),
    jsonb_build_object('key','integrations','label','Zoho and ZeptoMail test/history records','description','Legacy Zoho lists, syncs, broadcasts, events and ZeptoMail notice history. Provider credentials remain.','count',v_integrations),
    jsonb_build_object('key','email_tests','label','Email test attempts','description','Individual sender test attempts only. Sender identities, domains and provider routes are retained.','count',v_tests)
  );
  return jsonb_build_object('organization_id',p_org,'categories',v_categories,
    'preserved',jsonb_build_array(
      'Login accounts and authentication','Organisation and staff memberships','Platform staff and roles',
      'Provider API credentials and provider settings','Sender identities, sending domains and routing selections',
      'Branding, core communication settings and permissions','Audit history'
    ));
end;
$$;
revoke all on function public.charis_reset_workspace_selective_preview(uuid) from public,anon;
grant execute on function public.charis_reset_workspace_selective_preview(uuid) to authenticated;

create or replace function public.charis_reset_workspace_selected(p_org uuid,p_categories text[],p_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_key text; v_table text; v_deleted jsonb:='{}'::jsonb; v_count bigint; v_total bigint:=0;
  v_allowed text[]:=array['campaigns','contacts','imports','direct','integrations','email_tests'];
  v_selected text[];
  v_preview jsonb;
begin
  if not public.charis_reset_selective_is_admin() then raise exception 'Only a platform Super Admin can delete workspace data'; end if;
  if p_confirmation is distinct from 'DELETE SELECTED CHARIS DATA' then raise exception 'Confirmation phrase does not match'; end if;
  if p_org is null or not exists(select 1 from public.organizations where id=p_org) then raise exception 'Workspace not found'; end if;
  if coalesce(array_length(p_categories,1),0)=0 then raise exception 'Select at least one data group'; end if;
  select array_agg(distinct x) into v_selected from unnest(p_categories) x;
  if exists(select 1 from unnest(v_selected) x where not (x=any(v_allowed))) then raise exception 'One or more selected data groups are not supported'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org::text,0));
  v_preview:=public.charis_reset_workspace_selective_preview(p_org);

  -- Contact deletion is deliberately blocked unless every selected record group
  -- that can retain a contact reference is also selected in the same operation.
  if 'contacts'=any(v_selected) then
    if (public.charis_reset_selective_count('campaign_drafts',p_org)>0 or public.charis_reset_selective_count('email_deliveries',p_org)>0) and not ('campaigns'=any(v_selected)) then
      raise exception 'Contacts are still referenced by campaigns or delivery records. Select Campaigns and delivery history too, or leave Contacts selected off.';
    end if;
    if public.charis_reset_selective_count('charis_direct_recipients',p_org)>0 and not ('direct'=any(v_selected)) then
      raise exception 'Contacts are still referenced by direct messages. Select Direct messages and SMS tests too, or leave Contacts selected off.';
    end if;
    if public.charis_reset_selective_count('charis_zoho_contact_memberships',p_org)>0 and not ('integrations'=any(v_selected)) then
      raise exception 'Contacts are still referenced by Zoho records. Select Zoho and ZeptoMail history too, or leave Contacts selected off.';
    end if;
    if public.charis_reset_selective_count('charis_import_consent_records',p_org)>0 and not ('imports'=any(v_selected)) then
      raise exception 'Contacts are still referenced by import consent evidence. Select Contact imports and evidence too, or leave Contacts selected off.';
    end if;
  end if;

  -- Imports may be removed independently, but contact records remain unless Contacts is selected.
  -- Execute each selected category in dependency-safe order. Any unexpected FK
  -- dependency aborts the transaction; no unselected category is cascaded away.
  if 'campaigns'=any(v_selected) then
    if to_regclass('public.email_delivery_events') is not null and to_regclass('public.email_deliveries') is not null then
      delete from public.email_delivery_events e using public.email_deliveries d where e.delivery_id=d.id and d.organization_id=p_org;
      get diagnostics v_count=row_count; v_deleted:=v_deleted||jsonb_build_object('email_delivery_events',v_count); v_total:=v_total+v_count;
    end if;
    if to_regclass('public.delivery_quota_reservations') is not null then
      delete from public.delivery_quota_reservations where organization_id=p_org;
      get diagnostics v_count=row_count; v_deleted:=v_deleted||jsonb_build_object('delivery_quota_reservations',v_count); v_total:=v_total+v_count;
    end if;
    foreach v_table in array array['charis_resend_broadcast_jobs','email_deliveries','campaign_runs','campaign_revisions','campaign_drafts'] loop
      v_count:=public.charis_reset_selective_delete(v_table,p_org);
      v_deleted:=v_deleted||jsonb_build_object(v_table,v_count); v_total:=v_total+v_count;
    end loop;
  end if;

  if 'direct'=any(v_selected) then
    if to_regclass('public.charis_direct_delivery_events_060') is not null and to_regclass('public.charis_direct_recipients') is not null then
      delete from public.charis_direct_delivery_events_060 e using public.charis_direct_recipients r where e.recipient_id=r.id and r.organization_id=p_org;
      get diagnostics v_count=row_count; v_deleted:=v_deleted||jsonb_build_object('charis_direct_delivery_events_060',v_count); v_total:=v_total+v_count;
    end if;
    foreach v_table in array array['charis_sms_tests','charis_direct_recipients','charis_direct_messages','charis_sms_campaigns'] loop
      v_count:=public.charis_reset_selective_delete(v_table,p_org);
      v_deleted:=v_deleted||jsonb_build_object(v_table,v_count); v_total:=v_total+v_count;
    end loop;
  end if;

  if 'integrations'=any(v_selected) then
    foreach v_table in array array[
      'charis_zoho_email_events','charis_zoho_email_suppressions','charis_zoho_contact_memberships',
      'charis_zoho_consent_attestations','charis_zoho_contact_sync_runs','charis_zoho_contact_lists',
      'charis_zoho_broadcasts','charis_zoho_manual_letters','charis_zeptomail_notices'
    ] loop
      v_count:=public.charis_reset_selective_delete(v_table,p_org);
      v_deleted:=v_deleted||jsonb_build_object(v_table,v_count); v_total:=v_total+v_count;
    end loop;
  end if;

  if 'imports'=any(v_selected) then
    foreach v_table in array array['charis_import_consent_records','contact_import_issues','contact_import_batches'] loop
      v_count:=public.charis_reset_selective_delete(v_table,p_org);
      v_deleted:=v_deleted||jsonb_build_object(v_table,v_count); v_total:=v_total+v_count;
    end loop;
  end if;

  if 'contacts'=any(v_selected) then
    foreach v_table in array array[
      'charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
      'charis_email_preference_tokens','email_suppressions','charis_optional_email_optouts',
      'contact_list_members','contact_segments','contact_lists','contacts'
    ] loop
      v_count:=public.charis_reset_selective_delete(v_table,p_org);
      v_deleted:=v_deleted||jsonb_build_object(v_table,v_count); v_total:=v_total+v_count;
    end loop;
  end if;

  if 'email_tests'=any(v_selected) then
    v_count:=public.charis_reset_selective_delete('email_test_attempts',p_org);
    v_deleted:=v_deleted||jsonb_build_object('email_test_attempts',v_count); v_total:=v_total+v_count;
  end if;

  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  values(p_org,auth.uid(),'workspace.selective_test_data_reset','organization',p_org::text,
    jsonb_build_object('categories',v_selected,'deleted_counts',v_deleted,'deleted_total',v_total));
  return jsonb_build_object('success',true,'categories',v_selected,'deleted_counts',v_deleted,'deleted_total',v_total);
end;
$$;
revoke all on function public.charis_reset_workspace_selected(uuid,text[],text) from public,anon;
grant execute on function public.charis_reset_workspace_selected(uuid,text[],text) to authenticated;

commit;
notify pgrst,'reload schema';
