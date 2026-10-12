-- Charis MFB identity seed. Run once after installation (safe to rerun).
-- Sets names only. Logo, colours and the postal address are entered in Brand Studio
-- because they must come from Charis's approved brand guide and registered address.
begin;
update public.platform_branding set display_name='Charis MFB Campaign Centre',tagline='Customer communication',updated_at=now() where id;
update public.organizations o set name='Charis Microfinance Bank',updated_at=now() from public.platform_workspace w where w.organization_id=o.id;
update public.organization_branding b set display_name='Charis Microfinance Bank',updated_at=now() from public.platform_workspace w where w.organization_id=b.organization_id;
commit;
