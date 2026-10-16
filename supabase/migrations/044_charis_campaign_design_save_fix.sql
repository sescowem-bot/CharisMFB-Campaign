-- CHARIS CAMPAIGN CENTRE — SQL 044
-- Fix "Invalid design block" when Campaign Studio uses approved images and shapes.
-- Based on existing migrations 008, 013, 018, 020 and 028. Requires them installed.
-- Does not change any customer, sender, campaign or delivery data.
-- Before applying: back up Supabase and check your live function has not been customised.
-- IMPORTANT: Paste the ENTIRE script, not only the first 62 lines.
-- The bottom must include the full function closing, COMMIT, and the schema reload notification.
BEGIN;
CREATE OR REPLACE FUNCTION public.campaign_save(
 p_org uuid,p_id uuid,p_expected integer,p_name text,p_subject text,p_preheader text,
 p_design jsonb,p_sender uuid,p_type text,p_audience uuid,p_requested timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_id uuid;
 v_row public.campaign_drafts;
 v_text text;
 v_block jsonb;
 v_key text;
 v_number numeric;
 v_field text;
 v_type text;
BEGIN
 IF NOT public.can_edit_campaigns(p_org) THEN
  RAISE EXCEPTION 'Not authorized';
 END IF;
 IF p_name IS NULL OR p_subject IS NULL
    OR length(trim(p_name)) NOT BETWEEN 2 AND 120
    OR length(trim(p_subject)) NOT BETWEEN 1 AND 200
    OR p_subject ~ '[\r\n]'
    OR length(coalesce(p_preheader,''))>250 THEN
  RAISE EXCEPTION 'Invalid campaign details';
 END IF;
 IF jsonb_typeof(p_design) IS DISTINCT FROM 'object'
    OR p_design->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_design->'blocks') IS DISTINCT FROM 'array'
    OR length(p_design::text)>60000 THEN
  RAISE EXCEPTION 'Invalid design';
 END IF;
 IF jsonb_array_length(p_design->'blocks') NOT BETWEEN 1 AND 30 THEN
  RAISE EXCEPTION 'Invalid block count';
 END IF;
 IF p_design ? 'style' AND coalesce(p_design->>'style','') NOT IN ('classic','modern','minimal','announcement') THEN
  RAISE EXCEPTION 'Invalid email layout';
 END IF;

 -- Keep the server's strict design contract. In particular, no user HTML/SVG/JS.
 FOR v_block IN SELECT value FROM jsonb_array_elements(p_design->'blocks') LOOP
  IF jsonb_typeof(v_block) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_block->'type') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_block->'text') IS DISTINCT FROM 'string'
     OR v_block->>'type' NOT IN ('heading','paragraph','button','divider','image','shape')
  THEN RAISE EXCEPTION 'Invalid design block'; END IF;
  v_type:=v_block->>'type';

  -- Reject unrecognised fields rather than relying on browser-side controls.
  FOR v_key IN SELECT jsonb_object_keys(v_block) LOOP
   IF (v_type IN ('heading','paragraph','divider') AND v_key NOT IN ('type','text'))
    OR (v_type='button' AND v_key NOT IN ('type','text','url'))
    OR (v_type='image' AND v_key NOT IN ('type','text','url','width'))
    OR (v_type='shape' AND v_key NOT IN ('type','text','shape','color','textColor','borderColor','borderWidth','padding','widthPercent','minHeight','fontSize','align'))
   THEN RAISE EXCEPTION 'Unsupported email design field';END IF;
  END LOOP;
  IF (length(v_block->>'text') >
      (CASE WHEN v_type IN ('button','shape') THEN 200
            WHEN v_type='image' THEN 160
            ELSE 5000 END))
    OR (v_type='image' AND length(v_block->>'text')=0)
    OR (v_type='divider' AND (v_block->>'text')<>'')
  THEN
   RAISE EXCEPTION 'Invalid design block text';
  END IF;

  IF v_type IN ('button','image') THEN
   IF jsonb_typeof(v_block->'url') IS DISTINCT FROM 'string'
     OR length(v_block->>'url') NOT BETWEEN 9 AND 1800
     OR v_block->>'url' !~ '^https://[^[:space:]]+$'
   THEN RAISE EXCEPTION 'An HTTPS link is required for buttons and images'; END IF;
  END IF;
  IF v_type='image' THEN
   IF v_block ? 'width' AND coalesce(v_block->>'width','') NOT IN ('full','medium','small')
   THEN RAISE EXCEPTION 'Invalid email image width';END IF;
   IF NOT EXISTS (
    SELECT 1 FROM public.charis_media_assets a
    WHERE a.organization_id=p_org AND a.public_url=v_block->>'url'
      AND a.mime_type IN ('image/png','image/jpeg','image/webp')
   ) THEN RAISE EXCEPTION 'Use a bank-approved image from Brand & media'; END IF;
  END IF;
  IF v_type='shape' THEN
   IF coalesce(v_block->>'shape','') NOT IN ('banner','pill','panel','rule','rectangle','circle')
    OR coalesce(v_block->>'color','') !~ '^#[0-9a-fA-F]{6}$'
   THEN RAISE EXCEPTION 'Invalid shape style'; END IF;
   FOREACH v_field IN ARRAY ARRAY['textColor','borderColor'] LOOP
    IF v_block ? v_field AND (jsonb_typeof(v_block->v_field) IS DISTINCT FROM 'string'
     OR (v_block->>v_field) !~ '^#[0-9a-fA-F]{6}$')
    THEN RAISE EXCEPTION 'Invalid shape color'; END IF;
   END LOOP;
   IF v_block ? 'align' AND (jsonb_typeof(v_block->'align') IS DISTINCT FROM 'string'
    OR coalesce(v_block->>'align','') NOT IN ('left','center','right'))
   THEN RAISE EXCEPTION 'Invalid shape alignment'; END IF;
   FOREACH v_field IN ARRAY ARRAY['borderWidth','padding','widthPercent','minHeight','fontSize'] LOOP
    IF v_block ? v_field THEN
     IF jsonb_typeof(v_block->v_field) IS DISTINCT FROM 'number'
     THEN RAISE EXCEPTION 'Invalid shape size'; END IF;
     v_number:=(v_block->>v_field)::numeric;
     IF v_number<>trunc(v_number) OR v_number<0
      OR (v_field='borderWidth' AND v_number>12)
      OR (v_field='padding' AND v_number>64)
      OR (v_field='widthPercent' AND (v_number<25 OR v_number>100))
      OR (v_field='minHeight' AND v_number>400)
      OR (v_field='fontSize' AND (v_number<12 OR v_number>48))
     THEN RAISE EXCEPTION 'Invalid shape size';END IF;
    END IF;
   END LOOP;
  END IF;
 END LOOP;

 -- Preserve approved merge fields and block unknown placeholders.
 FOR v_text IN
  SELECT p_subject
  UNION ALL SELECT coalesce(p_preheader,'')
  UNION ALL SELECT b->>'text' FROM jsonb_array_elements(p_design->'blocks') b
 LOOP
  IF regexp_replace(v_text,'\{\{[[:space:]]*(first_name|last_name|email|company_name|attributes\.[a-z][a-z0-9_]{0,39})[[:space:]]*\}\}','','g') ~ '\{\{|\}\}'
    OR v_text ~ 'attributes\.(constructor|prototype)'
  THEN RAISE EXCEPTION 'Unsupported personalization'; END IF;
 END LOOP;

 IF p_sender IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.sender_identities
   WHERE id=p_sender AND organization_id=p_org AND is_active
 ) THEN RAISE EXCEPTION 'Sender unavailable'; END IF;
 IF p_type IS NULL OR p_type NOT IN ('all','list','segment')
   OR (p_type='all' AND p_audience IS NOT NULL)
   OR (p_type<>'all' AND p_audience IS NULL)
 THEN RAISE EXCEPTION 'Invalid audience'; END IF;
 PERFORM public.campaign_audience_count(p_org,p_type,p_audience);
 IF p_requested IS NOT NULL AND p_requested<=now() THEN
  RAISE EXCEPTION 'Requested send time must be in the future'; END IF;

 IF p_id IS NULL THEN
  INSERT INTO public.campaign_drafts(
   organization_id,name,subject,preheader,design,sender_id,audience_type,audience_id,requested_send_at,edited_by
  ) VALUES (
   p_org,trim(p_name),trim(p_subject),coalesce(p_preheader,''),p_design,
   p_sender,p_type,p_audience,p_requested,auth.uid()
  ) RETURNING * INTO v_row;
 ELSE
  SELECT * INTO v_row FROM public.campaign_drafts
   WHERE id=p_id AND organization_id=p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign unavailable';END IF;
  IF v_row.revision IS DISTINCT FROM p_expected THEN
   RAISE EXCEPTION 'Campaign changed. Reload before saving'; END IF;
  IF v_row.status IN ('pending_approval','archived') THEN
   RAISE EXCEPTION 'Return the campaign to draft before editing'; END IF;
  UPDATE public.campaign_drafts SET
   name=trim(p_name),subject=trim(p_subject),preheader=coalesce(p_preheader,''),
   design=p_design,sender_id=p_sender,audience_type=p_type,audience_id=p_audience,
   requested_send_at=p_requested,status='draft',revision=revision+1,
   edited_by=auth.uid(),submitted_by=NULL,reviewed_by=NULL,review_note='',
   eligible_at_review=NULL,updated_at=now()
  WHERE id=p_id RETURNING * INTO v_row;
 END IF;
 v_id:=v_row.id;
 INSERT INTO public.campaign_revisions(organization_id,campaign_id,revision,snapshot,actor_id)
 VALUES(p_org,v_id,v_row.revision,to_jsonb(v_row),auth.uid());
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'campaign.saved','campaign',v_id::text);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.campaign_save(uuid,uuid,integer,text,text,text,jsonb,uuid,text,uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campaign_save(uuid,uuid,integer,text,text,text,jsonb,uuid,text,uuid,timestamptz) TO authenticated;
COMMENT ON FUNCTION public.campaign_save(uuid,uuid,integer,text,text,text,jsonb,uuid,text,uuid,timestamptz)
 IS 'Charis 044: secure campaign saving supports all six Campaign Studio block types; preserve permission, consent, revisions';
COMMIT;
-- Reload PostgREST function definitions after successful installation.
NOTIFY pgrst, 'reload schema';
