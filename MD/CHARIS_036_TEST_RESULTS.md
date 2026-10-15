# Release 036 verification results

See release notes for production acceptance gates. Run the **GitHub Actions / Vercel Node 24 pipeline** before production promotion.

| Check | Status |
|---|---|
| SendGrid domain exact-match and rejection tests | **4/4 passed**, Node 22 with experimental TS stripping |
| SendGrid sandbox payload and no-live-send path | Passed (Node 22 with experimental TS stripping) |
| Full local Node 22 test suite | **171/178 passed**; seven dependency-backed suites cannot load packages absent from the offline environment |
| Source parse + local import resolution | **216 files**, **329 imports**, no parse/import errors |
| Project full Node 24 npm ci + typecheck + lint + tests + build | **Not verified**: npm registry inaccessible in offline container |
| Supabase migrations 033/034 | Not verified in bank database |
| SendGrid API key, domain authentication, inbox/event webhooks | Not verified: account access/credentials not connected |
| Security role and branch isolation | Requires real per-role staging acceptance |
| Source release installed on Vercel | Not deployed by this release |

The earlier READY deployment is an **older baseline**, not proof that this new source revision is production ready.
