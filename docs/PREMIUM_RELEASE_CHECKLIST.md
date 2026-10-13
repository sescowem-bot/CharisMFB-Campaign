# Charis Campaign Centre — Premium Release Checklist

## Deploy from the complete ZIP

1. Back up your current GitHub working directory and confirm the source branch state.
2. Extract the complete `Charis-Campaign-Centre` folder and copy its contents into your checkout. Preserve `.git`, Vercel settings and locally configured secrets.
3. Review changed and removed files with `git status`, `git diff --stat` and `git diff` before committing.
4. Use Node.js 24 as defined in package.json. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
5. Fix all blocking errors before pushing. Commit the reviewed source to the intended GitHub repository.
6. Use existing Supabase migrations 001–018. This release adds **no new SQL migration**.
7. Keep Vercel secrets in Vercel (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_WORKER_SECRET`), never in GitHub.
8. Set `SINGLE_COMPANY_MODE=true` and `SINGLE_COMPANY_ORG_ID` to the active Charis organisation.
9. Keep `EMAIL_DELIVERY_ENABLED=false` until verified internal tests pass and delivery worker is configured.

## Manual acceptance matrix

| Test | Expected |
|---|---|
| Open `/login` | Official Charis logo, staff-only design, working password visibility |
| Sign in | Only authorised Charis workspace is accessible |
| Sign out from sidebar | Supabase session ends, returns to `/login`; protected pages require new login |
| Mobile sidebar | Toggle opens and closes; no horizontal overflow |
| Dashboard | Real counts, no test or fictitious values |
| Add/Archive/Restore/Delete contact | Server permissions respected; campaign history preserved |
| CSV/XLSX upload | Mapping, preview, deduplication and safe group association |
| Choose single/multiple contacts | Only eligible, consented customers can receive marketing |
| Campaign creation | Save, preview, select sender, test and submit are visible |
| Approval | Different authorised user can approve or reject; creator cannot self-approve |
| Resend domain | Existing verified domain links with no new DNS registration |
| Sender test | Only signed-in verified staff email; rate limits enforced |
| Brand assets | Official default logo/favicon, upload overrides and responsive rendering |
| Delivery | Approved revision only, confirmation and worker handling with audit logs |
| Reports | Delivered/accepted distinction remains clear |

## Known constraints

- Full production build and browser integration have NOT been verified in this offline coding environment (Node 22, no complete npm cache).
- Source/static tests verify structure and parsing, not Supabase, Resend or Vercel production behaviour.
- SMS is not implemented in this release.
- Legacy database schema and hidden multi-company infrastructure remain for migration safety; removing them requires a separately tested schema refactor.
