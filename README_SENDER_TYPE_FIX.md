# Charis Campaign Centre — Senders TypeScript Build Fix

Baseline: GitHub `sescowem-bot/CharisMFB-Campaign`, `main` commit `7dbec5d2686cbac9bbd78e78e732acd174982b18`.

## Issue

Vercel failed at `app/dashboard/senders/page.tsx` with `Cannot find name 'DnsRecord'` after a cleanup removed its type import. The file still uses `d.dns_records as DnsRecord[]` in the legacy fallback renderer.

## Code change

The single targeted fix restores the missing type-only import:

```tsx
import type {DnsRecord} from '@/lib/email/providers';
```

This is compile-time only and does not change runtime, Resend credentials, sender behavior, or the database.

## Deploy

Extract the ZIP. Copy the contents of `Charis-Campaign-Centre` into the existing local Git working tree, preserving its `.git` directory. Before overwriting, check `git status` and merge any newer changes. Then run:

```bash
npm ci
npm run typecheck
npm run build
git add app/dashboard/senders/page.tsx
git commit -m "Fix missing DnsRecord type in Charis sender settings"
git push origin main
```

Use Node.js 24 as required by `package.json`. Your Vercel build still needs to finish successfully and may reveal a later error.

## Verification performed

- The baseline Sender Settings file matched the GitHub blob hash in commit `7dbec5d`.
- Corrected file passed TypeScript source parsing.
- The full source was syntax-scanned, and the ZIP passed integrity checks.
- A complete `next build` could not run here: no installed project dependencies, Node 22 rather than Node 24, and the npm registry was unreachable.

The unused-argument warnings in `app/auth/signout/actions.ts` were not involved in this failure. No SQL or environment changes are needed.
