-- CHARIS CAMPAIGN CENTRE - EXISTING DATABASE BRAND CORRECTION
-- Run once in the dedicated Charis Supabase project SQL Editor.
-- Does not delete contacts, campaigns, users or approvals.
BEGIN;
UPDATE public.platform_branding
 SET display_name='Charis Campaign Centre',
 tagline='Secure customer communications for Charis Microfinance Bank',
 primary_color='#12345A',updated_at=now() WHERE id=true;
UPDATE public.organizations SET name='Charis Microfinance Bank', updated_at=now() WHERE slug='charis-mfb';
UPDATE public.organization_branding b SET display_name='Charis Microfinance Bank', tagline='Customer communication, made simple', primary_color='#12345A', secondary_color='#276B99', updated_at=now()
 WHERE b.organization_id=(SELECT id FROM public.organizations WHERE slug='charis-mfb');
-- Only correct site branding fields. Preserve any existing approved logos and contact information.
UPDATE public.site_pages
 SET published=COALESCE(published,'{}'::jsonb)||jsonb_build_object(
    'display_name','Charis Campaign Centre',
    'tagline','Secure customer communications for Charis Microfinance Bank',
    'operator_name','Charis Microfinance Bank',
    'footer_text','For authorised Charis Microfinance Bank staff only.',
    'primary_color','#12345A',
    'nav',jsonb_build_array(jsonb_build_object('label','Home','href','/'),jsonb_build_object('label','Help','href','/faq'))),
 draft=COALESCE(draft,'{}'::jsonb)||jsonb_build_object(
    'display_name','Charis Campaign Centre',
    'tagline','Secure customer communications for Charis Microfinance Bank',
    'operator_name','Charis Microfinance Bank',
    'footer_text','For authorised Charis Microfinance Bank staff only.',
    'primary_color','#12345A',
    'nav',jsonb_build_array(jsonb_build_object('label','Home','href','/'),jsonb_build_object('label','Help','href','/faq')))
 WHERE slug='site';
COMMIT;
SELECT o.id AS charis_organization_id,o.name,b.display_name,
       (SELECT published->>'display_name' FROM public.site_pages WHERE slug='site') AS public_site_name
 FROM public.organizations o
 LEFT JOIN public.organization_branding b ON b.organization_id=o.id
 WHERE o.slug='charis-mfb';
