-- Charis simplification. Apply AFTER 014_owner_campaign_tests.sql.
-- Does not erase any campaign, company, imported contact or prior consent state.
-- Functions are tenant-scoped, limit bulk operations and retain audit/change history.
begin;

-- Batch-safe, paged, eligible-only person search for the compose recipient picker.
create or replace function public.charis_recipient_search(p_org uuid,p_query text default '',p_page integer default 1)
returns table(id uuid,first_name text,last_name text,email text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_manage_contacts(p_org) then raise exception 'Not authorized'; end if;
 if length(coalesce(p_query,''))>80 or p_page not between 1 and 100 then raise exception 'Invalid search'; end if;
 return query select c.id,c.first_name,c.last_name,c.email from public.contacts c
 where c.organization_id=p_org and c.email is not null and c.consent_status='granted' and c.unsubscribed_at is null
 and not exists(select 1 from public.email_suppressions s where s.organization_id=p_org and s.email=c.email)
 and (trim(coalesce(p_query,''))='' or
 position(lower(trim(p_query)) in lower(c.first_name))>0 or
 position(lower(trim(p_query)) in lower(c.last_name))>0 or
 position(lower(trim(p_query)) in lower(c.email))>0 or
 position(lower(trim(p_query)) in lower(coalesce(c.phone,'')))>0)
 order by c.first_name,c.last_name,c.id limit 30 offset (p_page-1)*30;
end;$$;
revoke all on function public.charis_recipient_search(uuid,text,integer) from public,anon;
grant execute on function public.charis_recipient_search(uuid,text,integer) to authenticated;

-- One atomic transaction creates a private audience snapshot and saves a campaign.
-- IDs must belong to the selected organization; no unconsented record can enter the snapshot.
create or replace function public.charis_campaign_save_selected(
 p_org uuid,p_id uuid,p_expected integer,p_name text,p_subject text,p_preheader text,
 p_design jsonb,p_sender uuid,p_requested timestamptz,p_contacts uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_list uuid;v_campaign uuid;v_count int;v_distinct int;
begin
 if not public.can_edit_campaigns(p_org) or not public.can_manage_contacts(p_org) then raise exception 'Not authorized'; end if;
 if coalesce(array_length(p_contacts,1),0) not between 1 and 500 then raise exception 'Select 1 to 500 customers';end if;
 select count(distinct x) into v_distinct from unnest(p_contacts) x;
 if v_distinct<>array_length(p_contacts,1) then raise exception 'Duplicate recipients in selection';end if;
 select count(*) into v_count from public.contacts c where c.organization_id=p_org and c.id=any(p_contacts)
 and c.email is not null and c.consent_status='granted' and c.unsubscribed_at is null
 and not exists(select 1 from public.email_suppressions s where s.organization_id=p_org and s.email=c.email);
 if v_count<>v_distinct then raise exception 'One or more selected recipients are missing or no longer eligible. Refresh your selection';end if;
 insert into public.contact_lists(organization_id,name,description,created_by)
 values(p_org,'Selected '||substr(gen_random_uuid()::text,1,8)||' '||left(trim(p_name),60),
 'Private recipient snapshot for a manually selected campaign',auth.uid()) returning id into v_list;
 insert into public.contact_list_members(organization_id,list_id,contact_id)
 select p_org,v_list,unnest(p_contacts);
 v_campaign:=public.campaign_save(p_org,p_id,p_expected,p_name,p_subject,p_preheader,p_design,p_sender,'list',v_list,p_requested);
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 values(p_org,auth.uid(),'campaign.recipient_selection','campaign',v_campaign::text,
 jsonb_build_object('recipient_count',v_count,'audience_list',v_list));
 return v_campaign;
end;$$;
revoke all on function public.charis_campaign_save_selected(uuid,uuid,integer,text,text,text,jsonb,uuid,timestamptz,uuid[]) from public,anon;
grant execute on function public.charis_campaign_save_selected(uuid,uuid,integer,text,text,text,jsonb,uuid,timestamptz,uuid[]) to authenticated;

-- Existing imports become useful instantly as a saved selectable list, without changing consent.
-- A row already on file is included in the new group, but opt-out/marketing eligibility remains unchanged.
create or replace function public.charis_import_batch_to_list(p_org uuid,p_batch_key uuid,p_rows jsonb,p_list uuid)
returns table(inserted integer,skipped integer,rejected integer)
language plpgsql security definer set search_path='' as $$
declare v_results record;
begin
 if not public.can_manage_contacts(p_org) then raise exception 'Not authorized'; end if;
 if p_list is null or not exists(select 1 from public.contact_lists where organization_id=p_org and id=p_list) then raise exception 'Selected contact list unavailable'; end if;
 select * into v_results from public.import_contact_batch(p_org,p_batch_key,p_rows);
 insert into public.contact_list_members(organization_id,list_id,contact_id)
 select distinct p_org,p_list,c.id from jsonb_array_elements(p_rows) x
 join public.contacts c on c.organization_id=p_org
 and ((nullif(lower(btrim(x->>'email')),'') is not null and c.email=lower(btrim(x->>'email')))
 or (nullif(lower(btrim(x->>'email')),'') is null and nullif(btrim(x->>'phone'),'') is not null and c.phone=btrim(x->>'phone')))
 on conflict(list_id,contact_id) do nothing;
 return query select v_results.inserted,v_results.skipped,v_results.rejected;
end;$$;
revoke all on function public.charis_import_batch_to_list(uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.charis_import_batch_to_list(uuid,uuid,jsonb,uuid) to authenticated;
commit;
