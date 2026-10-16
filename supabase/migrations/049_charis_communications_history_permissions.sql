-- 049: communication-history controls. Run after 047.
-- No email/SMS delivery, existing communication, or contact is deleted by this migration.
BEGIN;
ALTER TABLE public.charis_direct_staff_rules
 ADD COLUMN IF NOT EXISTS can_manage_history boolean NOT NULL DEFAULT false;
ALTER TABLE public.charis_direct_messages
 ADD COLUMN IF NOT EXISTS archived_at timestamptz,
 ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS charis_direct_visible_history_idx
 ON public.charis_direct_messages(organization_id,created_at DESC)
 WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.charis_direct_can_manage_history(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.charis_direct_is_admin(p_org) OR (
  EXISTS(SELECT 1 FROM public.organization_members m
         JOIN public.organizations o ON o.id=m.organization_id
         WHERE m.organization_id=p_org AND o.slug='charis-mfb' AND o.status='active'
           AND m.user_id=(SELECT auth.uid()))
  AND EXISTS(SELECT 1 FROM public.charis_direct_staff_rules r
             WHERE r.organization_id=p_org AND r.user_id=(SELECT auth.uid())
               AND r.can_manage_history)
 );
$$;
REVOKE ALL ON FUNCTION public.charis_direct_can_manage_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_can_manage_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_direct_history_access_save(p_org uuid,p_user uuid,p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_direct_is_admin(p_org) THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members
               WHERE organization_id=p_org AND user_id=p_user) THEN
  RAISE EXCEPTION 'Staff member unavailable'; END IF;
 INSERT INTO public.charis_direct_staff_rules(organization_id,user_id,can_manage_history,updated_by)
 VALUES(p_org,p_user,p_allowed,auth.uid())
 ON CONFLICT(organization_id,user_id) DO UPDATE SET
 can_manage_history=EXCLUDED.can_manage_history,updated_by=EXCLUDED.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'direct.history_permission_updated','staff',p_user::text,
        jsonb_build_object('can_manage_history',p_allowed));
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_history_access_save(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_history_access_save(uuid,uuid,boolean) TO authenticated;

-- Archive is a UI-only removal. Never erase sent or uncertain delivery evidence.
-- Permanent deletion is restricted to an unapproved, completely unsent message.
CREATE OR REPLACE FUNCTION public.charis_direct_history_manage(p_org uuid,p_message uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_archived timestamptz;
BEGIN
 IF NOT public.charis_direct_can_manage_history(p_org) THEN
  RAISE EXCEPTION 'Message history management permission required'; END IF;
 IF p_action NOT IN ('archive','restore','delete_unsent') THEN
  RAISE EXCEPTION 'Invalid history action'; END IF;
 SELECT status,archived_at INTO v_status,v_archived
 FROM public.charis_direct_messages WHERE organization_id=p_org AND id=p_message FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
 IF p_action='archive' THEN
  IF v_status NOT IN ('completed','paused','cancelled') THEN
   RAISE EXCEPTION 'Only finished messages can be archived'; END IF;
  IF v_archived IS NOT NULL THEN RETURN; END IF;
  UPDATE public.charis_direct_messages
   SET archived_at=now(),archived_by=auth.uid(),updated_at=now()
   WHERE organization_id=p_org AND id=p_message;
 ELSIF p_action='restore' THEN
  IF v_archived IS NULL THEN RETURN; END IF;
  UPDATE public.charis_direct_messages
   SET archived_at=NULL,archived_by=NULL,updated_at=now()
   WHERE organization_id=p_org AND id=p_message;
 ELSE
  IF v_status<>'pending_approval' OR v_archived IS NOT NULL OR EXISTS(
   SELECT 1 FROM public.charis_direct_recipients
   WHERE organization_id=p_org AND message_id=p_message AND status<>'pending'
  ) THEN
   RAISE EXCEPTION 'Only unapproved messages with no delivery attempts may be permanently deleted';
  END IF;
  DELETE FROM public.charis_direct_recipients WHERE organization_id=p_org AND message_id=p_message;
  DELETE FROM public.charis_direct_messages WHERE organization_id=p_org AND id=p_message;
 END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'direct.message_'||p_action,'direct_message',p_message::text);
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_history_manage(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_direct_history_manage(uuid,uuid,text) TO authenticated;

DROP POLICY IF EXISTS charis_direct_messages_read ON public.charis_direct_messages;
CREATE POLICY charis_direct_messages_read ON public.charis_direct_messages FOR SELECT TO authenticated
 USING((created_by=(SELECT auth.uid()) AND public.charis_direct_can_send(organization_id))
       OR public.charis_direct_can_manage_history(organization_id));
DROP POLICY IF EXISTS charis_direct_recipients_read ON public.charis_direct_recipients;
CREATE POLICY charis_direct_recipients_read ON public.charis_direct_recipients FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.charis_direct_messages m
              WHERE m.organization_id=charis_direct_recipients.organization_id
                AND m.id=charis_direct_recipients.message_id
                AND ((m.created_by=(SELECT auth.uid()) AND public.charis_direct_can_send(m.organization_id))
                     OR public.charis_direct_can_manage_history(m.organization_id))));
COMMIT;
NOTIFY pgrst, 'reload schema';
