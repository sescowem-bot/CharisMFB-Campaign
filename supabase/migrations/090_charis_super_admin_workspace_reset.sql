-- 090_charis_super_admin_workspace_reset.sql
-- Adds a Super Admin-only, organisation-scoped reset for Charis test workspace data.
-- Preserves auth users, organisation, memberships, platform_staff, branding,
-- provider credentials/settings, core communication settings and audit history.

begin;

create or replace function public.charis_reset_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_staff ps
      where ps.user_id = auth.uid()
        and ps.role = 'super_admin'
    );
$$;

revoke all on function public.charis_reset_is_super_admin() from public, anon, authenticated;

create or replace function public.charis_reset_count(p_table text, p_org uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if p_table not in (
    'charis_resend_broadcast_jobs','email_deliveries','campaign_runs','campaign_revisions','campaign_drafts',
    'charis_direct_recipients','charis_direct_messages','charis_sms_tests','charis_sms_campaigns',
    'charis_zoho_email_events','charis_zoho_email_suppressions','charis_zoho_broadcasts',
    'charis_zoho_contact_memberships','charis_zoho_consent_attestations','charis_zoho_contact_sync_runs',
    'charis_zoho_contact_lists','charis_zoho_manual_letters','charis_zeptomail_notices',
    'charis_import_consent_records','contact_import_issues','charis_email_preference_tokens',
    'charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
    'email_suppressions','charis_optional_email_optouts','contact_list_members','contact_import_batches',
    'contact_segments','contact_lists','contacts','charis_email_routes','charis_direct_provider_prefs',
    'email_test_attempts','sender_identities','sending_domains'
  ) then raise exception 'Reset table is not allowlisted'; end if;
  if to_regclass(format('public.%I', p_table)) is null then return 0; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='organization_id') then
    execute format('select count(*) from public.%I where organization_id = $1', p_table) into v_count using p_org;
    return coalesce(v_count, 0);
  end if;
  return 0;
end;
$$;

revoke all on function public.charis_reset_count(text, uuid) from public, anon, authenticated;

create or replace function public.charis_reset_delete(p_table text, p_org uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  if p_table not in (
    'charis_resend_broadcast_jobs','email_deliveries','campaign_runs','campaign_revisions','campaign_drafts',
    'charis_direct_recipients','charis_direct_messages','charis_sms_tests','charis_sms_campaigns',
    'charis_zoho_email_events','charis_zoho_email_suppressions','charis_zoho_broadcasts',
    'charis_zoho_contact_memberships','charis_zoho_consent_attestations','charis_zoho_contact_sync_runs',
    'charis_zoho_contact_lists','charis_zoho_manual_letters','charis_zeptomail_notices',
    'charis_import_consent_records','contact_import_issues','charis_email_preference_tokens',
    'charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
    'email_suppressions','charis_optional_email_optouts','contact_list_members','contact_import_batches',
    'contact_segments','contact_lists','contacts','charis_email_routes','charis_direct_provider_prefs',
    'email_test_attempts','sender_identities','sending_domains'
  ) then raise exception 'Reset table is not allowlisted'; end if;
  if to_regclass(format('public.%I', p_table)) is null then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='organization_id') then return 0; end if;
  execute format('delete from public.%I where organization_id = $1', p_table) using p_org;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.charis_reset_delete(text, uuid) from public, anon, authenticated;

