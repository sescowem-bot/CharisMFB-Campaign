# Charis MFB Campaign Centre — setup, operations and go-live

Version 0.15.0. A single-organisation deployment of the Sesco campaign engine (`APP_MODE=single`, the default).
The database schema still carries `organization_id` on every row, with exactly one organisation. This keeps
row-level security and isolation tests intact and leaves a clean path back to multi-company later.

## 1. What single mode changes

| Area | Behaviour |
| --- | --- |
| Public website | Removed. `/` goes to login (or the app when signed in). Pricing, features, solutions, FAQ, about, contact, resources return to login. Privacy, terms and cookies remain for unsubscribe and legal links. |
| Registration | Disabled in the app (`/register` redirects). Accounts are created by an administrator. |
| Billing and plans | Hidden. Billing API routes return 404. Sending is governed by the workspace monthly allowance, not subscriptions. |
| Company switching | Removed. The single Charis organisation opens directly. |
| Approval | Maker-checker enforced. The person who edited or submitted a campaign can never approve it, and administrator self-approval is **off** by default (migration 015). |
| Sender setup | Done by an administrator in **Sender connection** (existing Resend domain). |

## 2. Install

1. Create a new Supabase project. In **Authentication → Providers → Email**, turn **off** "Allow new users to sign up".
2. In the SQL Editor run `supabase/SESCO_Complete_Fresh_Install.sql` once (migrations 001–015), then `supabase/seed_charis.sql`.
3. Create the first administrator: **Authentication → Users → Add user**, enter their email and a strong password, tick **Auto confirm user**.
4. Make them Super Admin (replace the email):

```sql
insert into public.platform_staff(user_id, role)
select id, 'super_admin' from auth.users
where lower(email) = lower('ADMIN_EMAIL') and email_confirmed_at is not null
on conflict (user_id) do update set role = 'super_admin';
```

5. Copy `.env.example` to `.env.local` (local) or set the same variables in Vercel. Use Node 24. Keep `EMAIL_DELIVERY_ENABLED=false`.
6. `npm ci`, then `npm run dev` (or deploy from GitHub to Vercel). `npm run check:release` validates configuration names without printing secrets.
7. Sign in, open **Brand identity** and **Brand Studio**, and enter the Charis logo, colours and registered postal address from the approved brand guide. A postal address is required before any campaign can be approved.

## 3. People and roles

Create each user in Supabase Auth (auto-confirm), then assign the role in **Team & roles**. Invitation emails are not built yet.

| Charis function | Role | Can |
| --- | --- | --- |
| Marketing / customer service officer | `designer` | Draft campaigns and templates |
| Marketing lead | `manager` | Draft, manage contacts and lists, queue approved campaigns |
| Internal Control & Compliance reviewer | `approver` | Approve or reject (never their own work) |
| Application administrator | `company_admin` | All of the above, plus team management |
| Reporting only | `analyst`, `viewer` | Read reports |

Super Admin is a platform-level role with every power, including sender connection and provider settings. Give it to one or two IT administrators only.

## 4. Sending and capacity

- Delivery is a database queue. Approved campaigns are queued, then a worker sends them.
- Each worker call now runs a **time-budgeted batch** (default 100 s) and sends about one email per provider spacing interval (default 2 s, so roughly 45 per call). Raise throughput by lowering the provider minimum interval in **Email providers** (and `EMAIL_WORKER_SPACING_MS` to match) within your Resend plan limits, and by running the worker every minute.
- Schedulers: set `EMAIL_WORKER_SECRET` (32+ characters). Vercel Cron (Pro plan) can call `GET /api/worker/delivery` every minute if `CRON_SECRET` equals the worker secret. The repository also ships `.github/workflows/delivery-worker.yml` (every 5 minutes, enabled by setting the repository variable `DELIVERY_WORKER_ENABLED=true` and secrets `APP_URL`, `EMAIL_WORKER_SECRET`). Do not add a per-minute `vercel.json` cron on a Hobby plan; it fails deployment.
- The default provider daily budget is 100 emails. Set the real figure in **Email providers** to match the Resend plan.
- The workspace monthly allowance defaults to 10,000. Change `platform_workspace.monthly_email_limit` in SQL if needed.

## 5. Go-live checklist (all currently Pending — see `LIVE_ACCEPTANCE.md`)

1. Staging deployment with real Supabase, domain and Resend; RLS verified with an administrator, designer, approver and viewer account.
2. Sender domain verified; SPF, DKIM and DMARC pass.
3. Test send to an internal inbox; check rendering on Gmail, Outlook and mobile.
4. Controlled consented send to a small internal list; confirm provider events and **one-click unsubscribe** and suppression work.
5. Maker-checker walkthrough: designer drafts, approver approves, administrator queues; confirm the editor cannot approve.
6. Compliance sign-off on consent capture, retention, the privacy and terms pages (they still contain placeholder text), and the regulatory footer wording.
7. Backup and restore rehearsal (`BACKUP_RECOVERY.md`).
8. Set `EMAIL_DELIVERY_ENABLED=true` only after the steps above.

## 6. Known limits (planned, not built)

SMS and WhatsApp; invitation emails; image/logo and multi-column email blocks; test-sends by non-administrators (currently Super Admin only); direct ILRMS customer sync (use CSV/Excel import with the existing column mapping); a summary dashboard home screen.
