-- Charis 060: authenticated direct-delivery events, race reconciliation, worker health.
-- Prerequisites: 009, 025, 043, 047, 049, 050, 051, 055, 056 installed.
-- Additive; no campaigns, customers or delivery outcomes are deleted.
BEGIN;

ALTER TABLE public.charis_direct_recipients
 DROP CONSTRAINT IF EXISTS charis_direct_recipients_status_check;
ALTER TABLE public.charis_direct_recipients
 ADD CONSTRAINT charis_direct_recipients_status_check CHECK (
 status IN ('pending','sending','accepted','delivered','failed','unknown','skipped',
            'bounced','complained','unsubscribed','blocked'));
CREATE INDEX IF NOT EXISTS charis_direct_provider_message_060
 ON public.charis_direct_recipients(provider,provider_message_id)
 WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.charis_direct_delivery_events_060 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider text NOT NULL CHECK (provider IN ('resend','brevo','mailjet')),
 event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 200),
 provider_message_id text NOT NULL CHECK (length(provider_message_id) BETWEEN 1 AND 300),
 event_type text NOT NULL CHECK (event_type IN ('accepted','delivered','failed','bounce',
     'complaint','blocked','unsubscribe','delayed','opened','clicked')),
 occurred_at timestamptz NOT NULL,
 recipient_id uuid REFERENCES public.charis_direct_recipients(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,event_key)
);
CREATE INDEX IF NOT EXISTS charis_direct_events_match_060
 ON public.charis_direct_delivery_events_060(provider,provider_message_id,occurred_at);
ALTER TABLE public.charis_direct_delivery_events_060 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_direct_delivery_events_060 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.charis_direct_delivery_events_060 TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.charis_direct_delivery_events_060_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.charis_worker_health_060 (
 id boolean PRIMARY KEY DEFAULT true CHECK(id IS TRUE),
 last_success_at timestamptz NOT NULL,
 last_direct_processed integer NOT NULL DEFAULT 0,
 last_legacy_processed integer NOT NULL DEFAULT 0
);
ALTER TABLE public.charis_worker_health_060 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_worker_health_060 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.charis_worker_health_060 TO service_role;

