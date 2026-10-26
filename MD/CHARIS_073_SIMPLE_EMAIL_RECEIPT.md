# Release 073 — Branded Simple Email and campaign confirmation

## Staff experience
- After campaign creation, an accessible confirmation dialog opens instead of provider-level dispatch figures at the bottom of the form.
- Wording distinguishes submitted, awaiting approval, scheduled, and attention-required states. Submitted does not imply confirmed inbox delivery.
- The dialog links to the campaign's status page and offers a Close control; the server still blocks resubmitting an already-created campaign.
- Simple Email uses the validated, email-safe branded HTML renderer shared with saved templates, both in preview and provider delivery.
- Four optional layout choices without a saved template: Classic, Modern, Minimal and Highlight.
- Greeting is editable and defaults to a personalised first name. Customer-detail picker works in simple emails and saved templates. Account numbers remain masked to their last four digits.
- Changes to appearance, greeting, body and subject use the existing Undo/Redo history.
- Existing bank branding, opt-outs, provider routing, approvals and final confirmation checks remain.
- No SQL migrations, credentials, new environment or staff test messages are needed.

## Verification
- Focused automated checks, lint, typecheck and production build pass.
- Full regression suite: 352 passed, 17 historical failures unchanged.
- Browser test confirmed four styles, personalised greeting, masked account fields, HTML preview, Undo/Redo, disabled Send without authorisation, confirmation dialog, and no phone horizontal overflow.
- No customer messages were sent during testing. Authenticated production acceptance remains separate.
