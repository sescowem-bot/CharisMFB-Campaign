-- 015: single-system (Charis) hardening. Apply after 014; safe to rerun.
-- Owner self-approval is disabled by default so every campaign needs maker-checker review.
begin;
alter table public.platform_workspace add column if not exists owner_self_approval boolean not null default false;
create or replace function public.owner_self_approval_enabled() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select owner_self_approval from public.platform_workspace),false);
$$;
revoke all on function public.owner_self_approval_enabled() from public,anon;
grant execute on function public.owner_self_approval_enabled() to authenticated;
create or replace function public.campaign_transition(p_org uuid,p_id uuid,p_expected integer,p_action text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare v_row public.campaign_drafts; v_status text; v_eligible integer;
begin
 if not (public.can_edit_campaigns(p_org) or public.can_approve_campaigns(p_org)) then raise exception 'Not authorized'; end if;
 select * into v_row from public.campaign_drafts where id=p_id and organization_id=p_org for update;
 if not found then raise exception 'Campaign unavailable'; end if;
 if v_row.revision is distinct from p_expected then raise exception 'Campaign changed. Reload before continuing'; end if;
 if length(coalesce(p_note,''))>1000 then raise exception 'Review note too long'; end if;
 if p_action='owner_approve' then
  if not coalesce((select owner_self_approval from public.platform_workspace),false) then raise exception 'Independent approval required: a different authorized person must approve this campaign'; end if;
  if not public.is_owner_workspace(p_org) or not public.can_approve_campaigns(p_org) then raise exception 'Owner approval is available only in your own workspace'; end if;
  if v_row.status not in ('draft','rejected','pending_approval') then raise exception 'Return this campaign to draft before approval'; end if;
  v_status='approved';
 elsif p_action in ('approve','reject') then
  if not public.can_approve_campaigns(p_org) then raise exception 'Not authorized'; end if;
  if v_row.status<>'pending_approval' then raise exception 'Campaign is not awaiting review'; end if;
  if auth.uid()=v_row.edited_by or auth.uid()=v_row.submitted_by then raise exception 'A different authorized person must review this campaign'; end if;
  if p_action='reject' and length(trim(coalesce(p_note,'')))<3 then raise exception 'Provide a rejection reason'; end if;
  v_status=case when p_action='approve' then 'approved' else 'rejected' end;
 else
  if not public.can_edit_campaigns(p_org) then raise exception 'Not authorized'; end if;
  if p_action='submit' and v_row.status in ('draft','rejected') then v_status='pending_approval';
  elsif p_action='withdraw' and v_row.status in ('pending_approval','approved','rejected') then v_status='draft';
  elsif p_action='archive' and v_row.status<>'archived' then v_status='archived';
  else raise exception 'Invalid campaign transition'; end if;
 end if;
 if p_action in ('submit','approve','owner_approve') then
  if not exists(select 1 from public.sender_identities s join public.sending_domains d on d.id=s.domain_id and d.organization_id=s.organization_id join public.email_provider_settings p on p.provider=d.provider where s.id=v_row.sender_id and s.organization_id=p_org and s.is_active and d.verification_status='verified' and p.enabled) then raise exception 'Verified sender and enabled provider required'; end if;
  if not exists(select 1 from public.organization_branding where organization_id=p_org and length(trim(coalesce(postal_address,'')))>=6) then raise exception 'Save a company postal address in Brand Studio first'; end if;
  v_eligible=public.campaign_audience_count(p_org,v_row.audience_type,v_row.audience_id);
  if v_eligible=0 then raise exception 'No eligible opted-in contacts'; end if;
  if v_row.requested_send_at is not null and v_row.requested_send_at<=now() then raise exception 'Requested send time has passed. Revise the draft'; end if;
 end if;
 update public.campaign_drafts set status=v_status,revision=revision+1,
 submitted_by=case when p_action='submit' then auth.uid() when p_action='withdraw' then null else submitted_by end,
 reviewed_by=case when p_action in ('approve','reject','owner_approve') then auth.uid() when p_action='withdraw' then null else reviewed_by end,
 review_note=case when p_action in ('approve','reject','owner_approve') then coalesce(p_note,'') when p_action='withdraw' then '' else review_note end,
 eligible_at_review=case when p_action in ('submit','approve','owner_approve') then v_eligible when p_action='withdraw' then null else eligible_at_review end,updated_at=now()
 where id=p_id returning * into v_row;
 insert into public.campaign_revisions(organization_id,campaign_id,revision,snapshot,actor_id) values(p_org,p_id,v_row.revision,to_jsonb(v_row),auth.uid());
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details) values(p_org,auth.uid(),'campaign.'||p_action,'campaign',p_id::text,jsonb_build_object('revision',v_row.revision));
end;$$;
revoke all on function public.campaign_transition(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.campaign_transition(uuid,uuid,integer,text,text) to authenticated;
commit;
