# Charis 043 — Brevo TypeScript build correction

Source baseline: GitHub commit bf8d2d1, Release 043.

## Error corrected
`charisOrgId()` returns `string | null`. The previous code assigned its result to an outer `string | undefined` variable. The new expression `charisOrgId() ?? undefined` preserves the existing validation while removing the TypeScript error. The two unused server-action arguments are explicitly consumed without affecting the form or sending flow.

Files changed: `app/admin/providers/brevo-staff-action.ts` only. No SQL, sender configuration, API credentials, permissions or sending feature flags are changed.

## Apply
Extract the patch into the root of the existing Charis project, preserving folders. Check the diff, run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` with Node 24. Push after review to trigger Vercel. Do not trigger the Brevo staff-email action as part of this build repair.

## Verification limitation
This environment has no installed project dependencies and runs Node 22; its full Next.js/TypeScript build cannot be certified locally. The Vercel production build must succeed before deployment can be treated as ready.
