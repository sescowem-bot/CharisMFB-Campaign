# Charis Campaign Centre — Release 038 Vercel ESLint hotfix

## Symptom
Vercel commit `6ce5e8888add0f4f3b96665f207602e2d1fe2a62` compiled in Next.js 15.5.27 but failed during lint:

`app/admin/access/page.tsx:39:205 react/no-unescaped-entities`.

## Fix
Replaced the apostrophe in visible JSX prose with `&apos;`.
No role database logic, server actions, permissions, or customer sending were changed.
Added a small regression check for the exact failure.

## Safe installation
1. Use the **PATCH** archive and copy its project-root paths into the existing checkout (overwrite the one changed page, add the test and this guide). Do not re-run SQL migrations.
2. On Node 24 with dependencies installed, run `npm ci && npm run lint && npm run typecheck && npm test && npm run build`.
3. Confirm the Vercel build reports success. If a new error appears, report its first file/line and do not suppress lint or type checking.
4. Preserve your last READY deployment until the new build passes.

## Verification performed offline
- Direct source edit and file assertions verified; existing targeted unified-admin suite passed.
- **Full Next.js/ESLint build has not been verified here** because this container has Node 22 and no project node_modules or package registry access. The new Vercel build is the production verification gate.
- No GitHub, Vercel, Supabase, or real-customer dispatch changes made by this package.
