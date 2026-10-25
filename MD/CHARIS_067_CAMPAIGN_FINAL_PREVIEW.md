# Release 067 — Reliable campaign preview through final confirmation

## Delivered
- Corrects a workflow gap: previously the HTML preview was only generated on the third wizard step (Preview), and the final confirmation step showed just a subject/recipient summary.
- Renders the same design-backed email HTML format in both the Preview and Confirm & Send steps. The final confirmation displays the actual preview before authorisation, with desktop and mobile options.
- Introduces a full HTML preview for simple email messages, which previously displayed only plain text. The preview mirrors the direct delivery wrapper and escapes user-entered content. This is a **preview only**; actual opt-out links are minted securely during sending.
- Uses a selected sample recipient's first/last name in the designed-email preview. List/all audiences show generic sample details.
- Shows the rendered subject line (including supported first-name substitution) alongside the email.
- Loads preview frames only on active review steps, not while composing or when the other step is hidden. Uses a sandboxed iframe without parent scripting, with a visible loading state, a reload button and mobile inspection.
- SMS continues to use its plain-text review, not an HTML email frame.
- Sending remains protected behind step-four confirmation and server-side permission, eligibility and provider checks. No customer communications were transmitted during testing.

## Verification
- TypeScript, ESLint, production build, focused rendering tests and an automated browser walkthrough.
- Browser walkthrough covered designed template -> selected fixture contact -> Preview -> Confirm & Send (without submitting) and simple email -> Preview. Confirm & Send remained disabled without consent.
- Authenticated real-bank acceptance is still required to confirm the workflow with real contact/group permissions, sender settings and worker state.
- Staff test-email sending and provider dispatch are unchanged; no SQL migration is required.
