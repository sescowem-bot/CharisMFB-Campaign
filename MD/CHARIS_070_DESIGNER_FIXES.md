# Release 070 — Template Designer Usability and Shape Accuracy

## User-reported issues and changes
- Undo and Redo are now **visible beside Save and Preview at the top** of Create/Edit Template, not hidden below the design editor. The existing 80-step history and browser-only unsaved draft recovery are retained.
- Delete section and Duplicate are elevated to the top of the selected element settings, with a clearly marked red Delete action. Last remaining email section cannot be deleted because the design schema requires at least one.
- The GrapesJS stage now uses responsive content width, text wrapping and word breaking. Long messages stay inside the canvas in desktop and mobile modes instead of disappearing outside its visible boundary.
- Element controls for shape width/circle diameter, minimum height and delete appear earlier. Border thickness, internal spacing, text size, alignment, shape style and fill/text colours stay editable.
- A true circular element uses equal width and height in the visual editor and in generated email HTML instead of rounding a full-width banner into an oval.
- Expand Canvas lets staff work on a wider canvas without sacrificing access to side tools when the focused view is closed.
- Programmatic editor refreshes are distinguished from user edits to reduce unintended history changes.
- Shape placement and selection remain within the validated Charis email block schema; unrestricted raw HTML is not sent to recipients.

## Scope and checks
- No new SQL migrations, permissions or credentials.
- Keep existing authorised save, delete/duplicate controls, and unsaved-work recovery.
- Confirm in a real browser: add and edit a shape, undo/redo, delete, change its size/colour, switch mobile, and verify long text does not overflow.
- Target recipient email clients (especially old Outlook desktop versions) may not reproduce every rounded corner identically; the editor preview is not an inbox rendering guarantee.
- Authenticated staff production acceptance remains necessary before claiming live use has been fully verified.
