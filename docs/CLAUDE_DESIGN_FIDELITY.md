# Charis Campaign Centre: Claude design fidelity release

## Visual direction (not merely color changes)
The supplied Charis_Campaign_Centre_PREMIUM (1).zip is the visual source of truth. The new application shell adopts its **white sidebar**, **compact 64px top bar**, **light lavender canvas**, **white cards**, **restrained green accents**, **quiet purple selected navigation** and **two-panel staff login**. The full reference stylesheet is mirrored in `app/charis-claude-faithful.css` with compatibility overrides for later operational modules.

Typography: Century Gothic on the most prominent display titles when available on the staff device, with Avenir/Trebuchet fallbacks. Everyday forms and tables use readable system UI fonts. No proprietary font bundled.

The app keeps all the newer operational code, Supabase migrations 001–020, customers, bulk management, roles, approvals and delivery workflows. Do not replace the database or rerun old migrations to apply this style update.

## Functional checks and limitations
- Check `/login`, `/dashboard`, `/dashboard/contacts`, `/dashboard/campaigns`, `/dashboard/lists`, `/dashboard/approvals`, `/dashboard/senders`, `/dashboard/team` on desktop and mobile.
- Test mobile menu, no horizontal overflow, keyboard focus and visible status colors.
- Test a user with role `campaign_lead` and a separate authorised approver. Never self-approve production bank campaigns.
- Full Vercel typecheck and authenticated browser acceptance are required before production sign-off. CSS/static checks do not prove a production build or actual email delivery.

## Deploy
Use the complete project ZIP as a source replacement inside the existing Git checkout while preserving `.git` and Vercel environment variables. Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build` with Node 24 before pushing. No new SQL is introduced.
