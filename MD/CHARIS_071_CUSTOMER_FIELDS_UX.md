# Release 071 — Simple customer details in the email designer

## Staff-facing changes
- Removed the staff-only test-email shortcut from main campaign history and the legacy campaign-test panel from the older page.
- Kept the regression checks in the repository and the controlled sender test in administration; neither should distract staff using the main campaign creation flow.
- New and saved templates have customer-detail choices sourced from uploaded contact columns, plus first name, last name, email address and bank name.
- Staff can click Insert in message or Insert in subject, or insert directly into a selected GrapesJS text element.
- Create Campaign uses the same field choices. Authorised delivery resolves fields per recipient using stored customer attributes.
- Account number/reference aliases are always masked to the last four digits. PIN, password, BVN, NIN, balance and financial amounts are excluded.
- The preview uses illustrative details, not actual bank customer attribute values.
- Template saving rejects unsupported or malformed merge markers.
- Existing contacts attributes and organisation-scoped permissions are reused. No new SQL or secrets.

## Quality
- TypeScript, ESLint, production build, automated rendering checks, and an end-to-end browser field-insertion walkthrough passed.
- No customer messages were sent. Actual live provider delivery remains unverified.
- Historical unrelated test failures are not described as fixed.
