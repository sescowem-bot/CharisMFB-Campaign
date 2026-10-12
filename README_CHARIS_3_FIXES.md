# Charis Campaign Centre: Logout, Customer Consent and Domain ID UI Fix

This patch is based on the latest `main` source read from `sescowem-bot/CharisMFB-Campaign` on 12 October 2026. The six modified files were confirmed identical to the last provided full-project ZIP before patching.

## What was fixed

1. **Logout**: Replaces the sidebar's hand-written POST to `/auth/signout` with a Next.js Server Action that uses the platform's built-in Server Action cross-origin safeguards, calls Supabase `signOut`, and redirects to `/login`. Errors display in the sidebar instead of leaving users on a raw JSON response. The existing route remains for backward compatibility, but the Charis sidebar no longer calls it.
2. **Customer form**: When consent is `unknown` or `denied`, it is safe to save the contact without inventing consent evidence. When consent is `granted`, the field appears and is required. Old form errors disappear as staff edit any input. Existing server and database consent validation remain in place, and unconsented customers are not made eligible for marketing.
3. **Domain recovery**: Labels the *provider-assigned* Domain ID separately from the *Charis internal* record ID, clarifies that a domain name is not an ID, and improves the sender onboarding step layout. No domain verification or provider security check is weakened.

## Installation

1. Back up/commit your latest GitHub changes.
2. Extract the patch ZIP **into the project root**, preserving paths like `app/auth/signout/actions.ts` and `components/workspace-shell.tsx`.
3. Run `npm install` and `npm run build` using **Node 24** (the project's `engines` requirement).
4. In Vercel, ensure `NEXT_PUBLIC_APP_URL=https://charismfbcampaign.vercel.app` and the Supabase keys refer to the Charis project.
5. Push and redeploy from your own GitHub checkout.

```bash
git add app/auth/signout/actions.ts components/signout-form.tsx components/workspace-shell.tsx components/contact-forms.tsx components/provider-form.tsx app/dashboard/senders/page.tsx app/globals.css tests/charis-screenshot-fixes.test.mjs
git commit -m "Fix Charis logout customer consent UI and sender domain guidance"
git push origin main
```

**Database:** No new SQL required.

## Test manually after redeploy

- Log in and click **Sign out**; confirm redirection to `/login` and that dashboard routes require a new login.
- Add a contact with an email or phone, consent `Unknown`, and blank evidence; it should save but not be eligible for marketing.
- Try `Explicit opt-in documented` with no evidence; saving should be blocked. Record actual consent evidence to save as opted-in.
- Check the sender page: a domain that has not completed provider registration should be marked pending; note the internal ID is not the provider ID.
- In Resend's *Domains* area, locate an existing verified domain, obtain its provider ID (or via the Resend Domains API) and **only** reconcile when you are sure it is the same domain and API account. Do not insert a domain name into the provider ID field.
- For bank rollout, use an official Charis domain controlled or authorised by the bank. Remove developer-owned sender domains through the controlled revocation flow after confirming they are not used for another organisation.

**Verification limits:** Source parsing and focused tests passed in this environment. Full Next.js production build and real live browser/provider interactions were not verified here because the container has Node 22 and not the full project dependencies. No GitHub or Vercel modifications have been performed.
