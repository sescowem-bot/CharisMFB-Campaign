-- Charis 090: preserve high-resolution approved email artwork.
-- Existing stored assets and public URLs remain unchanged.
BEGIN;
ALTER TABLE public.charis_media_assets DROP CONSTRAINT IF EXISTS charis_media_assets_bytes_check;
ALTER TABLE public.charis_media_assets ADD CONSTRAINT charis_media_assets_bytes_check
 CHECK (bytes > 0 AND bytes <= 8388608);
UPDATE storage.buckets
 SET file_size_limit=8388608,
     allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp']
 WHERE id='charis-brand-assets';
COMMIT;
