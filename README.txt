Charis 062 — TypeScript null-domain build fix

Applies to GitHub main commit da23e6f (2026-10-18).
Exactly two TypeScript files are changed:
  lib/direct/readiness.ts
  lib/direct/dispatch.ts

Fix: reject a missing domain record with !domain before reading its properties.
No SQL migration, provider flag changes, or customer message sends are needed.

To apply: copy these two files to the corresponding paths in the Charis repository.
Do not delete or overwrite .git, .env, or other project files.
Run npm ci, npm run typecheck, and npm run build on Node 24 before deploying.
The local environment has Node 22 and cannot reach the npm registry, so
a full Next.js production build is not independently certified here.
