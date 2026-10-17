# Charis Campaign Centre — Release 054

## Scope
This update is based on the complete local **Release 053** source, incorporating previous 051–053 features. It optimises the staff experience for Create Campaign and Loan Reminders. No data models or sending rules are changed.

## Implemented
- The main Create Campaign page initially reads the 35 newest eligible customer records, rather than 250. A permission-checked directory search now responds automatically after a 350 ms typing pause. Superseded fetches are cancelled with AbortController; selected recipients stay selected even when search results change. The endpoint returns up to 40 records per query, ordered by newest. No full contact list is fetched on initial page entry.
- The Loan Reminders index loads up to 12 batch summaries per page, rather than 40 full batch records and associated recipient and dispatch details. Staff use **View reminder** to open a detail page for that batch only; the detail page checks credit_reminders.view and organisation scope, shows provider status, and retains review/hold/dispatch actions according to the same permission and bank/provider checks as before.
- Sidebar and dashboard shortcuts omit the redundant `?org=` parameter. Middleware still injects the verified bank organisation into rewritten dashboard requests; old bookmarked URLs remain supported.
- Small-screen layouts improve recipient chips, touch targets, the composer step strip and reminder batch controls. No new JavaScript or CSS framework dependencies.
- Older onboarding, subscription/resubscription management, contact import, credit and delivery functionality remains present.

## Static before / after (not wall-clock benchmarks)
| Measure | Release 053 | Release 054 |
| --- | ---: | ---: |
| Recently loaded contacts on initial composer page | 250 | 35 |
| Contact search results per request | 50 | 40 |
| Reminder batches listed on initial page | 40 | 12 |
| Reminder recipient/held/dispatch queries on initial summary | 3 query categories | 0 (on demand) |
| Typical reminder summary data-fetch waves | 3 | 2 |
| Org redirect for primary sidebar/dashboard shortcuts | yes | eliminated |

These are source-level request/row ceilings. They **do not establish** production time savings. The live staff pages are authenticated and must be measured with an authorised test account on a staging deployment.

## Security and behaviour
- Current authenticated user and branch/customer RLS policies still apply. No sensitive directory cache is shared between staff.
- The new reminder detail checks `credit_reminders.view`, validates a UUID, scopes every query to the current organisation, and does not send automatically.
- Credit dispatch remains subject to separate bank feature flags, staff permissions, database claims, one-recipient confirmation, and review/audit procedures.
- Reminder balances still require staff comparison against the core banking ledger; there is no automated BankOne reconciliation.
- No changes were made to existing approved/pending jobs, database migrations, Resend/Brevo/SMS configuration, or user permissions.

## QA and deployment limits
- Focused regression suite Release 051–054: **26 passing** (source checks).
- Global TypeScript parser: **202 application TS/TSX files parsed**, 0 parse errors.
- Broad suite: **206 passing / 24 failing out of 230**. Failures include missing npm packages in this execution environment and historical tests asserting superseded navigation/approval text. Do not treat the full suite as passing.
- **Full typecheck, lint, Next.js production build, authenticated responsive browser test, and live Core Web Vitals measurement have not been completed in this environment** (Node 22; package dependencies unavailable).

Before deployment, run with Node 24:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Resolve **all actual errors** before pushing to production. Verify Release 051 schema installation first; Release 054 requires **no new SQL**. Preserve `.git`, `.env*`, and any local secrets when replacing source.

## Staging acceptance checks (authorised test staff only)
1. Test menu/dashboard links and verify they do not issue an extra 307 redirect due to `?org=`.
2. Open Create Campaign on 390px, 768px and desktop widths; search a customer beyond the 35 recent rows; change query while search is in flight; confirm selections remain and sending is **not** triggered.
3. Open Loan Reminders with 40+ batches; confirm the index loads 12 per page and each detail fetches just one batch's recipients. Check permissions from a staff account without Credit Operations access.
4. Check all outstanding balances against core banking records before any actual reminder dispatch. Use a non-sending test where possible.
5. Capture Chrome DevTools Network and Lighthouse reports before/after on comparable deployments. Record TTFB, LCP, INP, CLS, transferred JS/CSS, and Supabase request counts; pay attention to p75 mobile performance.
6. Do not enable or alter customer sending until QA is signed off.

## Deferred
Full template/designer unification, scheduling, three/four-day loan reminder rules, global CSS deduplication, and database-specific query tuning should follow verified performance measurements. Do not introduce automated sends in a navigation or speed patch.
