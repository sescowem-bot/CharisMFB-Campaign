-- 020 | Charis Campaign Centre operational workflows
-- Run only after 019. Additive, tenant-scoped, no consent or self-approval bypass.
BEGIN;

-- Existing staff retain one primary role, with additional operational roles as needed.
-- Company-admin authority is intentionally NOT assignable as an additional role.
CREATE TABLE IF NOT EXISTS public.charis_additional_roles (
 organization_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('manager','campaign_lead','designer','approver','analyst','viewer')),
 assigned_by uuid REFERENCES auth.users(id),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id,user_id,role),
 FOREIGN KEY(organization_id,user_id) REFERENCES public.organization_members(organization_id,user_id) ON DELETE CASCADE
);
ALTER TABLE public.charis_additional_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS charis_additional_roles_read ON public.charis_additional_roles;
CREATE POLICY charis_additional_roles_read ON public.charis_additional_roles FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) OR public.can_manage_team(organization_id));
REVOKE ALL ON public.charis_additional_roles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_additional_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_set_additional_roles(p_org uuid,p_user uuid,p_roles text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Only Charis administrators can assign additional roles'; END IF;
 PERFORM 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Add the verified staff member first'; END IF;
 IF p_roles IS NULL OR coalesce(array_length(p_roles,1),0)>6 THEN RAISE EXCEPTION 'Invalid role selection'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_roles) t(role) WHERE role NOT IN ('manager','campaign_lead','designer','approver','analyst','viewer'))
 THEN RAISE EXCEPTION 'Company administrator is a primary role only'; END IF;
 IF (SELECT count(*) FROM unnest(p_roles))<>(SELECT count(DISTINCT x) FROM unnest(p_roles) x)
 THEN RAISE EXCEPTION 'Duplicate staff role'; END IF;
 DELETE FROM public.charis_additional_roles WHERE organization_id=p_org AND user_id=p_user;
 FOREACH v_role IN ARRAY p_roles LOOP
  INSERT INTO public.charis_additional_roles(organization_id,user_id,role,assigned_by)
  VALUES(p_org,p_user,v_role,auth.uid());
 END LOOP;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'staff.additional_roles_updated','staff',p_user::text,jsonb_build_object('roles',to_jsonb(p_roles)));