CREATE OR REPLACE FUNCTION public.charis_worker_heartbeat_060(p_processed integer,p_legacy integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role only'; END IF;
 IF p_processed NOT BETWEEN 0 AND 6 OR p_legacy NOT BETWEEN 0 AND 1000 THEN
  RAISE EXCEPTION 'Invalid heartbeat counts'; END IF;
 INSERT INTO public.charis_worker_health_060(id,last_success_at,last_direct_processed,last_legacy_processed)
 VALUES(true,now(),p_processed,p_legacy)
 ON CONFLICT(id) DO UPDATE SET last_success_at=excluded.last_success_at,
 last_direct_processed=excluded.last_direct_processed,
 last_legacy_processed=excluded.last_legacy_processed;
END;$$;
REVOKE ALL ON FUNCTION public.charis_worker_heartbeat_060(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_worker_heartbeat_060(integer,integer) TO service_role;

-- The provider webhook has already been cryptographically authenticated at its API route.
-- Only the service-role client is permitted to record/affect direct deliveries.
CREATE OR REPLACE FUNCTION public.charis_direct_event_060(
 p_provider text,p_key text,p_message text,p_type text,p_time timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_message text;v_rec public.charis_direct_recipients;v_event bigint;v_has_later_consent boolean;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role only'; END IF;
 IF p_provider NOT IN ('resend','brevo','mailjet') OR p_type NOT IN
 ('accepted','delivered','failed','bounce','complaint','blocked','unsubscribe','delayed','opened','clicked')
 OR p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 200
 OR p_message IS NULL OR length(p_message) NOT BETWEEN 1 AND 300
 OR p_time IS NULL OR p_time>now()+interval '1 day' THEN
  RAISE EXCEPTION 'Invalid verified provider event'; END IF;
 v_message:=trim(both '<>' from p_message);
 INSERT INTO public.charis_direct_delivery_events_060(provider,event_key,provider_message_id,event_type,occurred_at)
 VALUES(p_provider,p_key,v_message,p_type,p_time)
 ON CONFLICT(provider,event_key) DO NOTHING;
 -- An event arriving before the API response is durably saved for later reconciliation.
 SELECT r.* INTO v_rec FROM public.charis_direct_recipients r
 WHERE r.provider=p_provider AND r.provider_message_id=v_message
 ORDER BY r.created_at LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT e.id INTO v_event FROM public.charis_direct_delivery_events_060 e
 WHERE e.provider=p_provider AND e.event_key=p_key
 AND e.provider_message_id=v_message AND e.event_type=p_type;
 IF v_event IS NULL THEN RETURN; END IF;
 UPDATE public.charis_direct_delivery_events_060 SET recipient_id=v_rec.id
 WHERE id=v_event AND (recipient_id IS NULL OR recipient_id=v_rec.id);
 -- Terminal negative outcomes are retained; duplicate or out-of-order 'delivered' cannot undo them.
 IF p_type IN ('bounce','complaint','blocked','unsubscribe') THEN
  UPDATE public.charis_direct_recipients SET
   status=CASE p_type WHEN 'bounce' THEN 'bounced' WHEN 'complaint' THEN 'complained'
   WHEN 'blocked' THEN 'blocked' ELSE 'unsubscribed' END,
   error_code=left(p_type,140),updated_at=now()
  WHERE id=v_rec.id AND status NOT IN ('bounced','complained','blocked','unsubscribed');
  -- Do not undo a later, verified re-subscription because an old event was delayed.
  SELECT EXISTS(SELECT 1 FROM public.contacts c WHERE c.organization_id=v_rec.organization_id
   AND c.id=v_rec.contact_id AND c.consent_status='granted'
   AND c.consent_recorded_at>p_time) INTO v_has_later_consent;
  IF p_type<>'unsubscribe' OR NOT v_has_later_consent THEN
   INSERT INTO public.email_suppressions(organization_id,email,reason)
   VALUES(v_rec.organization_id,lower(v_rec.recipient_email),
    CASE WHEN p_type='bounce' THEN 'bounce' WHEN p_type='complaint' THEN 'complaint'
     WHEN p_type='blocked' THEN 'blocked' ELSE 'unsubscribe' END)
   ON CONFLICT(organization_id,email) DO UPDATE SET
    reason=CASE WHEN public.email_suppressions.reason IN ('bounce','complaint','blocked')
       THEN public.email_suppressions.reason ELSE excluded.reason END
    WHERE excluded.reason IN ('bounce','complaint','blocked');
   IF p_type='unsubscribe' THEN
    UPDATE public.contacts SET consent_status='denied',
     unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now()
    WHERE organization_id=v_rec.organization_id AND id=v_rec.contact_id;
   END IF;
  END IF;
 ELSIF p_type='delivered' THEN
  UPDATE public.charis_direct_recipients SET status='delivered',error_code=NULL,updated_at=now()
  WHERE id=v_rec.id AND status IN ('accepted','unknown');
 ELSIF p_type='failed' THEN
  UPDATE public.charis_direct_recipients SET status='failed',error_code='provider_failed',updated_at=now()
  WHERE id=v_rec.id AND status IN ('accepted','unknown');
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_event_060(text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_direct_event_060(text,text,text,text,timestamptz) TO service_role;

-- For the race where the webhook arrived before the provider message ID was recorded.
CREATE OR REPLACE FUNCTION public.charis_direct_reconcile_060(p_recipient uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rec public.charis_direct_recipients;ev record;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role only'; END IF;
 SELECT * INTO v_rec FROM public.charis_direct_recipients WHERE id=p_recipient FOR UPDATE;
 IF NOT FOUND OR v_rec.provider_message_id IS NULL OR v_rec.provider NOT IN ('resend','brevo','mailjet') THEN RETURN; END IF;
 FOR ev IN SELECT provider,event_key,provider_message_id,event_type,occurred_at
  FROM public.charis_direct_delivery_events_060 WHERE provider=v_rec.provider
  AND provider_message_id=v_rec.provider_message_id
  ORDER BY occurred_at,id LOOP
  PERFORM public.charis_direct_event_060(ev.provider,ev.event_key,ev.provider_message_id,ev.event_type,ev.occurred_at);
 END LOOP;
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_reconcile_060(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_direct_reconcile_060(uuid) TO service_role;

-- If the worker lost its network connection after saving provider acceptance,
-- replay orphaned webhooks on a subsequent invocation, without resending mail.
CREATE OR REPLACE FUNCTION public.charis_direct_reconcile_pending_060(p_limit integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rec record;v_count integer:=0;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Service role only'; END IF;
 IF p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid reconciliation limit'; END IF;
 FOR rec IN
  SELECT DISTINCT r.id FROM public.charis_direct_recipients r
  JOIN public.charis_direct_delivery_events_060 e ON e.provider=r.provider
   AND e.provider_message_id=r.provider_message_id
  WHERE e.recipient_id IS NULL AND r.provider_message_id IS NOT NULL
  LIMIT p_limit
 LOOP
  PERFORM public.charis_direct_reconcile_060(rec.id);
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END;$$;
REVOKE ALL ON FUNCTION public.charis_direct_reconcile_pending_060(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_direct_reconcile_pending_060(integer) TO service_role;


COMMIT;
NOTIFY pgrst, 'reload schema';
