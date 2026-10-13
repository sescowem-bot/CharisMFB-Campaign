# Charis Campaign Centre — Logout and Contacts Build Fix

Source reference: `sescowem-bot/CharisMFB-Campaign`, `main`, commit `25998dc` (13 October 2026).

## Diagnosis

The public website header, mobile navigation and footer all render the same `AccountLinks` component, which still submitted a POST to `/auth/signout`. That legacy route returned `{"error":"Cross-origin request denied"}` for requests whose Origin did not match its trusted host list. Separately, the dashboard used a server action for sign-out, which can also encounter reverse-proxy origin checks. The prior failed Vercel deployment means recent fixes were not necessarily live.

## Changes

1. Both dashboard and public-page sign-out buttons now use one interactive Supabase browser client action. The `@supabase/ssr` browser client is the same client used for login, so it clears auth cookies for the current device. A full navigation to `/login` after successful signout clears cached protected pages. If signout fails, the user stays on the page and sees an error rather than a fake success.
2. No public page posts to the legacy `/auth/signout` route.
3. Contacts page uses the checked `org` value consistently, addressing the TypeScript build failure in Vercel commit `25998dc`.
4. A small static test verifies these source-level protections.

## Install

Extract the ZIP at your current Charis repository root, retaining folder paths. Do not delete any unrelated features. The ZIP overwrites:

- `components/signout-form.tsx`
- `components/public.tsx`
- `app/dashboard/contacts/page.tsx`
- `tests/charis-signout.test.mjs` (new)

Then run with Node 24:

```bash
npm ci
npm run typecheck
npm test
npm run build
git add components/signout-form.tsx components/public.tsx app/dashboard/contacts/page.tsx tests/charis-signout.test.mjs
git commit -m "Fix Charis logout and contacts build"
git push origin main
```

Do not run any Supabase SQL. No additional environment variables are required. This patch makes no GitHub or deployment changes until you push it.

## Browser acceptance test after successful deployment

1. Sign in on the bank's production URL and open the dashboard. Click Sign out in the sidebar. Confirm you land on `/login` and cannot open `/dashboard` without logging in.
2. Sign in again, go to the public landing page, and click Sign out in the header. Repeat from mobile navigation and the footer.
3. Test in an incognito browser, then inspect Vercel logs for any auth errors.
4. Build must fully complete before interpreting the latest code as the live site.

## Security notes

The browser client uses `signOut({scope:'local'})`, which is intended to sign the user out of this browser session, not all of their devices. The app's protected routes still independently verify Supabase authentication. We do not relax CORS, CSRF, row-level security or cookie settings. The legacy route remains in the repository for compatibility, but the app's sign-out UI no longer calls it. Directly opening `/auth/signout` is **not** the sign-out procedure.

## Verification limits

The packaged files pass source regression and TypeScript syntax/transpilation checks. A full `next build` requires installing the project's dependencies and Node 24; it has not been verified in this working environment. Live Supabase session clearing needs an authenticated browser test after Vercel deploy.