END;$$;
REVOKE ALL ON FUNCTION public.charis_set_additional_roles(uuid,uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_set_additional_roles(uuid,uuid,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_has_role(p_org uuid,p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND status='active') AND
 (public.is_platform_super_admin() OR EXISTS (
  SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
  WHERE m.organization_id=p_org AND m.user_id=(SELECT auth.uid()) AND o.status='active'
   AND (m.role=ANY(p_roles) OR EXISTS (
    SELECT 1 FROM public.charis_additional_roles r WHERE r.organization_id=m.organization_id AND r.user_id=m.user_id AND r.role=ANY(p_roles)))
 ));
$$;
REVOKE ALL ON FUNCTION public.charis_has_role(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_has_role(uuid,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_edit_campaigns(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_role(p_org,ARRAY['company_admin','manager','campaign_lead','designer']::text[]);
$$;
CREATE OR REPLACE FUNCTION public.can_approve_campaigns(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_role(p_org,ARRAY['company_admin','campaign_lead','approver']::text[]);
$$;
CREATE OR REPLACE FUNCTION public.can_dispatch_campaigns(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_role(p_org,ARRAY['company_admin','manager','campaign_lead']::text[]);
$$;
CREATE OR REPLACE FUNCTION public.can_manage_contacts(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_role(p_org,ARRAY['company_admin','manager']::text[]);
$$;
CREATE OR REPLACE FUNCTION public.can_edit_company_design(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_has_role(p_org,ARRAY['company_admin','manager','designer','campaign_lead']::text[]);
$$;
REVOKE ALL ON FUNCTION public.can_edit_campaigns(uuid),public.can_approve_campaigns(uuid),public.can_dispatch_campaigns(uuid),public.can_manage_contacts(uuid),public.can_edit_company_design(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_edit_campaigns(uuid),public.can_approve_campaigns(uuid),public.can_dispatch_campaigns(uuid),public.can_manage_contacts(uuid),public.can_edit_company_design(uuid) TO authenticated;

-- Recipient lookup is limited to opted-in contacts and authorised campaign creators.
CREATE OR REPLACE FUNCTION public.charis_recipient_search(p_org uuid,p_query text DEFAULT '',p_page integer DEFAULT 1)
RETURNS TABLE(id uuid,first_name text,last_name text,email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT (public.can_edit_campaigns(p_org) OR public.can_manage_contacts(p_org)) THEN RAISE EXCEPTION 'Not authorised to select recipients'; END IF;
 IF length(coalesce(p_query,''))>80 OR p_page NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid search'; END IF;
 RETURN QUERY SELECT c.id,c.first_name,c.last_name,c.email FROM public.contacts c
 WHERE c.organization_id=p_org AND c.archived_at IS NULL AND c.email IS NOT NULL
 AND c.consent_status='granted' AND c.unsubscribed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.organization_id=p_org AND s.email=c.email)
 AND (trim(coalesce(p_query,''))='' OR position(lower(trim(p_query)) in lower(coalesce(c.first_name,'')))>0
 OR position(lower(trim(p_query)) in lower(coalesce(c.last_name,'')))>0
 OR position(lower(trim(p_query)) in lower(c.email))>0
 OR position(lower(trim(p_query)) in lower(coalesce(c.phone,'')))>0)
 ORDER BY c.first_name,c.last_name,c.id LIMIT 30 OFFSET (p_page-1)*30;
END;$$;
REVOKE ALL ON FUNCTION public.charis_recipient_search(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_recipient_search(uuid,text,integer) TO authenticated;

-- Update selected-recipient save so an authorised Campaign Lead can select recipients
-- without also receiving full create/delete customer privileges.
CREATE OR REPLACE FUNCTION public.charis_campaign_save_selected(
 p_org uuid,p_id uuid,p_expected integer,p_name text,p_subject text,p_preheader text,
 p_design jsonb,p_sender uuid,p_requested timestamptz,p_contacts uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_list uuid;v_campaign uuid;v_count integer;v_distinct integer;
BEGIN
 IF NOT public.can_edit_campaigns(p_org) THEN RAISE EXCEPTION 'Campaign creator access required'; END IF;
 IF coalesce(array_length(p_contacts,1),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Select 1 to 500 customers';END IF;
 SELECT count(DISTINCT x) INTO v_distinct FROM unnest(p_contacts) x;
 IF v_distinct<>array_length(p_contacts,1) THEN RAISE EXCEPTION 'Duplicate recipients';END IF;
 SELECT count(*) INTO v_count FROM public.contacts c WHERE c.organization_id=p_org AND c.id=ANY(p_contacts)
 AND c.archived_at IS NULL AND c.email IS NOT NULL AND c.consent_status='granted' AND c.unsubscribed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.organization_id=p_org AND s.email=c.email);
 IF v_count<>v_distinct THEN RAISE EXCEPTION 'Some selected customers are not eligible for this campaign';END IF;
 INSERT INTO public.contact_lists(organization_id,name,description,created_by)
 VALUES(p_org,'Selected '||substr(gen_random_uuid()::text,1,8)||' '||left(trim(p_name),60),
 'Private recipient selection for a campaign',auth.uid()) RETURNING id INTO v_list;
 INSERT INTO public.contact_list_members(organization_id,list_id,contact_id)
 SELECT p_org,v_list,unnest(p_contacts);
 v_campaign:=public.campaign_save(p_org,p_id,p_expected,p_name,p_subject,p_preheader,p_design,p_sender,'list',v_list,p_requested);
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'campaign.recipient_selection','campaign',v_campaign::text,jsonb_build_object('recipients',v_count,'audience_list',v_list));
 RETURN v_campaign;
END;$$;
REVOKE ALL ON FUNCTION public.charis_campaign_save_selected(uuid,uuid,integer,text,text,text,jsonb,uuid,timestamptz,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_campaign_save_selected(uuid,uuid,integer,text,text,text,jsonb,uuid,timestamptz,uuid[]) TO authenticated;

-- Multi-select list membership, atomic transaction with ownership and size checks.
CREATE OR REPLACE FUNCTION public.charis_list_batch(p_org uuid,p_list uuid,p_contacts uuid[],p_add boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF NOT public.can_manage_contacts(p_org) THEN RAISE EXCEPTION 'Not authorised';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contact_lists WHERE id=p_list AND organization_id=p_org) THEN RAISE EXCEPTION 'List not found'; END IF;
 v_count:=coalesce(array_length(p_contacts,1),0);
 IF v_count NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Choose 1 to 200 customers';END IF;
 IF v_count<>(SELECT count(DISTINCT x) FROM unnest(p_contacts) x) OR
 v_count<>(SELECT count(*) FROM public.contacts WHERE organization_id=p_org AND id=ANY(p_contacts) AND archived_at IS NULL)
 THEN RAISE EXCEPTION 'Customer selection contains duplicates, inactive or unavailable accounts';END IF;
 IF p_add THEN
  INSERT INTO public.contact_list_members(organization_id,list_id,contact_id)
  SELECT p_org,p_list,unnest(p_contacts) ON CONFLICT(list_id,contact_id) DO NOTHING;
 ELSE
  DELETE FROM public.contact_list_members WHERE organization_id=p_org AND list_id=p_list AND contact_id=ANY(p_contacts);
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),CASE WHEN p_add THEN 'list.batch_added' ELSE 'list.batch_removed' END,'contact_list',p_list::text,jsonb_build_object('count',v_count));
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.charis_list_batch(uuid,uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_list_batch(uuid,uuid,uuid[],boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_bulk_contacts(p_org uuid,p_contacts uuid[],p_action text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_customer uuid;v_count integer;
BEGIN
 IF NOT public.can_manage_contacts(p_org) THEN RAISE EXCEPTION 'Not authorised';END IF;
 v_count:=coalesce(array_length(p_contacts,1),0);
 IF v_count NOT BETWEEN 1 AND 100 OR p_action NOT IN ('archive','delete') THEN RAISE EXCEPTION 'Invalid batch request';END IF;
 IF v_count<>(SELECT count(DISTINCT x) FROM unnest(p_contacts) x) OR
 v_count<>(SELECT count(*) FROM public.contacts WHERE organization_id=p_org AND id=ANY(p_contacts))
 THEN RAISE EXCEPTION 'Invalid customer selection';END IF;
 FOREACH v_customer IN ARRAY p_contacts LOOP
  IF p_action='archive' THEN PERFORM public.charis_contact_archive(p_org,v_customer,true);
  ELSE PERFORM public.charis_contact_delete(p_org,v_customer); END IF;
 END LOOP;
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.charis_bulk_contacts(uuid,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_bulk_contacts(uuid,uuid[],text) TO authenticated;

-- Test emails may go only to a verified CURRENT Charis staff member, not arbitrary recipients.
-- All provider rate limits and actual sending checks remain unchanged.
CREATE OR REPLACE FUNCTION public.charis_campaign_test_reserve_to(p_org uuid,p_campaign uuid,p_revision integer,p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid;v_result jsonb;
BEGIN
 SELECT u.id INTO v_user FROM auth.users u
 WHERE lower(u.email)=lower(btrim(p_email)) AND u.email_confirmed_at IS NOT NULL
 AND (EXISTS(SELECT 1 FROM public.organization_members m WHERE m.user_id=u.id AND m.organization_id=p_org)
 OR (u.id=auth.uid() AND public.is_platform_super_admin()));
 IF v_user IS NULL THEN RAISE EXCEPTION 'Choose a verified Charis team member for the test';END IF;
 v_result:=public.charis_campaign_test_reserve(p_org,p_campaign,p_revision);
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'campaign.test_recipient_selected','campaign',p_campaign::text,jsonb_build_object('recipient_id',v_user));
 RETURN jsonb_set(v_result,'{recipient}',to_jsonb(lower(btrim(p_email))),false);
END;$$;
REVOKE ALL ON FUNCTION public.charis_campaign_test_reserve_to(uuid,uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_campaign_test_reserve_to(uuid,uuid,integer,text) TO authenticated;
COMMIT;
