# Charis Campaign Centre — Vercel build hotfix for Batch 4 / Migration 032

## Source and scope
- Based on repository `sescowem-bot/CharisMFB-Campaign` commit `2dbaa3d499270bc3e0cfae870c3cc733ec0a880d`, as reported by Vercel.
- **Code-only change**; no new database migration, no sender or campaign behavior change, no changes to delivery gates.
- Preserve previously applied migrations `001–032`. **Do not rerun them** for this fix.

## Error resolved in source

Vercel Next.js 15.5.27 compilation completed, but TypeScript validation stopped in `app/dashboard/loans/page.tsx` when destructuring `{ data: payments, error: balanceError }` from `Promise.all`. The no-loans branch used `Promise.resolve({ data: [] })`, making the `error` property absent from one union alternative. That fallback now returns `{ data: [], error: null }` like the other Supabase response alternative.

## Lint warnings cleaned
- `app/dashboard/campaigns/page.tsx`: removed unused `ownWorkspace` RPC request; retained existing `own=false` and permission checks.
- `components/workspace-shell.tsx`: removed unused `workspace` local and destructured `org` (the `org` property stays supported by the component's public prop type).

## Checks performed in this environment
- TypeScript parser and local import resolution across **152 TS/TSX/JS/JSX files**: 0 issues.
- Targeted Batch 1, Batch 2B, Batch 3, Batch 4 tests: **21/21 passed**.
- Regression tests for this fix: **2/2 passed**.
- Complete inherited Node 22 test run with two new regression tests: **120 passed / 16 failed (136 total)**, mostly due to unavailable runtime/dependencies and outdated assertions; failure count unchanged from prior Batch 4 package. This is **not** a clean suite.
- Node 24 production build and full TypeScript semantic validation could not run in this offline container: installed project dependencies are unavailable here. **Production build success is not yet certified.**

## Install and verify
1. Back up your repository and compare this source with main if main has moved beyond the above commit.
2. For the smallest repair, use the **PATCH** ZIP and copy the files at their preserved paths. Or replace project source with the **FULL** ZIP; **do not** copy any `node_modules`, `.env`, or local temporary caches.
3. Commit and push to GitHub `main` (or create a review branch). Vercel will build the new commit from the connected repository.
4. Check Vercel logs for `Compiled successfully`, `Linting and checking validity of types`, `Collecting page data`, and successful final deployment. If another error appears, inspect its path and line rather than disabling TypeScript checking.
5. In a Node 24 environment with network access, run:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

6. Vercel requires valid `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and relevant server secrets for real runtime; never commit `.env` or API keys. Leave `EMAIL_DELIVERY_ENABLED=false` and `CHARIS_MULTI_PROVIDER_ENABLED=false` until a separately approved live-delivery release.

## Non-blocking messages in the supplied log
The `npm warn Unknown env config "cache-dir"` and `unrs-resolver` install-scripts notices did **not** cause this failure. Do not disable Next.js type checking or suppress strict TypeScript rules to hide it.
