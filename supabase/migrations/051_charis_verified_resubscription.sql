-- Charis 051: double opt-in, staff delegation, audited subscription recovery.
-- Run AFTER migrations 047, 049 and 050. Additive; never bulk-reactivates contacts.
BEGIN;
CREATE TABLE IF NOT EXISTS public.charis_subscription_staff_access (
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 can_view boolean NOT NULL DEFAULT false,
 can_invite boolean NOT NULL DEFAULT false,
 updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.charis_resubscribe_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL, contact_id uuid NOT NULL,
 email text NOT NULL CHECK(email=lower(btrim(email)) AND length(email)<=254),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 source text NOT NULL CHECK(source IN ('customer','staff')),
 requested_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, verified_at timestamptz,
 delivery_state text NOT NULL DEFAULT 'reserved' CHECK(delivery_state IN ('reserved','accepted','failed','uncertain')),
 FOREIGN KEY(organization_id,contact_id) REFERENCES public.contacts(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_resub_requests_by_email ON public.charis_resubscribe_requests(organization_id,email,created_at DESC);
CREATE TABLE IF NOT EXISTS public.charis_subscription_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 contact_id uuid NOT NULL,
 email text NOT NULL,
 event text NOT NULL CHECK(event IN ('invite_requested','verified_resubscribe','unsubscribe','provider_sync')),
 actor_id uuid REFERENCES auth.users(id), request_id uuid REFERENCES public.charis_resubscribe_requests(id),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.charis_subscription_sync (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 email text NOT NULL,
 desired_unsubscribed boolean NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','synced','error','not_found')),
 updated_at timestamptz NOT NULL DEFAULT now(),synced_at timestamptz,
 PRIMARY KEY(organization_id,email)
);
ALTER TABLE public.charis_subscription_staff_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_resubscribe_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_subscription_sync ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_subscription_staff_access,public.charis_resubscribe_requests,public.charis_subscription_events,public.charis_subscription_sync FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.charis_subscription_can(p_org uuid,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_action IN ('view','invite') AND (
  public.charis_direct_is_admin(p_org) OR (
   EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
    WHERE m.organization_id=p_org AND m.user_id=(SELECT auth.uid()) AND o.status='active')
   AND public.charis_is_bankwide(p_org)
   AND EXISTS(SELECT 1 FROM public.charis_subscription_staff_access a
    WHERE a.organization_id=p_org AND a.user_id=(SELECT auth.uid())
      AND CASE WHEN p_action='invite' THEN a.can_invite ELSE a.can_view OR a.can_invite END)
  )
 );
$$;
REVOKE ALL ON FUNCTION public.charis_subscription_can(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_subscription_can(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.charis_subscription_delegate(p_org uuid,p_user uuid,p_view boolean,p_invite boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.charis_direct_is_admin(p_org) THEN RAISE EXCEPTION 'Administrator permission required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user)
 THEN RAISE EXCEPTION 'Staff member is not in this bank'; END IF;
 INSERT INTO public.charis_subscription_staff_access(organization_id,user_id,can_view,can_invite,updated_by)
 VALUES(p_org,p_user,coalesce(p_view,false) OR coalesce(p_invite,false),coalesce(p_invite,false),auth.uid())
 ON CONFLICT(organization_id,user_id) DO UPDATE SET can_view=excluded.can_view,can_invite=excluded.can_invite,
 updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'subscription.staff_access_changed','staff',p_user::text,
 jsonb_build_object('can_view',p_view,'can_invite',p_invite));
END;$$;
REVOKE ALL ON FUNCTION public.charis_subscription_delegate(uuid,uuid,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_subscription_delegate(uuid,uuid,boolean,boolean) TO authenticated;

-- Service-role-only reservation: no public write access, maximum 1 per 30 min and 3 per 24h.
CREATE OR REPLACE FUNCTION public.charis_subscription_issue(p_org uuid,p_email text,p_hash text,p_source text,p_actor uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_contact uuid;v_id uuid;v_email text:=lower(btrim(coalesce(p_email,'')));
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server operation only'; END IF;
 IF p_hash !~ '^[0-9a-f]{64}$' OR p_source NOT IN ('customer','staff') OR length(v_email)>254
  OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RETURN NULL; END IF;
 SELECT c.id INTO v_contact FROM public.contacts c
  WHERE c.organization_id=p_org AND c.email=v_email AND c.archived_at IS NULL;
 IF v_contact IS NULL THEN RETURN NULL; END IF;
 -- Never allow a delivery bounce, complaint or block to be cleared by email verification.
 IF EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.organization_id=p_org
  AND s.email=v_email AND s.reason IN ('bounce','complaint','blocked')) THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text || ':' || v_email,51));
 IF EXISTS(SELECT 1 FROM public.charis_resubscribe_requests r WHERE r.organization_id=p_org AND r.email=v_email
  AND r.created_at>now()-interval '30 minutes') OR
  (SELECT count(*) FROM public.charis_resubscribe_requests r WHERE r.organization_id=p_org AND r.email=v_email
   AND r.created_at>now()-interval '24 hours')>=3 THEN RETURN NULL; END IF;
 INSERT INTO public.charis_resubscribe_requests(organization_id,contact_id,email,token_hash,source,requested_by,expires_at)
 VALUES(p_org,v_contact,v_email,p_hash,p_source,p_actor,now()+interval '30 minutes') RETURNING id INTO v_id;
 INSERT INTO public.charis_subscription_events(organization_id,contact_id,email,event,actor_id,request_id)
 VALUES(p_org,v_contact,v_email,'invite_requested',p_actor,v_id);
 RETURN v_id;
END;$$;
REVOKE ALL ON FUNCTION public.charis_subscription_issue(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_subscription_issue(uuid,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.charis_subscription_confirm(p_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.charis_resubscribe_requests;v_now timestamptz:=now();
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server operation only'; END IF;
 IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid'; END IF;
 SELECT * INTO r FROM public.charis_resubscribe_requests WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN 'invalid'; END IF;
 IF r.verified_at IS NOT NULL THEN RETURN 'done'; END IF;
 IF r.expires_at<v_now THEN RETURN 'expired'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.organization_id::text || ':' || r.email,51));
 IF NOT EXISTS(SELECT 1 FROM public.contacts c WHERE c.organization_id=r.organization_id AND c.id=r.contact_id AND c.email=r.email AND c.archived_at IS NULL) THEN RETURN 'invalid'; END IF;
 IF EXISTS(SELECT 1 FROM public.email_suppressions s WHERE s.organization_id=r.organization_id AND s.email=r.email AND s.reason <> 'unsubscribe') THEN RETURN 'blocked'; END IF;
 DELETE FROM public.charis_optional_email_optouts WHERE organization_id=r.organization_id AND email=r.email;
 DELETE FROM public.email_suppressions WHERE organization_id=r.organization_id AND email=r.email AND reason='unsubscribe';
 UPDATE public.contacts SET consent_status='granted',unsubscribed_at=NULL,
  consent_evidence='Verified customer email resubscription request ' || r.id::text,
  consent_recorded_at=v_now,updated_at=v_now
 WHERE organization_id=r.organization_id AND id=r.contact_id AND email=r.email;
 UPDATE public.charis_resubscribe_requests SET verified_at=v_now WHERE id=r.id;
 INSERT INTO public.charis_subscription_events(organization_id,contact_id,email,event,request_id)
 VALUES(r.organization_id,r.contact_id,r.email,'verified_resubscribe',r.id);
 INSERT INTO public.charis_subscription_sync(organization_id,email,desired_unsubscribed,revision,status)
 VALUES(r.organization_id,r.email,false,1,'pending')
 ON CONFLICT(organization_id,email) DO UPDATE SET desired_unsubscribed=false,
 revision=public.charis_subscription_sync.revision+1,status='pending',synced_at=NULL,updated_at=v_now;
 -- Stop obsolete Release 050 opt-out sync tasks after verified resubscription.
 UPDATE public.charis_email_preference_tokens SET resend_sync_status='synced'
 WHERE organization_id=r.organization_id AND email=r.email AND used_at IS NOT NULL
  AND resend_sync_status IN ('pending','error');
 RETURN 'done';
END;$$;
REVOKE ALL ON FUNCTION public.charis_subscription_confirm(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_subscription_confirm(text) TO service_role;

-- Extend the Release 050 opt-out function so the most recent choice wins during provider sync.
CREATE OR REPLACE FUNCTION public.charis_customer_email_optout(p_token_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_link record;v_email text;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server operation only'; END IF;
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid'; END IF;
 SELECT l.organization_id,l.contact_id,l.email,l.expires_at,l.used_at INTO v_link
 FROM public.charis_email_preference_tokens l WHERE l.token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN 'invalid'; END IF;
 IF v_link.used_at IS NOT NULL THEN RETURN 'done'; END IF;
 IF v_link.expires_at<now() THEN RETURN 'expired'; END IF;
 SELECT c.email INTO v_email FROM public.contacts c WHERE c.organization_id=v_link.organization_id AND c.id=v_link.contact_id;
 IF NOT FOUND OR v_email IS DISTINCT FROM v_link.email THEN RETURN 'invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_link.organization_id::text || ':' || v_link.email,51));
 INSERT INTO public.charis_optional_email_optouts(organization_id,email) VALUES(v_link.organization_id,v_link.email)
 ON CONFLICT(organization_id,email) DO NOTHING;
 INSERT INTO public.email_suppressions(organization_id,email,reason) VALUES(v_link.organization_id,v_link.email,'unsubscribe')
 ON CONFLICT(organization_id,email) DO NOTHING;
 UPDATE public.contacts SET consent_status='denied',unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now()
 WHERE organization_id=v_link.organization_id AND id=v_link.contact_id AND email=v_link.email;
 UPDATE public.charis_email_preference_tokens SET used_at=now() WHERE token_hash=p_token_hash;
 INSERT INTO public.charis_subscription_sync(organization_id,email,desired_unsubscribed,revision,status)
 VALUES(v_link.organization_id,v_link.email,true,1,'pending')
 ON CONFLICT(organization_id,email) DO UPDATE SET desired_unsubscribed=true,
 revision=public.charis_subscription_sync.revision+1,status='pending',synced_at=NULL,updated_at=now();
 INSERT INTO public.charis_subscription_events(organization_id,contact_id,email,event)
 VALUES(v_link.organization_id,v_link.contact_id,v_link.email,'unsubscribe');
 RETURN 'done';
END;$$;
REVOKE ALL ON FUNCTION public.charis_customer_email_optout(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_customer_email_optout(text) TO service_role;

-- Queue earlier optional opt-outs that existed before this release.
INSERT INTO public.charis_subscription_sync(organization_id,email,desired_unsubscribed)
 SELECT o.organization_id,o.email,true FROM public.charis_optional_email_optouts o
 ON CONFLICT(organization_id,email) DO NOTHING;
COMMIT;
NOTIFY pgrst,'reload schema';
