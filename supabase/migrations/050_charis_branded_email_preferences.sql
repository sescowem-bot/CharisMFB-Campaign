-- Charis 050: secure self-hosted email preferences for direct service messages.
-- Marketing Broadcasts retain Resend-managed one-click unsubscribe handling.
-- Requires Charis 047. Additive: no customer rows or old campaign data removed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.charis_email_preference_tokens (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 contact_id uuid NOT NULL,
 email text NOT NULL CHECK (length(email) <= 254 AND email = lower(btrim(email))),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 used_at timestamptz,
 resend_synced_at timestamptz,
 resend_sync_status text NOT NULL DEFAULT 'pending' CHECK(resend_sync_status IN ('pending','synced','not_found','error')),
 FOREIGN KEY (organization_id,contact_id) REFERENCES public.contacts(organization_id,id)
);
CREATE INDEX IF NOT EXISTS charis_preference_token_expiry ON public.charis_email_preference_tokens(expires_at);
CREATE INDEX IF NOT EXISTS charis_preference_contact ON public.charis_email_preference_tokens(organization_id,contact_id);
ALTER TABLE public.charis_email_preference_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_email_preference_tokens FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.charis_optional_email_optouts (
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 email text NOT NULL CHECK (length(email)<=254 AND email = lower(btrim(email))),
 opted_out_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id,email)
);
ALTER TABLE public.charis_optional_email_optouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_optional_email_optouts FROM PUBLIC,anon,authenticated;

-- Service-role only, using hashed unguessable tokens. Row lock makes repeat clicks idempotent.
-- A successful opt-out removes the recipient from future optional + promotional lists.
-- Essential bank service/account updates can still be sent when legitimately required.
CREATE OR REPLACE FUNCTION public.charis_customer_email_optout(p_token_hash text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_link record; v_email text;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Service role only'; END IF;
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN 'invalid'; END IF;
 SELECT l.organization_id,l.contact_id,l.email,l.expires_at,l.used_at
 INTO v_link FROM public.charis_email_preference_tokens l
 WHERE l.token_hash = p_token_hash FOR UPDATE;
 IF NOT FOUND THEN RETURN 'invalid'; END IF;
 IF v_link.used_at IS NOT NULL THEN RETURN 'done'; END IF;
 IF v_link.expires_at < now() THEN RETURN 'expired'; END IF;
 SELECT c.email INTO v_email FROM public.contacts c
 WHERE c.organization_id=v_link.organization_id AND c.id=v_link.contact_id;
 IF NOT FOUND OR v_email IS NULL OR v_email <> v_link.email THEN RETURN 'invalid'; END IF;
 INSERT INTO public.charis_optional_email_optouts(organization_id,email)
 VALUES(v_link.organization_id,v_link.email)
 ON CONFLICT (organization_id,email) DO NOTHING;
 -- Promotions must not be sent after a preference change. Preserve any existing
 -- bounce/complaint reason rather than disguising a delivery block as an opt-out.
 INSERT INTO public.email_suppressions(organization_id,email,reason)
 VALUES(v_link.organization_id,v_link.email,'unsubscribe')
 ON CONFLICT(organization_id,email) DO NOTHING;
 UPDATE public.contacts
 SET consent_status='denied',unsubscribed_at=coalesce(unsubscribed_at,now()),updated_at=now()
 WHERE organization_id=v_link.organization_id AND id=v_link.contact_id AND email=v_link.email;
 UPDATE public.charis_email_preference_tokens SET used_at=now() WHERE token_hash=p_token_hash;
 RETURN 'done';
END;
$$;
REVOKE ALL ON FUNCTION public.charis_customer_email_optout(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.charis_customer_email_optout(text) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
