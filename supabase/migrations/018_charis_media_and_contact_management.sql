-- CHARIS CAMPAIGN CENTRE · MIGRATION 018
-- Requires migrations 001–017. Back up your database first.
-- Adds managed visual assets and controlled customer removal. Does not modify historical delivery rows.
begin;

alter table public.organization_branding add column if not exists favicon_url text;
-- Separate Resend-account verification from explicit Charis workspace authorisation.
alter table public.sending_domains add column if not exists charis_connected boolean not null default false;
alter table public.contacts add column if not exists archived_at timestamptz;
alter table public.contacts add column if not exists archived_by uuid references auth.users(id);
create index if not exists contacts_active_org_created on public.contacts(organization_id,created_at desc) where archived_at is null;

create table if not exists public.charis_media_assets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 file_name text not null check(length(file_name) between 1 and 160),
 object_path text not null unique,
 public_url text not null check(public_url like 'https://%'),
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
 bytes integer not null check(bytes > 0 and bytes <= 2097152),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.charis_media_assets enable row level security;
drop policy if exists "charis staff read media" on public.charis_media_assets;
create policy "charis staff read media" on public.charis_media_assets for select to authenticated
 using (public.is_organization_member(organization_id) or public.is_platform_super_admin());
-- Writes to this table and the Storage bucket are performed by authenticated,
-- role-checked server actions using a server-only service credential.
revoke insert, update, delete on public.charis_media_assets from anon,authenticated;

-- A public bucket is appropriate ONLY for bank-approved graphical assets, never customer records.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values('charis-brand-assets','charis-brand-assets',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- An archived customer remains non-marketable even if a legacy edit form sends
-- consent_status='granted'. Restoration still requires a separately recorded opt-in.
create or replace function public.charis_archived_contact_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.archived_at is not null then
  new.consent_status:='denied';
  new.consent_evidence:=null;
  new.consent_recorded_at:=null;
  new.unsubscribed_at:=coalesce(new.unsubscribed_at,now());
 end if;
 return new;
end;$$;
revoke all on function public.charis_archived_contact_guard() from public,anon,authenticated;
drop trigger if exists charis_archived_contact_guard on public.contacts;
create trigger charis_archived_contact_guard before insert or update on public.contacts
for each row execute function public.charis_archived_contact_guard();

-- Archive removes a contact from future audience selection, preserves historic references,
-- and does NOT imply fresh marketing consent if later restored.
create or replace function public.charis_contact_archive(p_org uuid,p_contact uuid,p_archive boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.can_manage_contacts(p_org) then raise exception 'Not authorised to manage customers'; end if;
 if not exists(select 1 from public.organizations where id=p_org and status='active') then raise exception 'Charis workspace must be active'; end if;
 select id into v_id from public.contacts where organization_id=p_org and id=p_contact for update;
 if v_id is null then raise exception 'Customer not found'; end if;
 if p_archive then
  update public.contacts set archived_at=now(),archived_by=auth.uid(),consent_status='denied',
    consent_evidence=null,consent_recorded_at=null,unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now()
  where organization_id=p_org and id=p_contact and archived_at is null;
 else
  update public.contacts set archived_at=null,archived_by=null,updated_at=now()
  where organization_id=p_org and id=p_contact;
  -- Consent remains denied. A separately documented opt-in is required before marketing.
 end if;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 values(p_org,auth.uid(),case when p_archive then 'contact.archived' else 'contact.restored' end,'contact',p_contact::text,
 jsonb_build_object('marketing_consent_restored',false));
end;$$;
revoke all on function public.charis_contact_archive(uuid,uuid,boolean) from public,anon;
grant execute on function public.charis_contact_archive(uuid,uuid,boolean) to authenticated;

-- Permanent deletion is offered only where the contact has NO delivery history or
-- involvement in an already-approved/pending campaign. Otherwise use Archive.
create or replace function public.charis_contact_delete(p_org uuid,p_contact uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_customer public.contacts;
begin
 if not public.can_manage_contacts(p_org) then raise exception 'Not authorised to remove customers'; end if;
 if not exists(select 1 from public.organizations where id=p_org and status='active') then raise exception 'Charis workspace must be active'; end if;
 select * into v_customer from public.contacts where organization_id=p_org and id=p_contact for update;
 if not found then raise exception 'Customer not found'; end if;
 if exists(select 1 from public.email_deliveries where organization_id=p_org and contact_id=p_contact) then
   raise exception 'Customer has delivery history. Archive instead to preserve audit and delivery records';
 end if;
 if exists(select 1 from public.contact_list_members m
   join public.campaign_drafts c on c.organization_id=m.organization_id and c.audience_type='list' and c.audience_id=m.list_id
   where m.organization_id=p_org and m.contact_id=p_contact and c.status in ('approved','pending_approval')) then
   raise exception 'Customer is in a submitted/approved campaign. Archive first; retain the review history';
 end if;
 delete from public.contacts where organization_id=p_org and id=p_contact;
 -- No name/email/phone copied into audit details.
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 values(p_org,auth.uid(),'contact.deleted','contact',p_contact::text);
end;$$;
revoke all on function public.charis_contact_delete(uuid,uuid) from public,anon;
grant execute on function public.charis_contact_delete(uuid,uuid) to authenticated;

-- Guard at the database boundary: an approved campaign may not enqueue using a
-- sender merely verified elsewhere in the API account. No bypass via direct RPC.
create or replace function public.charis_run_domain_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.organizations where id=new.organization_id and slug='charis-mfb') then
  if not exists(select 1 from public.campaign_drafts c
      join public.sender_identities s on s.id=c.sender_id and s.organization_id=c.organization_id
      join public.sending_domains d on d.id=s.domain_id and d.organization_id=s.organization_id
      where c.id=new.campaign_id and c.organization_id=new.organization_id and s.is_active
      and d.charis_connected and d.verification_status='verified') then
     raise exception 'Charis campaign requires an explicitly connected verified sending domain';
  end if;
 end if;
 return new;
end;$$;
revoke all on function public.charis_run_domain_guard() from public,anon,authenticated;
drop trigger if exists charis_run_domain_guard on public.campaign_runs;
create trigger charis_run_domain_guard before insert on public.campaign_runs
for each row execute function public.charis_run_domain_guard();

commit;
