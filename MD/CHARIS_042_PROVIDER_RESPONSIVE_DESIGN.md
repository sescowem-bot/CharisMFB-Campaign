# Charis Campaign Centre — Release 042: Responsive Email Provider Administration

## Purpose
Fix the horizontal overflow and crowded controls reported on `/admin/providers`, while keeping existing Charis campaigns, sender configuration, webhooks, and bank staff permissions unchanged.

## Changed files
- `app/admin/providers/page.tsx` — streamlined provider administration, Resend first, collapsible optional providers, concise status, SendGrid link retained.
- `app/charis-providers.css` — scoped layout and mobile breakpoints; constrained webhook URL wrapping and all provider cards.
- `app/layout.tsx` — imports the new scoped stylesheet **after** existing UI styles so it takes precedence only for provider administration.
- `tests/charis-042-responsive-providers.test.mjs` — regression checks for scope, webhook URL, security gates, and mobile styling.

## UX
- Dashboard-like status summary displays *configuration*, not a claim that email reached a recipient.
- Provider selector cards and a single vertical stack remove the old competing two-column full-width forms.
- Resend primary controls open by default. Mailjet and Brevo controls are available but collapsed.
- Mailjet webhook setup is compact and expandable. Long URLs wrap instead of widening the page.
- Sender management, Delivery history, SendGrid setup, existing routing actions, provider limits, and all verification actions stay available.
- Phone-size view stacks overview cards and buttons; form fields remain in the document flow.

## Installation
1. Confirm latest GitHub `main` matches commit `5955aafe0ab2b7ce126cbdf5957edfc246fc30cf` or review and merge changes if newer.
2. Back up your local source. Extract the **042 PATCH**, copy files preserving their paths, and inspect `git diff`.
3. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` using Node 24.
4. Deploy to Vercel Preview first and inspect `/admin/providers` at phone (~375px), tablet (~820px), and desktop widths. Ensure no horizontal page scrollbar, all dropdowns and forms remain usable, optional sections expand, and all actions return their existing result.
5. Merge to production after verification. No SQL migration, webhook change or provider secret update is required.

## Validation in the preparation workspace
- 5 focused checks passed.
- Provider page/layout JSX parsed with local TypeScript transpiler, 0 syntax diagnostics.
- CSS stylesheet parsed with tinycss2, 0 errors.
- Full production build, interactive viewport inspection, and dependency-based test suite could **not** be certified here: the preparation container runs Node 22 and cannot fetch all `npm ci` dependencies. Do not skip Node 24 CI/Vercel Preview.

## Existing Mailjet webhook
The screenshot shows HTTP 200 for `/api/email/webhooks/mailjet` requests, suggesting recent callbacks were acknowledged. This is not proof that all customer emails were delivered. No webhook source, auth, SQL or settings were changed by Release 042.

## Rollback
Revert only the four changed source files to their pre-042 versions. Keep customer sending, Supabase migrations, and webhook secrets untouched.