create or replace function public.charis_reset_workspace_preview(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_table text; v_counts jsonb := '{}'::jsonb; v_total bigint := 0; v_count bigint;
begin
  if not public.charis_reset_is_super_admin() then raise exception 'Only a platform Super Admin can reset workspace data'; end if;
  if p_org is null or not exists (select 1 from public.organizations where id = p_org) then raise exception 'Workspace not found'; end if;
  for v_table in select unnest(array[
    'charis_resend_broadcast_jobs','email_deliveries','campaign_runs','campaign_revisions','campaign_drafts',
    'charis_direct_recipients','charis_direct_messages','charis_sms_tests','charis_sms_campaigns',
    'charis_zoho_email_events','charis_zoho_email_suppressions','charis_zoho_broadcasts',
    'charis_zoho_contact_memberships','charis_zoho_consent_attestations','charis_zoho_contact_sync_runs',
    'charis_zoho_contact_lists','charis_zoho_manual_letters','charis_zeptomail_notices',
    'charis_import_consent_records','contact_import_issues','charis_email_preference_tokens',
    'charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
    'email_suppressions','charis_optional_email_optouts','contact_list_members','contact_import_batches',
    'contact_segments','contact_lists','contacts','charis_email_routes','charis_direct_provider_prefs',
    'email_test_attempts','sender_identities','sending_domains'
  ]) loop
    v_count := public.charis_reset_count(v_table, p_org);
    v_counts := v_counts || jsonb_build_object(v_table, v_count);
    v_total := v_total + v_count;
  end loop;
  select v_counts || jsonb_build_object(
    'email_delivery_events',(select count(*) from public.email_delivery_events e join public.email_deliveries d on d.id=e.delivery_id where d.organization_id=p_org),
    'delivery_quota_reservations',(select count(*) from public.delivery_quota_reservations q where q.organization_id=p_org),
    'charis_direct_delivery_events_060',(select count(*) from public.charis_direct_delivery_events_060 e join public.charis_direct_recipients r on r.id=e.recipient_id where r.organization_id=p_org)
  ) into v_counts;
  return jsonb_build_object('organization_id',p_org,'counts',v_counts,
    'scoped_rows',v_total+coalesce((v_counts->>'email_delivery_events')::bigint,0)+coalesce((v_counts->>'delivery_quota_reservations')::bigint,0)+coalesce((v_counts->>'charis_direct_delivery_events_060')::bigint,0),
    'preserved',jsonb_build_array('Super Admin and staff login accounts','Organisation and staff memberships','Provider API credentials and provider settings','Branding and core communication settings','Audit history'));
end;
$$;

revoke all on function public.charis_reset_workspace_preview(uuid) from public, anon;
grant execute on function public.charis_reset_workspace_preview(uuid) to authenticated;

create or replace function public.charis_reset_workspace(p_org uuid, p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted jsonb := '{}'::jsonb; v_table text; v_count bigint; v_total bigint := 0;
begin
  if not public.charis_reset_is_super_admin() then raise exception 'Only a platform Super Admin can reset workspace data'; end if;
  if p_confirmation is distinct from 'RESET CHARIS TEST DATA' then raise exception 'Confirmation phrase does not match'; end if;
  if p_org is null or not exists (select 1 from public.organizations where id=p_org) then raise exception 'Workspace not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  delete from public.email_delivery_events e using public.email_deliveries d where e.delivery_id=d.id and d.organization_id=p_org;
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('email_delivery_events',v_count); v_total := v_total+v_count;
  delete from public.charis_direct_delivery_events_060 e using public.charis_direct_recipients r where e.recipient_id=r.id and r.organization_id=p_org;
  get diagnostics v_count = row_count; v_deleted := v_deleted || jsonb_build_object('charis_direct_delivery_events_060',v_count); v_total := v_total+v_count;
  foreach v_table in array array[
    'delivery_quota_reservations','charis_resend_broadcast_jobs','email_deliveries','campaign_runs','campaign_revisions','campaign_drafts',
    'charis_direct_recipients','charis_direct_messages','charis_sms_tests','charis_sms_campaigns',
    'charis_zoho_email_events','charis_zoho_email_suppressions','charis_zoho_broadcasts',
    'charis_zoho_contact_memberships','charis_zoho_consent_attestations','charis_zoho_contact_sync_runs',
    'charis_zoho_contact_lists','charis_zoho_manual_letters','charis_zeptomail_notices',
    'charis_import_consent_records','contact_import_issues','charis_email_preference_tokens',
    'charis_subscription_events','charis_resubscribe_requests','charis_subscription_sync',
    'email_suppressions','charis_optional_email_optouts','contact_list_members','contact_import_batches',
    'contact_segments','contact_lists','contacts','charis_email_routes','charis_direct_provider_prefs',
    'email_test_attempts','sender_identities','sending_domains'
  ] loop
    if v_table='delivery_quota_reservations' then
      delete from public.delivery_quota_reservations where organization_id=p_org;
      get diagnostics v_count = row_count;
    else
      v_count := public.charis_reset_delete(v_table,p_org);
    end if;
    v_deleted := v_deleted || jsonb_build_object(v_table,v_count); v_total := v_total+v_count;
  end loop;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  values(p_org,auth.uid(),'workspace.test_data_reset','organization',p_org::text,
    jsonb_build_object('deleted_counts',v_deleted,'deleted_total',v_total,'confirmation','RESET CHARIS TEST DATA'));
  return jsonb_build_object('success',true,'deleted_counts',v_deleted,'deleted_total',v_total,
    'preserved',jsonb_build_array('Super Admin and staff login accounts','Organisation and staff memberships','Provider API credentials and provider settings','Branding and core communication settings','Audit history'));
end;
$$;

revoke all on function public.charis_reset_workspace(uuid, text) from public, anon;
grant execute on function public.charis_reset_workspace(uuid, text) to authenticated;

commit;
