# Release 068 — Accessible campaign creation and viewing

## What changed
- Professional, clear four-step campaign navigation with completed/current status, readable headings and compact mobile layout.
- A guidance sentence at each stage explains what staff need to do without technical terminology.
- Recipient and final review show channel, message type, subject and exact selection type, without fabricating an all-eligible recipient count.
- Selected-recipient details are expandable. Search reports when no customer matches, and invalid/incomplete steps explain why Continue is unavailable.
- The final review visibly repeats the subject, audience, message type, product and actual HTML preview, with consent before sending.
- Existing bank sender/approval/provider settings and server-side send guards remain unchanged.

## Checks
- Node 24 npm ci, npm run typecheck, npm run lint, npm run build, focused and full regression tests.
- Focused 23/23 tests passed; full suite 331 passed, 17 historical failures, unchanged from baseline.
- Headless browser validation: saved starter layout, selected sample customer, HTML preview, final confirmation disabled without consent, Back navigation. Desktop and 390px mobile widths with no horizontal overflow.
- Test fixture route removed before committing; no email was sent.
- Authenticated production operator testing of the bank's actual audience and provider setup remains necessary.

## Deployment
- No SQL migrations or new environment secrets.
- One consolidated GitHub push to main; Vercel deploys once.
