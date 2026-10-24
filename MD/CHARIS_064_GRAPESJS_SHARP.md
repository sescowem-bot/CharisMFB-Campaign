# Release 064 — Charis visual campaign template editing

## Included
- Open-source GrapesJS 0.23.8 installed as a real application dependency (not a CDN).
- Sharp 0.35.5 installed for authorised campaign image optimisation.
- Template Studio defaults to a drag-and-drop GrapesJS editor and preserves the detailed section editor as an alternative.
- GrapesJS edits are converted to the strict Charis v1 block design schema; raw HTML/CSS is **not** submitted to the sending system. Saving, link validation and approved image checks use the existing server action.
- Select text to edit it; move or insert supported email sections. Use the detailed editor for approved media choices, destinations and granular shape settings.
- The media upload form supports keep-aspect-ratio, square and banner cropping. Campaign images are optimised as JPEG (or PNG when transparency is needed), bounded to 2 MB, and written to the existing Supabase storage bucket with their validated metadata. Logos and favicons remain in their existing format.

## Deployment
- No new SQL is required. Existing media bucket, roles and migration 018 must be present.
- Node 24: npm ci; npm run typecheck; npm run lint; node --test tests/charis-064-grapesjs-sharp.test.mjs; npm run build.
- No new provider secrets or email permissions are required; sending behaviour is unchanged.
- Check with an authorised Charis editor: create a template, insert/reorder/edit sections, switch to detailed editing, preview, save, reopen, and upload/crop a sample approved image.
- Verify rendered HTML in target email clients (especially Outlook) before live customer use. GrapesJS authoring preview is not equivalent to email-client validation.

## Boundaries
GrapesJS is an authoring interface for the supported Charis design model, not an arbitrary HTML email publisher. Its visual styles are intentionally limited to supported fields to avoid bypassing Charis security and deliverability controls. Uploads require authenticated company design permissions. Browser smoke tests on a local test fixture do not establish successful authenticated production acceptance.

## Existing regression suite
The new editor/image processing tests are independent of historical PGlite and old UI contract tests. Existing historical regression failures (including missing Supabase storage schema in the PGlite fixture) must be reconciled separately; do not treat the entire legacy suite as green.
