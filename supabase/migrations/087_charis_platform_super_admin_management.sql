-- 087: Secure platform super-administrator management.
-- Only an existing super_admin may view or change the platform super_admin roster.
begin;

create or replace function public.charis_platform_super_admin_list()
returns table(user_id uuid,email text,created_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
begin
  if not exists(select 1 from public.platform_staff ps where ps.user_id=auth.uid() and ps.role='super_admin') then
    raise exception 'Platform super administrator access required';
  end if;
  return query
    select ps.user_id, lower(u.email::text), ps.created_at
    from public.platform_staff ps
    join auth.users u on u.id=ps.user_id
    where ps.role='super_admin'
    order by ps.created_at asc;
end;
$$;

create or replace function public.charis_platform_super_admin_set(p_email text,p_enabled boolean)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_target uuid; v_count integer;
begin
  if not exists(select 1 from public.platform_staff ps where ps.user_id=auth.uid() and ps.role='super_admin') then
    raise exception 'Platform super administrator access required';
  end if;
  if p_email is null or length(btrim(p_email))>254 or btrim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Enter a valid account email';
  end if;
  select id into v_target from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null limit 1;
  if v_target is null then raise exception 'No verified account was found for that email'; end if;

  if p_enabled then
    insert into public.platform_staff(user_id,role) values(v_target,'super_admin')
    on conflict(user_id) do update set role='super_admin';
    return 'Super administrator access granted.';
  end if;

  select count(*) into v_count from public.platform_staff where role='super_admin';
  if v_count<=1 and exists(select 1 from public.platform_staff where user_id=v_target and role='super_admin') then
    raise exception 'The last super administrator cannot be removed';
  end if;
  delete from public.platform_staff where user_id=v_target and role='super_admin';
  return 'Super administrator access removed.';
end;
$$;

revoke all on function public.charis_platform_super_admin_list() from public,anon;
revoke all on function public.charis_platform_super_admin_set(text,boolean) from public,anon;
grant execute on function public.charis_platform_super_admin_list() to authenticated;
grant execute on function public.charis_platform_super_admin_set(text,boolean) to authenticated;
commit;
