# Charis login, dashboard and Campaign Lead update

## What changed
- Signed-in users visiting `/login` are redirected to `/dashboard`. The browser login completes with a single full navigation.
- Middleware no longer performs a redundant Supabase authentication call on public pages and static files. Protected dashboard requests still verify sessions.
- Dashboard statistics and recent campaigns load with a single authorised Supabase RPC instead of seven counts plus separate membership lookups.
- Branding image URLs are cached for five minutes with explicit invalidation on upload.
- Team Access supports Campaign Lead: can create, approve another person's campaign, and dispatch approved campaigns. It cannot administer the team; it may not self-approve.

## Installation
1. Back up your Charis Supabase project before running migration `019_charis_dashboard_and_campaign_lead.sql`.
2. Run migration 019 in your **existing** database, once. Do not rerun the original install scripts.
3. Copy the updated project to your Git checkout and deploy on Vercel with Node 24.
4. Test a previously signed-in user visiting `/login`: it should immediately redirect to `/dashboard`.
5. In Team Access, invite or update a staff member as Campaign Lead. Confirm another approver handles campaigns created by that person.
6. Verify first-page response times in Vercel logs and browser Network tools. Actual latency still depends on Vercel/Supabase region and provider response.

## Security
- Auth enforcement for dashboard routes stays enabled in middleware and server pages.
- `charis_dashboard_overview` authorises via the current logged-in user and the exact organisation ID. It returns no customer PII.
- No customer marketing is sent without an approved campaign.
- Independent review and audit logging remain in place.
- Never put service-role keys in browser variables.
