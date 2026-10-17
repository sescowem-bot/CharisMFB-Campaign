# Charis Release 053 — Staff Performance Optimisation (Phase 1)

## Scope
Built on **Release 052**, preserving the Release 051 subscription and resubscription modules. This release contains **code only**; it does not require a new SQL migration, reset data, change staff permissions, or send messages. Do not overwrite an already-modified production repository without comparing it to this package.

## Changes made

| Area | Previous | Release 053 | Safety |
| --- | --- | --- | --- |
| Dashboard navigation | `team_invitation_accept` executed whenever a dashboard route rendered, after a separate user lookup | Invitation acceptance occurs once after successful password sign-in; existing auth callback and staff password setup still accept invitations | SQL checks confirmed email, unexpired invitation and user identity. Signed-in staff invited later should sign out and sign back in. |
| Main sidebar | Every visible Next.js Link may prefetch a protected dynamic page | Disable automatic prefetch on sidebar NavLinks | Navigation remains client-side and active-state highlighting stays intact |
| Customer import | Contacts groups then recent import batches fetched sequentially | Independent queries run concurrently | Retains permission checks and import parsing; history list capped at 80 recent batches vs 250, older data remains in DB |
| Customer management | Fetch paginated contacts then edit data | Fetch independently and concurrently | Still constrained by organization and access/RLS rules |
| Loan portfolio | Fetch loan list then independent customer search | Fetch them concurrently; balances and loan customer names still require loan ids | Does not change how balances are calculated or supplied |
| Loan reminders | Sequential policy → loans/batches → balances/contacts/items → held recipients → dispatch | Policy + loans/batches run together; holds start with balance/contacts/items | No change to loan amount verification, sending, approvals or recipient eligibility |
| Campaign pages | Repeated `charis_direct_can_send` RPC within page and shell | Share request-scoped `canSendDirect` permission result | No cross-user or persistent auth caching |
| Other contacts routes | Separate `auth.getUser` in contactsAccess and workspace shell | Reuse the same request-scoped `currentVerifiedUser` | A fully verified user and `can_manage_contacts` are still mandatory |
| Waiting state | Transition could appear blank | Minimal CSS-only skeleton with reduced-motion support | No additional frontend library |

## What is NOT claimed
- No live Core Web Vitals, mobile data, Supabase query-plan timings or load-test measurements have been performed.
- A complete Next.js production build has **not** passed here. The local environment is Node 22 and the complete dependencies are unavailable; the package targets Node 24.
- This release does not remove the existing stylesheets or replace loan reminder automation. Further improvements require profiling and measured before/after results.
- Future scheduled bulk campaigns, credit reminder trigger configuration, and further interface copy changes are separate phases.

## Test results
- 19 focused Release 051–053 tests passed.
- Existing invitation tests updated for the new one-time login workflow and passed.
- Full local suite: **200 passed, 23 failed**. Failures are a combination of missing dependency/runtime requirements and older assertions tied to superseded UI, not a clean production pass.
- 11 modified TS/TSX files parsed successfully with the global TypeScript parser (syntax check only).

## Deployment instructions
1. **Back up** GitHub and Supabase; inspect the current GitHub commit and deployed Vercel version. Source in this ZIP is based on the complete Release 052 ZIP, which contains Release 051 changes.
2. Verify Supabase migrations through **051** are installed. No SQL 053 exists or is needed.
3. Install **Node 24** locally/CI/Vercel. In the extracted project directory run:
   ```bash
   npm ci
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
   Do not deploy if the build fails. Review unrelated old test expectations separately.
4. Compare files with current main before merging. Do not remove `.env` secrets from your local machine or upload them to Git.
5. Deploy to Vercel with live sending disabled for the rollout check. Validate sign-in, accepting an invitation, Create Campaign, Contacts, Import Contacts, Loan Portfolio, Loan Reminders, mobile sidebar and subscription pages. Test only with internal sample accounts.
6. Measure *before and after*: Chrome Lighthouse mobile (LCP / INP / CLS), browser Performance + Network traces (navigation requests), and Supabase slow-query diagnostics; record median/p95 with several realistic users and datasets.

## Acceptance criteria for Phase 1
- No repeated invitation-acceptance RPC on every dashboard navigation.
- Existing staff can sign in and see exactly the same authorised modules.
- Newly invited staff can accept via the email callback or the next sign-in.
- Campaign navigation, subscription centre, customer management, reports, and credit reminder authorisation remain intact.
- Production build and responsive smoke tests pass before enabling real sending.
