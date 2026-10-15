-- Additive visual template controls. Run after 027. No customer dispatch changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_email_template(p_id uuid,p_org uuid,p_name text,p_subject text,p_description text,p_category text,p_design jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;v_owner uuid; b jsonb; prop text; n numeric;
BEGIN
 IF p_org IS NULL THEN
  IF NOT public.is_platform_super_admin() THEN RAISE EXCEPTION 'Not authorized';END IF;
 ELSE
  IF NOT public.can_edit_company_design(p_org) THEN RAISE EXCEPTION 'Not authorized';END IF;
 END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 OR length(coalesce(p_subject,''))>200 THEN RAISE EXCEPTION 'Invalid template name or subject'; END IF;
 IF length(coalesce(p_description,''))>500 OR length(coalesce(p_category,''))>40 THEN RAISE EXCEPTION 'Invalid template metadata';END IF;
 IF jsonb_typeof(p_design) IS DISTINCT FROM 'object' OR length(p_design::text)>60000
   OR p_design->>'version' IS DISTINCT FROM '1' OR jsonb_typeof(p_design->'blocks') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_design->'blocks') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid email design';END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(p_design->'blocks') LOOP
  IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR b->>'type' IS NULL OR jsonb_typeof(b->'text') IS DISTINCT FROM 'string' OR b->>'type' NOT IN ('heading','paragraph','button','divider','image','shape')
   OR length(coalesce(b->>'text',''))>5000 THEN RAISE EXCEPTION 'Unsupported email block';END IF;
  IF b->>'type'='image' THEN
   IF p_org IS NULL OR NOT EXISTS(SELECT 1 FROM public.charis_media_assets
     WHERE organization_id=p_org AND public_url=b->>'url') THEN
      RAISE EXCEPTION 'Email image must come from the bank-approved media library';END IF;
  END IF;
  IF b->>'type'='shape' THEN
   IF coalesce(b->>'shape','') NOT IN ('pill','banner','panel','rule','rectangle','circle')
     OR coalesce(b->>'color','') !~ '^#[0-9A-Fa-f]{6}$'
     OR length(b->>'text')>200 THEN RAISE EXCEPTION 'Invalid shape style';END IF;
   FOREACH prop IN ARRAY ARRAY['textColor','borderColor'] LOOP
    IF b ? prop AND coalesce(b->>prop,'') !~ '^#[0-9A-Fa-f]{6}$' THEN RAISE EXCEPTION 'Invalid shape color';END IF;
   END LOOP;
   IF b ? 'align' AND coalesce(b->>'align','') NOT IN ('left','center','right') THEN RAISE EXCEPTION 'Invalid alignment';END IF;
   FOREACH prop IN ARRAY ARRAY['borderWidth','padding','widthPercent','minHeight','fontSize'] LOOP
    IF b ? prop THEN
     IF jsonb_typeof(b->prop) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid shape size';END IF;
     n := (b->>prop)::numeric;
     IF n<>trunc(n) OR n<0 OR
       (prop='borderWidth' AND n>12) OR (prop='padding' AND n>64) OR
       (prop='widthPercent' AND (n<25 OR n>100)) OR
       (prop='minHeight' AND n>400) OR (prop='fontSize' AND (n<12 OR n>48))
       THEN RAISE EXCEPTION 'Invalid shape size';END IF;
    END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF p_id IS NULL THEN
  INSERT INTO public.email_templates(organization_id,name,subject,description,category,design,created_by,updated_by)
  VALUES(p_org,trim(p_name),coalesce(p_subject,''),coalesce(p_description,''),coalesce(p_category,'general'),p_design,auth.uid(),auth.uid()) RETURNING id INTO v_id;
 ELSE
  SELECT organization_id INTO v_owner FROM public.email_templates WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_owner IS DISTINCT FROM p_org THEN RAISE EXCEPTION 'Template not found in this workspace';END IF;
  UPDATE public.email_templates SET name=trim(p_name),subject=coalesce(p_subject,''),description=coalesce(p_description,''),category=coalesce(p_category,'general'),design=p_design,updated_at=now(),updated_by=auth.uid(),status='draft'
  WHERE id=p_id RETURNING id INTO v_id;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'template.saved','email_template',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.save_email_template(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_email_template(uuid,uuid,text,text,text,text,jsonb) TO authenticated;
COMMIT;
