# Source verification — 035

Checked against the saved Batch 6 (034) full source and current GitHub baseline `7fc0b9e`.

| Check | Result |
|---|---|
| Latest production deployment before the patch | READY on Vercel (project `charismfbcampaign`, Node 24.x, commit `7fc0b9e`) |
| Source parse | 211 TypeScript, TSX, JS, JSX and MJS source files; 0 parse errors |
| Relative/`@/` import paths | 308 checked; 0 unresolved |
| Focused release-hardening/related regressions | 30/30 passed on Node 22 |
| Entire local Node 22 suite | 141/152 passed; 11 runtime/dependency failures |
| End-to-end database RBAC & SQL 033/034 validation | Not performed: no bank database credentials used |
| Fully installed Node 24 `npm ci`, lint, typecheck, npm test, build | Outstanding for this new patch, required on CI/preview |

### Why 11 local tests fail

The saved local `node_modules` contains incomplete package directories, and this environment runs Node 22 rather than the project's required Node 24. Imports of modules such as `zod`, `svix`, `@electric-sql/pglite`, or `.ts` files fail in those test files. We did not suppress them or claim they pass. Run a clean `npm ci` and CI quality checks under Node 24 to determine release readiness.

### Bank safety

- No Supabase SQL migration was executed in producing this patch.
- No GitHub push, Vercel deployment, or provider-send event was performed.
- No customer deliveries are enabled by this patch; existing application delivery flags are unchanged.
- Review bank data-access policies and provider restrictions before allowing real customer sends.
