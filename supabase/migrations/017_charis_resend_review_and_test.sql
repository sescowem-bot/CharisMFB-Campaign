-- Charis Migration 017: bank-specific tests and one-recipient controlled dispatch.
-- Apply once after migration 015 (and after 016 if staff invitations are installed).
-- Does not disable independent approvals or unsubscribe enforcement.
-- Service-role-only delivery function remains restricted to the bank workspace or platform-owner workspace.
begin;

create or replace function public.charis_campaign_test_reserve(p_org uuid,p_campaign uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.campaign_drafts;s public.sender_identities;b public.organization_branding;v_attempt uuid;v_email text;
begin
 if not exists(select 1 from public.organizations where id=p_org and slug='charis-mfb' and status='active') or
    not public.can_manage_senders(p_org) or not public.can_edit_campaigns(p_org)
    then raise exception 'An authorised Charis administrator must sign in to test the campaign'; end if;
 select email into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Verified account email required'; end if;
 select * into c from public.campaign_drafts where id=p_campaign and organization_id=p_org;
 if not found or c.status='archived' then raise exception 'Saved active campaign required'; end if;
 if c.revision is distinct from p_revision then raise exception 'Campaign changed. Reload before testing'; end if;
 select * into s from public.sender_identities where id=c.sender_id and organization_id=p_org and is_active;
 if not found then raise exception 'Select a verified sender and save your draft first'; end if;
 select * into b from public.organization_branding where organization_id=p_org;
 if length(trim(coalesce(b.postal_address,'')))<6 then raise exception 'Save your business postal address before testing'; end if;
 -- Shared provider and workspace quotas include configuration tests and campaign tests.
 v_attempt=public.email_test_reserve(p_org,c.sender_id);
 update public.email_test_attempts set campaign_id=c.id,campaign_revision=c.revision where id=v_attempt;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 values(p_org,auth.uid(),'campaign.test_reserved','campaign',c.id::text,jsonb_build_object('revision',c.revision,'attempt',v_attempt));
 return jsonb_build_object('attempt',v_attempt,'campaign',to_jsonb(c),'sender',to_jsonb(s),'brand',to_jsonb(b),'recipient',v_email);
end;$$;
revoke all on function public.charis_campaign_test_reserve(uuid,uuid,integer) from public,anon;
grant execute on function public.charis_campaign_test_reserve(uuid,uuid,integer) to authenticated;

create or replace function public.owner_delivery_claim(p_org uuid,p_run uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.email_deliveries; r public.campaign_runs;
begin
 if auth.role() is distinct from 'service_role' or not (
  exists(select 1 from public.platform_workspace where organization_id=p_org) or
  exists(select 1 from public.organizations where id=p_org and slug='charis-mfb' and status='active')
 ) then raise exception 'Not authorized'; end if;
 select * into r from public.campaign_runs where id=p_run and organization_id=p_org and status in ('queued','running') and scheduled_at<=now() for update skip locked;
 if not found then return null; end if;
 update public.email_deliveries set status='pending',lease_token=null,lease_until=null where run_id=p_run and status='leased' and lease_until<now();
 update public.email_deliveries set status='unknown',reason='dispatch_lease_expired',updated_at=now() where run_id=p_run and status='dispatching' and lease_until<now();
 select * into d from public.email_deliveries where run_id=p_run and status='pending' and available_at<=now() order by id limit 1 for update skip locked;
 if not found then
  update public.campaign_runs set status='completed' where id=p_run and not exists(select 1 from public.email_deliveries where run_id=p_run and status in ('pending','leased','dispatching'));
  return null;
 end if;
 update public.email_deliveries set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=d.id returning * into d;
 return jsonb_build_object('delivery',to_jsonb(d),'run',to_jsonb(r));
end;$$;
revoke all on function public.owner_delivery_claim(uuid,uuid) from public,anon,authenticated;
grant execute on function public.owner_delivery_claim(uuid,uuid) to service_role;

commit;
