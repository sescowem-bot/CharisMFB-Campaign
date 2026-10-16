-- CHARIS 046 | COMPLETE READ-ONLY ROUTING DIAGNOSTIC
-- Run the ENTIRE statement, beginning with SELECT and ending with a semicolon.
-- Do not select only the CASE/boolean fragment; there is exactly ONE SQL statement.
-- No database changes, provider changes, or messages are sent.
SELECT
  o.slug AS organization,
  r.provider,
  r.enabled AS route_enabled,
  r.allowed_kind,
  r.permission_confirmed,
  s.from_email AS selected_sender,
  s.is_active AS sender_active,
  d.provider AS domain_provider,
  d.verification_status AS domain_verification,
  d.charis_connected,
  (s.id IS NOT NULL) AS sender_found,
  (d.id IS NOT NULL) AS sender_domain_found,
  has_table_privilege('authenticated', 'public.charis_email_routes', 'SELECT') AS routes_read_granted,
  has_table_privilege('authenticated', 'public.sender_identities', 'SELECT') AS senders_read_granted,
  has_table_privilege('authenticated', 'public.sending_domains', 'SELECT') AS domains_read_granted,
  has_table_privilege('authenticated', 'public.charis_email_monthly_budget', 'SELECT') AS budget_read_granted,
  EXISTS (
    SELECT 1 FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'charis_email_monthly_budget'
      AND p.policyname = 'charis_email_budget_admin_read_045'
      AND p.cmd IN ('SELECT', 'ALL')
  ) AS budget_admin_policy_exists
FROM public.organizations AS o
LEFT JOIN public.charis_email_routes AS r
  ON r.organization_id = o.id AND r.provider = 'resend'
LEFT JOIN public.sender_identities AS s
  ON s.organization_id = o.id AND s.id = r.sender_id
LEFT JOIN public.sending_domains AS d
  ON d.organization_id = o.id AND d.id = s.domain_id
WHERE o.slug = 'charis-mfb';
