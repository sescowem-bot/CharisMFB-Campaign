-- Charis Campaign Centre | 016 | Secure staff invitations
-- Run once in the EXISTING Charis Supabase SQL Editor after migrations 001-015.
-- No user records or company memberships are deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.team_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 email text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
 role text NOT NULL CHECK (role IN ('company_admin','manager','designer','approver','analyst','viewer')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled')),
 invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 invited_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
 accepted_at timestamptz,
 UNIQUE(organization_id,email)
);
CREATE INDEX IF NOT EXISTS team_invitations_pending_idx ON public.team_invitations(organization_id,expires_at) WHERE status='pending';
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_invitations FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.team_invite_prepare(p_org uuid, p_email text, p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text; v_user_id uuid;
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_org IS NULL OR p_email IS NULL OR p_role IS NULL THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 v_email := lower(btrim(p_email));
 IF length(v_email) NOT BETWEEN 3 AND 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR p_role NOT IN ('company_admin','manager','designer','approver','analyst','viewer') THEN
   RAISE EXCEPTION 'Invalid invitation';
 END IF;
 PERFORM 1 FROM public.organizations WHERE id = p_org AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Charis workspace is not active'; END IF;
 SELECT id INTO v_user_id FROM auth.users WHERE lower(email)=v_email AND email_confirmed_at IS NOT NULL LIMIT 1;
 IF v_user_id IS NOT NULL THEN
   PERFORM public.team_member_save(p_org,v_email,p_role);
   UPDATE public.team_invitations SET status='accepted',accepted_at=now()
    WHERE organization_id=p_org AND email=v_email AND status='pending';
   RETURN 'member_added';
 END IF;
 INSERT INTO public.team_invitations(organization_id,email,role,invited_by)
 VALUES(p_org,v_email,p_role,auth.uid())
 ON CONFLICT(organization_id,email) DO UPDATE
 SET role=EXCLUDED.role,status='pending',invited_by=auth.uid(),invited_at=now(),
     expires_at=now()+interval '7 days',accepted_at=NULL;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
 VALUES(p_org,auth.uid(),'team.invitation_prepared','invitation',v_email,jsonb_build_object('role',p_role));
 RETURN 'invitation_pending';
END $$;
REVOKE ALL ON FUNCTION public.team_invite_prepare(uuid,text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.team_invite_prepare(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.team_invitation_list(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v jsonb;
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,
  'expires_at',i.expires_at,'invited_at',i.invited_at) ORDER BY i.invited_at DESC),'[]'::jsonb)
 INTO v FROM public.team_invitations i
 WHERE i.organization_id=p_org AND i.status='pending' AND i.expires_at>now();
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.team_invitation_list(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.team_invitation_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.team_invitation_cancel(p_org uuid, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.can_manage_team(p_org) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.team_invitations SET status='cancelled'
 WHERE id=p_id AND organization_id=p_org AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending invitation not found'; END IF;
 INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
 VALUES(p_org,auth.uid(),'team.invitation_cancelled','invitation',p_id::text);
END $$;
REVOKE ALL ON FUNCTION public.team_invitation_cancel(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.team_invitation_cancel(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.team_invitation_accept()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_email text; v_confirmed timestamptz; v_inv record; v_total integer := 0;
BEGIN
 v_id := auth.uid();
 IF v_id IS NULL THEN RETURN 0; END IF;
 SELECT lower(email),email_confirmed_at INTO v_email,v_confirmed FROM auth.users WHERE id=v_id;
 IF v_email IS NULL OR v_confirmed IS NULL THEN RETURN 0; END IF;
 FOR v_inv IN
  SELECT i.* FROM public.team_invitations i JOIN public.organizations o ON o.id=i.organization_id
  WHERE i.email=v_email AND i.status='pending' AND i.expires_at>now() AND o.status='active'
  FOR UPDATE OF i
 LOOP
  -- Never overwrite an existing member's role through an old invitation.
  INSERT INTO public.organization_members(organization_id,user_id,role)
  VALUES(v_inv.organization_id,v_id,v_inv.role)
  ON CONFLICT(organization_id,user_id) DO NOTHING;
  UPDATE public.team_invitations SET status='accepted',accepted_at=now() WHERE id=v_inv.id;
  INSERT INTO public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  VALUES(v_inv.organization_id,v_id,'team.invitation_accepted','invitation',v_inv.id::text,jsonb_build_object('role',v_inv.role));
  v_total:=v_total+1;
 END LOOP;
 RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.team_invitation_accept() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.team_invitation_accept() TO authenticated;
COMMIT;
