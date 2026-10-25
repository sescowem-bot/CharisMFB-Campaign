# Release 065 — Visual campaign creation

## Delivered
- Campaign Studio uses the installed GrapesJS authoring surface for email layouts, alongside the detailed section editor.
- Saved bank-approved general/announcement templates and safe built-in starter designs are available directly in the campaign's layout selector.
- The source template is copied into an independent campaign draft; the source template is not changed when a staff member edits a campaign.
- The bank's media assets are loaded from the bank workspace for inline visual editing. Sending still validates approved image URLs on the server.
- Subject and message helpers insert only first_name, last_name and company_name tokens into visual email designs. Tokens are substituted at delivery by the existing approved renderer.
- This change leaves the existing four-step workflow, explicit Confirm & Send, recipient scope, email-provider configuration, direct-send permission checks and scheduling restrictions unchanged.
- Promotional and event category templates are not shown in the bank-notice wizard; do not reclassify marketing messages as account/service notices to bypass preference rules.

## Quality checks
- npm ci, npm run typecheck, npm run lint, and npm run build succeeded on Node 24.
- New tests: tests/charis-065-visual-campaign-workflow.test.mjs (4/4 passed).
- Phase 1 GrapesJS and image-processing tests continue to pass (8/8).
- Browser smoke (temporary test-only page, removed before release): chose a design, opened GrapesJS, inserted an approved variable, selected one fixture recipient, and displayed the preview without page errors.
- Full test suite: baseline 330 tests, 312 passed, 18 failed; modified suite 334 tests, 316 passed, 18 failed. No new failing tests. Existing failures include outdated assertions and the missing Supabase storage schema in the PGlite fixture.

## Production verification still required
- Sign in with a real authorised Charis editor. Select and customise a saved template, upload an approved image, choose eligible recipients, inspect the preview, and reopen the saved template.
- No live campaign was sent in development. Do not assume provider delivery or email-client compatibility solely from build success.
- The separate reported sending-preview problem remains outside this release by request.
- No SQL migration or provider credential changes are required.

## Operational note
- GrapesJS is the editing UI, not the outbound email renderer. The server validates the existing version-1 email schema, allowed bank-domain buttons, and approved image assets.
