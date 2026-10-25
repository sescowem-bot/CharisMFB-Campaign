# Release 066 — Professional Template Library and Studio

## Navigation
- /dashboard/templates: searchable gallery of ten starter designs and a distinct Saved Templates collection; not combined with the editor.
- /dashboard/templates/new: create from a blank design or copy a starter; the newly created template is separate from all previously saved templates.
- /dashboard/templates/[id]/edit: edit a chosen organisation-owned saved template. Shared templates are copied, never overwritten. Legacy edit links redirect appropriately.
- Successful new-template saves open the newly saved edit page.

## Designer
- Custom GrapesJS editor: left element palette, central canvas, right settings.
- Visible shape tools: banner, panel, rectangle, pill, circle, accent line and divider, plus heading, text, approved images and linked buttons.
- Desktop and mobile canvas switching. Default GrapesJS developer toolbars hidden.
- Edit text, fill/text colour, size, alignment, padding, duplicate/remove and reordering. Actual email HTML opens in a dedicated modal.
- Existing detailed editor, undo/redo, draft backup, approved image upload and server validation are preserved.
- No SQL migrations or new secrets needed.

## Quality and acceptance
- TypeScript, lint, local production build, dedicated automated editor tests and unauthenticated smoke tests were run.
- Authorised production testing for saving/reopening with real Supabase accounts is still required.
- This release does not alter the customer sending provider workflow.
