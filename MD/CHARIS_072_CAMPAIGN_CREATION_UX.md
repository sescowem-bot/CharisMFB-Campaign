# Release 072 — Create Campaign usability

- Simplified the four-step journey to Write message, Recipients, Preview, Send.
- Replaced the broken nested-span step tracker with a responsive ordered list and isolated CSS, fixing overlapping text/number boxes.
- Replaced the channel selector with distinct Email and SMS choice buttons. Hide unavailable channels.
- Clarified message purpose with plain-language labels and short explanations; it remains distinct from the optional banking product.
- Made product selection opt-in and keep the stored backend product set to general unless staff explicitly choose another product.
- Moved saved design selection to an optional disclosure and clarified that templates control appearance, not sending/audience.
- Added shared Undo and Redo for the subject, body and email design, including loading a saved template. Limited to the last 80 changes; Undo does not change recipients or trigger sending.
- Existing explicit recipient selection, Preview, confirmed Send, approval requirements and sending validations are preserved.
- No SQL migrations, secrets, provider settings or extra deployment branches.
- Verified manual browser checks at 1480, 1100, 820, and 390 px: no step-card overlap, no horizontal overflow, no page errors; confirmed Undo, Redo, optional product and template flow.
- Live authenticated staff acceptance and real provider email delivery require independent verification.
