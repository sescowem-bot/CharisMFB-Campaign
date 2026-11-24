-- ============================================================
-- CHARIS MFB CAMPAIGN
-- MIGRATION 048: SAFE CONTACT DELETION AND BULK SELECTION
-- ============================================================
-- Adds a per-customer bulk operation so one protected customer
-- does not cancel the entire selection.
-- Existing archive/delete safeguards and audit logging remain
-- enforced by the existing contact-management functions.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.charis_bulk_contacts_safe(
  p_org uuid,
  p_contacts uuid[],
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_customer uuid;
  v_result jsonb := '[]'::jsonb;
  v_succeeded integer := 0;
  v_failed integer := 0;
  v_message text;
BEGIN
  IF NOT public.can_manage_contacts(p_org) THEN
    RAISE EXCEPTION 'Not authorised to manage customers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id=p_org AND status='active'
  ) THEN
    RAISE EXCEPTION 'Workspace is unavailable';
  END IF;

  IF coalesce(array_length(p_contacts,1),0) NOT BETWEEN 1 AND 100
     OR p_action NOT IN ('archive','delete') THEN
    RAISE EXCEPTION 'Invalid selection';
  END IF;

  IF array_length(p_contacts,1) <>
     (SELECT count(DISTINCT x) FROM unnest(p_contacts) x) THEN
    RAISE EXCEPTION 'Duplicate customer selection';
  END IF;

  IF (SELECT count(*) FROM public.contacts
      WHERE organization_id=p_org AND id=ANY(p_contacts))
      <> array_length(p_contacts,1) THEN
    RAISE EXCEPTION 'Some selected customers are no longer available';
  END IF;

  FOREACH v_customer IN ARRAY p_contacts LOOP
    BEGIN
      IF p_action='archive' THEN
        PERFORM public.charis_contact_archive(p_org,v_customer,true);
      ELSE
        PERFORM public.charis_contact_delete(p_org,v_customer);
      END IF;

      v_succeeded := v_succeeded + 1;
      v_result := v_result || jsonb_build_array(
        jsonb_build_object('id',v_customer,'success',true)
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;

      -- Return safe, staff-friendly guidance only. Never expose SQL,
      -- database object names, provider messages or backend details.
      IF SQLERRM ILIKE '%delivery history%'
         OR SQLERRM ILIKE '%approved campaign%'
         OR SQLERRM ILIKE '%submitted/approved campaign%' THEN
        v_message := 'This customer has campaign history and cannot be permanently deleted. Archive the customer instead.';
      ELSIF SQLERRM ILIKE '%not found%' THEN
        v_message := 'This customer is no longer available. Refresh the list and try again.';
      ELSE
        v_message := CASE WHEN p_action='archive' THEN 'This customer could not be archived. Please refresh and try again or contact your administrator.' ELSE 'This customer could not be deleted. Please try archiving the customer or contact your administrator.' END;
      END IF;

      v_result := v_result || jsonb_build_array(
        jsonb_build_object('id',v_customer,'success',false,'message',v_message)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'requested',array_length(p_contacts,1),
    'succeeded',v_succeeded,
    'failed',v_failed,
    'results',v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.charis_bulk_contacts_safe(uuid,uuid[],text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.charis_bulk_contacts_safe(uuid,uuid[],text)
  TO authenticated;

COMMIT;
