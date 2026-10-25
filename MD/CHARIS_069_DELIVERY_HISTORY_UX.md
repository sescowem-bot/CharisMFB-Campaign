# Release 069 — Campaign history and delivery clarity

## Staff-facing changes
- Campaign history now provides a searchable, status-filtered list and overview counts.
- Clear English labels show the difference between a pending campaign, a processed campaign, and an actual delivery event.
- Delivery details include a status breakdown, message preview, WAT timestamps, provider failure reasons when available, and filtered recipient outcomes.
- A manual Refresh results link retrieves the latest database records. No unsupported "live" or "inbox delivered" claims are made.
- Administrators have a discoverable Staff-only test email link to existing Sender Settings. This DOES NOT create a new send path; the existing server action verifies staff identity, sender/domain status, recipient lock and reserved test limits.
- Existing authorisation checks, approval actions, scheduled cancellation and archive controls remain.

## Verification
- TypeScript, ESLint and production build pass.
- Automated browser tests validated campaign search, pending filter, delivery filter, and no 390px mobile horizontal overflow.
- Customer addresses/phone numbers are not added to the outcomes component.
- No emails or SMS were dispatched in development.
- Authentication and actual production provider event processing require sign-in/live acceptance, not inferred from the preview tests.

## Delivery constraints
- No new SQL migration or environment secrets required.
- Full historical suite contains known older failures; release-specific tests must pass without introducing new failures.
