# Charis Campaign Centre - Management Demo Release 080
**Date:** 26 October 2026
**Management demo:** Tuesday, 27 October 2026
**Scope:** Charis Microfinance Bank only

## Release goal
Reorient the interface around everyday staff tasks, keep engineering setup under Administration, make reporting easy to locate, and explain credit reminders as repayment workflows. Do not claim a new live sending integration or database reset merely because code exists.

## Key interface changes
1. Removed Zoho Mail & Test and ZeptoMail Notices as top-level staff menu items.
2. Email delivery and provider tests are now accessible through Administration > Email delivery settings. The browser pages themselves require provider administrator privileges.
3. The two reporting pages have explicit links: Campaign Reports and Operations Reports. Campaign Reports includes an Export CSV option. Super administrators can open both.
4. Sidebar profile summary no longer exposes the logged-in email/administrator label on the main workspace. The account email, verification and role are accessed through the bottom-of-sidebar My profile page.
5. The Administration landing screen is a task-oriented set of management links rather than a prominent system-owner identity block.
6. Loan portfolio, repayment reminders and loan follow-ups now use clearer customer/credit-operations wording.
7. Removed the prominent top-bar email delivery flag because it could be mistaken for proof of working customer delivery. Sending controls in server actions and delivery workers remain in place.

## Staff navigation
- Dashboard: overview of available bank workspace activities
- Create Campaign / Campaigns: audience, compose, preview, confirm, track
- Contacts: find, add, import, group
- Credit Operations: Loan Portfolio, Repayment Reminders, Loan Follow-ups
- Workspace: Campaign Reports, Operations Reports, notifications, help
- My profile: account email and role information

## Administrator navigation
- People & access: delegated staff permissions and authorisations
- Departments & branches
- Communication settings
- Email delivery settings: Resend/Brevo/Mailjet/SendGrid, staff Zoho SMTP diagnostics and ZeptoMail Mail Agent testing
- Campaign Reports and Operations Reports (where permitted)
- Brand & media
- Audit history

## Credit operations: approved claims
- Loan Portfolio: working register. Figures must be checked against the bank's official core banking source.
- Repayment Reminders: prepare and track customer-specific repayment communications, subject to delivery policy and credential readiness.
- Loan Follow-ups: assign and close relationship-officer work.
- A future weekly staff repayment digest is conceptually possible but is not claimed as a completed production workflow.

## Where the reports live
Campaign Reports - https://charismfbcampaign.vercel.app/dashboard/reports
Operations Reports - https://charismfbcampaign.vercel.app/dashboard/insights
The Campaign Reports page has a date filter and CSV export. Operational reporting is not a statutory banking accounting report.

## Management demo route
1. Dashboard - introduce the system as a single-bank customer communications application.
2. Contacts - locate a fictional demo record and explain import/groups without uploading actual customer data.
3. Campaign creation - show write, preview, audience, provider selection and confirmation; do not send to customers.
4. Credit Operations - show loan portfolio, reminders and officer follow-up.
5. Campaign Reports - date range, delivery statuses and Export CSV.
6. Operations Reports - operational visibility and its difference from campaign results.
7. Administration - staff access and Email delivery settings. Do not reveal tokens, SMTP passwords or provider secrets.
8. Finish with remaining readiness checks.

## Production readiness NOT yet verified
- The Supabase integration connected to ChatGPT exposes Business Platform (vvhifvbsczgboeabmdan), NOT a confirmed Charis project. No changes have been made to Business Platform.
- Charis SQL migrations cannot be said to be installed solely because the corresponding source files exist. In particular, 075, 077 and 079 require confirmation in the correct production database.
- No Charis production database deletion or cleanup has been performed.
- No real Zoho Mail, ZeptoMail or bulk email acceptance has been verified for the bank in this release.
- No bank core ledger integration or customer balance accuracy is asserted.

## Safe demo-data preparation
1. Positively identify Charis's production database and take a tested backup.
2. Have management approve which specific demo/test records may be removed.
3. Preserve audit logs, staff accounts, sender identities, consent/opt-out history and migration state.
4. Prefer non-sensitive fictitious contacts, loans and draft campaigns in an authorised demo scope.
5. Verify the presentation account's exact permissions and reporting availability before the demonstration.
6. Perform one separately approved sender-to-staff email delivery check rather than a customer broadcast.

## Quality gates
- TypeScript and lint pass without new errors.
- Production build passes.
- Release 080 tests check navigation, report access, profile privacy, provider admin routing and repayment terminology.
- Full automated suite still has known older regression assertions; compare with the pre-existing failures rather than treating the current count as an all-clear.
- Check the release deployment matches the Git commit and reaches READY.
