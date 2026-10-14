# Charis repository maintainer instructions

Purpose: preserve the current single-bank Charis customer communication system while improving its performance and usability. Do not convert it back into a multi-tenant subscription product.

- Source of truth is the latest accepted GitHub branch/commit plus the relevant Supabase migration state; do not use an older full ZIP to replace newer features without a file diff.
- Keep Markdown documentation in `MD/`, except this repository's root `README.md`. Document meaningful changes in `MD/TESTING_AND_RELEASE.md`; do not create phase-by-phase build notes, root patch READMEs or duplicated deployment guides.
- Preserve `supabase/migrations/001` onward. Create numbered, additive, reviewed migrations when changing database contracts; never drop production tables or rerun the fresh installer as a quick fix.
- Keep sender/API secrets on the server. No unverified domain or borrowed third-party domain should be selected as a Charis sender by default.
- Respect bank role checks, marketing consent, suppression, independent approval and audit history even when simplifying the UI.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` on Node 24; record what was and was not verified.
- Use official Charis logo and approved purple/green palette; Century Gothic only as an installed-font heading preference with fallbacks.
- Avoid adding unused packages or changing working backend code for documentation-only reorganisation.
- Do not push, merge, deploy, change Supabase, activate delivery or send emails without explicit project-owner approval.
