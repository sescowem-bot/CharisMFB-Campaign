# Charis Release 055 — Unified Create Campaign

## Scope
Builds directly on the complete **local Release 054** source. Preserves previous subscription management, contact import, banking permissions, loan reminder pages and legacy campaign data.

### Staff experience
- **Create Campaign → Message → Recipients → Review & Send**.
- Choose Email or SMS (per bank settings); enter a clear subject and select the purpose/product.
- Email: choose a simple text layout or a saved **General/Announcement** bank email template. Edit text blocks, button links and section order; review a sandboxed sample before sending.
- Recipients: select individual contacts, a contact group or eligible customers within your bank-authorised limit. Selection persists across directory searches.
- **Send Now** is available by default where staff permission and provider setup permit. Optional approval remains controlled by existing bank settings.
- **Schedule** is a separate **disabled-by-default** rollout flag. Date/time is explicitly entered in Nigeria WAT (UTC+01:00). Workers never claim a scheduled recipient before the stored timestamp. Staff can cancel a future campaign before any recipient is attempted.
- Campaigns and History show scheduled status and a read-only preview of the saved design. Saved content is independent of future template edits.

### Safety and data controls
- SQL 055 wraps the original SQL 047 `charis_direct_create` RPC, retaining organisation, branch/customer view scope, daily sending cap, suppression, idempotency, and optional approval.
- The new RPC stores the design and schedule in **one database transaction**; no early worker claim can occur.
- The worker still verifies customer email/phone against the current contact, opt-out and bounce/complaint suppression, sender domain, provider limits, and duplicate delivery claims. It renders personalised first/last name blocks on the server, escaping customer-supplied data.
- Direct bank email buttons are limited to the saved official bank website host; template images must be listed in the bank-approved media library. Demo destinations cannot be sent. Marketing/newsletter/promotion templates are excluded from this staff pathway. This is **not** a replacement for opted-in marketing broadcasts.
- The scheduled cancel action is limited to creator or bank administrator, and only when all recipient delivery rows remain untouched. Cancelled rows are marked skipped and audit-logged.
- No provider calls are issued by the SQL migration. The worker remains behind bearer-secret authentication. No live sending flags are modified by this release.

## Database installation
1. Back up database and source. Confirm previous SQL migrations through 051 are applied. Review any failed migrations before continuing.
2. Execute `supabase/migrations/055_charis_campaign_composer.sql` once in Supabase SQL Editor.
3. Execute `supabase/verification/055_charis_campaign_composer_readonly.sql` (all checks should be true).
4. Deploy application code **after** the SQL migration to avoid selecting columns that have not yet been created.

## Environment and scheduling
The existing direct workflow requires `CHARIS_SIMPLE_SENDING_ENABLED=true`, `EMAIL_DELIVERY_ENABLED=true`, properly configured verified email senders and service-role credentials. Do not turn those settings on solely to demonstrate the new interface.

Scheduling is **OFF** unless the Vercel environment has `CHARIS_SCHEDULING_ENABLED=true`. Before enabling it, separately verify that the existing `.github/workflows/charis-delivery-worker.yml` GitHub Actions workflow is running at the expected cadence (it is controlled by repo variable `CHARIS_EMAIL_WORKER_ENABLED=true`) or supply a trustworthy scheduler calling `POST /api/worker/delivery` with `EMAIL_WORKER_SECRET`. Check provider rate limits, daily cap, service-role access, and authenticated logs. Scheduling is best-effort, not minute-precise.

## Production QA checklist (test recipients only)
1. Use Node **24** and run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; fix real failures before pushing.
2. On 360px/390px phones, tablet and desktop, run the 3 steps for plain Email and SMS (if explicitly activated). Verify mobile sidebar and buttons.
3. Select, edit and preview a General template. Verify customer-first-name rendering, demo-link rejection, image-library restriction, WAT schedule conversion, and correct email preference footer.
4. Verify staff without sending access cannot use the composer. Approval switch OFF should queue without review; ON should hold until an authorised approver approves.
5. With the scheduler disabled, confirm **Schedule** does not appear and server action rejects forged schedule submissions.
6. After staging worker setup, verify a scheduled campaign is not claimed early; check batch release after due time, provider accepted vs actual delivery, and safe cancellation with audit entry.
7. Verify optional unsubscribe/resubscription remains functional, and archived or bounced addresses never receive a direct manually-composed email.
8. Check logs and report real TTFB, LCP, INP, CLS; source-level reductions are not wall-clock performance metrics.

## Known limitations
- No database execution or production provider sending was performed while preparing this ZIP.
- A production build was unavailable in the current environment (Node 22, `npm ci` missing network/cache packages); deployment requires the verification above.
- Templates are sampled and filtered for staff use, but external campaign delivery webhooks are unchanged. “Provider accepted” does **not** mean inbox delivered.
- The service-notice workflow cannot become a promotional marketing platform without separate recipient consent and provider policy compliance.
- Automatic 3/4-day loan reminder rules remain a **future release**. Release 055 does not alter credit collection rules.
