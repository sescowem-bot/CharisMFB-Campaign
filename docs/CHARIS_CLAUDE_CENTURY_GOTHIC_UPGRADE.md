# Charis Premium v3 — Claude palette and Century Gothic

## Base and compatibility
This is an additive visual/UX upgrade on the full operational source containing Supabase migrations 001–020. Existing permissions, campaign approvals, opt-in safeguards, sender verification, backend actions and SQL history are unchanged. There is **no new SQL migration**.

## Adopted design system
- Purple `#40239A` (primary), deep purple `#2A1670`, midnight `#140A38`, green `#38EF92` (accent), light lavender `#F7F6FC`.
- Century Gothic for the login display, dashboard hero, key page titles and selected section titles. The interface body, tables and forms use the existing readable system font.
- Century Gothic uses local font-family fallbacks and **is not shipped as a font file**. Devices without the font will use a fallback; licence and host a font only with the appropriate permissions.
- Shared statuses now distinguish success, in-progress, danger and neutral. Brand editor has a one-click official palette preset and local live preview; colors are saved only when the administrator submits the existing form.
- Campaign navigation now exposes All campaigns and Audience filters. Saved email-template previews show the Charis company name and saved brand purple rather than generic placeholder brand text.
- Colors, headings, focus indicators, navigation and components are refined in `app/charis-design-v3.css`, imported after the existing premium stylesheet for low-risk overrides.

## Preserve
- All migrations 001–020, staff roles, sender controls and audit requirements.
- Test email restrictions, customer consent and independent approvals.
- Billing/provider integrations that are still referenced by shared code even if their public routes are disabled; do not drop tables.

## Do not confuse design with live validation
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` should run with Node 24 and dependencies installed.
- Verify sender, campaign approvals and delivery in the deployed bank workspace before enabling live sends.
- A customer campaign should never be dispatched simply because a preview looks complete.
