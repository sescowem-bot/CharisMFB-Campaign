-- Charis 086: administrator-only Zoho Campaigns contact inventory and reconciliation.
-- Additive. Does not delete Zoho lists or overwrite existing consent decisions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.charis_zoho_contact_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  zoho_list_key text NOT NULL,
  name text NOT NULL,
  contact_count integer NOT NULL DEFAULT 0 CHECK (contact_count >= 0),
  lock_status text NOT NULL DEFAULT 'unknown',
  is_public boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, zoho_list_key)
);

CREATE TABLE IF NOT EXISTS public.charis_zoho_contact_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  zoho_list_count integer NOT NULL DEFAULT 0,
  zoho_contact_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  suppressed_count integer NOT NULL DEFAULT 0,
  membership_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_summary text
);

CREATE TABLE IF NOT EXISTS public.charis_zoho_contact_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) <= 254),
  zoho_list_key text NOT NULL,
  zoho_contact_id text,
  zoho_status text NOT NULL CHECK (zoho_status IN ('active','unsubscribe','bounce','complaint')),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, zoho_list_key, email),
  FOREIGN KEY (organization_id, contact_id)
    REFERENCES public.contacts(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS charis_zoho_memberships_org_status_idx
  ON public.charis_zoho_contact_memberships(organization_id, zoho_status);
CREATE INDEX IF NOT EXISTS charis_zoho_memberships_org_email_idx
  ON public.charis_zoho_contact_memberships(organization_id, email);

CREATE TABLE IF NOT EXISTS public.charis_zoho_consent_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attested_by uuid REFERENCES auth.users(id),
  evidence_reference text NOT NULL CHECK (length(btrim(evidence_reference)) BETWEEN 8 AND 200),
  permission_scope text NOT NULL CHECK (permission_scope IN ('all_marketing','product_specific')),
  product_name text,
  contact_count integer NOT NULL DEFAULT 0 CHECK (contact_count >= 0),
  attested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS charis_zoho_lists_org_name_idx
  ON public.charis_zoho_contact_lists(organization_id, name);
CREATE INDEX IF NOT EXISTS charis_zoho_sync_runs_org_started_idx
  ON public.charis_zoho_contact_sync_runs(organization_id, started_at DESC);

ALTER TABLE public.charis_zoho_contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_zoho_contact_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_zoho_contact_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_zoho_consent_attestations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.charis_zoho_contact_lists FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.charis_zoho_contact_sync_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.charis_zoho_contact_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.charis_zoho_consent_attestations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.charis_zoho_contact_lists TO service_role;
GRANT ALL ON public.charis_zoho_contact_sync_runs TO service_role;
GRANT ALL ON public.charis_zoho_contact_memberships TO service_role;
GRANT ALL ON public.charis_zoho_consent_attestations TO service_role;

COMMIT;
