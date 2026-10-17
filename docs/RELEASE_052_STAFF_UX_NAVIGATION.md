# Charis Release 052 — Staff Navigation and Campaign UX

## Baseline
Based on the complete **Release 051** source archive. The GitHub `main` branch observed at the start of this work did not contain the Release 051 subscription migration or subscriptions admin page. **Do not pull and overwrite this package with the older GitHub tree.**

## Implemented in this release
- **Create Campaign** is the primary sidebar and dashboard action. It opens `/dashboard/communications/new` (the direct-send workflow), rather than the old approval-based Studio.
- **Campaigns** collapsible menu with All Campaigns and permitted design / historical records.
- **Contacts** collapsible menu with All Contacts, Add Contact, Import Contacts, and Contact Groups for authorised staff. Import requires existing contact-management authorisation; no access-control bypass.
- **Credit Operations** collapsible menu, only for permitted loans/reminders/follow-up users.
- **Workspace** collapsible menu with Tasks, Reports, Notifications, and Help.
- Super Admin/management tools remain outside the everyday staff sections.
- Sidebar collapses cleanly and closes on a selected link in the mobile layout.
- New concise Help & Guides page with working staff task links.
- Dismissible four-step first-use welcome guide on the dashboard, replay available from Help; browser-only preference, no new database table.
- Contacts actions surfaced at the top; form can be reached using the Add Contact anchor.
- Reduced duplicate request to `charis_direct_can_send` on dashboard renders through React request-scoped caching; no cross-request authorisation cache.
- Kept existing customer records, campaigns, RBAC, Resend, SMS, email preferences, and Release 051 SQL migrations unchanged.

## No new SQL is necessary
This is an application-code and CSS/navigation release only. It includes the earlier SQL migrations, but **do not rerun all migrations**.

## Current scope limitations
- The staff Create Campaign flow remains the simple direct email/SMS composer from Release 051. The rich Template Studio and historical campaign approval workflows still exist separately. This release changes navigation, not their delivery policies.
- Scheduling direct communications and the configurable pre-due loan reminder trigger are **not implemented** here.
- Full provider-level delivery confirmation, performance benchmarks (LCP/INP), mobile device testing, and the production build are still required before launch.
- Existing older tests that assert the old navigation/copy may fail and need to be reworked when their intended functionality is intentionally removed or hidden.

## Verification in working environment
- 6 new Release 052 navigation tests and 5 Release 051 resubscription tests pass.
- All modified TS/TSX files passed TypeScript transpile syntax diagnostics.
- The complete Next.js build could not be certified: this environment provides Node 22 while project requires Node 24; full dependency installation failed.
- No live Supabase queries or customer sends executed.

## Deployment
1. Back up GitHub and Supabase.
2. Extract full ZIP, and compare against current repository. Preserve `.git` and `.env` files; do not blindly overwrite any newer production changes.
3. On Node 24, run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Reconcile legacy test expectations before release.
4. Verify role-based staff routes and responsive sidebar at phone, tablet and desktop sizes.
5. Deploy after checks pass. No new SQL needed for Release 052 itself.

## Next phases
1. **Phase 053 — Loading speed:** profile real authenticated navigation, dashboard queries, CSS/JS, contacts pagination and imports; optimize and measure before/after.
2. **Phase 054 — One campaign journey:** unify the template editor with direct send, clear campaign states, accurate delivery history, and optional scheduling with worker guarantees.
3. **Phase 055 — Contacts:** import preview, column mapping, error review, consent/suppression clarity, customer profile UX.
4. **Phase 056 — Loan reminders:** configurable pre-due timing (e.g. 3 days, 4 days), single-run idempotency, loan balance checks, borrower-specific schedules.
5. **Phase 057 — Mobile + release certification:** keyboard, 320/375/768/1024px widths, load metrics, clear staff microcopy, regression and real environment tests.
