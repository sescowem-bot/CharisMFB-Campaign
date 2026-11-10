-- 085: Zoho campaign reporting, event ingestion and suppressions.
-- Additive only. Run after 084_charis_zoho_broadcasts.sql.
BEGIN;

ALTER TABLE public.charis_zoho_broadcasts
    ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bounced_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS clicked_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unsubscribed_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS send_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS public.charis_zoho_email_suppressions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    reason text NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'admin')),
    source text NOT NULL DEFAULT 'zoho',
    zoho_list_key text,
    broadcast_id uuid REFERENCES public.charis_zoho_broadcasts(id) ON DELETE SET NULL,
    suppressed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT charis_zoho_suppression_email_format
        CHECK (email = lower(trim(email)) AND position('@' IN email) > 1),
    CONSTRAINT charis_zoho_suppression_unique UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS public.charis_zoho_email_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    broadcast_id uuid REFERENCES public.charis_zoho_broadcasts(id) ON DELETE SET NULL,
    event_key text NOT NULL,
    event_type text NOT NULL CHECK (event_type IN (
        'subscribe', 'unsubscribe', 'bounce', 'complaint',
        'campaign_sent', 'campaign_status', 'open', 'click', 'unknown'
    )),
    email text,
    zoho_list_key text,
    zoho_campaign_key text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    processed boolean NOT NULL DEFAULT false,
    processed_at timestamptz,
    processing_error text,
    received_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT charis_zoho_event_key_unique UNIQUE (event_key)
);

CREATE INDEX IF NOT EXISTS charis_zoho_suppressions_org_email_idx
    ON public.charis_zoho_email_suppressions (organization_id, email);
CREATE INDEX IF NOT EXISTS charis_zoho_events_org_received_idx
    ON public.charis_zoho_email_events (organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS charis_zoho_events_unprocessed_idx
    ON public.charis_zoho_email_events (received_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS charis_zoho_broadcasts_org_sent_idx
    ON public.charis_zoho_broadcasts (organization_id, sent_at DESC);

ALTER TABLE public.charis_zoho_email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charis_zoho_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charis_zoho_email_suppressions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.charis_zoho_email_events FROM PUBLIC, anon, authenticated;

COMMIT;
