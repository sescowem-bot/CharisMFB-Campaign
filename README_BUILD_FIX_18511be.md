# Charis Campaign Centre — Vercel build fix, commit 18511be

This release addresses the Vercel build failure reported on 13 October 2026.

## Exact source changes

- `app/dashboard/contacts/actions.ts`: replace `let details` with `const details` because the object is mutated but not reassigned.
- `components/workspace-shell.tsx`: remove unused `ShieldCheck` named import.

No business logic, permissions, database migrations, campaign flows, branding or provider configuration are changed.

## Installation

The full ZIP includes the whole project including migrations 001–021. Extract it, copy the inner `Charis-Campaign-Centre` contents into your existing cloned repository and preserve `.git`.

The smaller ZIP contains just two corrected files with the same relative paths. Extract into the existing project folder and overwrite the two files.

Use Node 24, and run before pushing:

```
npm ci
npm run lint
npm run typecheck
npm run build
```

Then review `git diff`, and commit/push to GitHub.

## Important limits

Syntax parsing and focused tests can be checked in this environment, but a full dependency-backed Next.js build cannot be certified without the correct Node 24 environment and installed packages. Watch the subsequent Vercel build for additional errors. The unknown `cache-dir` npm setting warning is not the blocker in this log.

No Supabase SQL or Vercel variables are required for these changes.
