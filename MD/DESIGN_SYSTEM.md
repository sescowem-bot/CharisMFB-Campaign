# Charis design system

The source uses the official Charis Microfinance Bank identity and a **clean Claude-inspired layout**: white navigation sidebar, compact top bar, light lavender canvas, generous whitespace and a restrained purple/green palette.

## Core palette

| Purpose | Color |
|---|---|
| Primary purple | `#40239A` |
| Deep purple | `#2A1670` |
| Midnight indigo | `#140A38` |
| Brand green accent | `#38EF92` |
| Background lavender | `#F7F6FC` |
| Cards | `#FFFFFF` |

Actual CSS custom properties are maintained in `app/charis-design-v3.css` and `app/charis-claude-faithful.css`. Avoid adding a fourth competing theme stylesheet.

## Typography
Prefer Century Gothic for main display headings when installed, with safe system fallbacks. Keep long form descriptions, tables, buttons and metrics easy to read in body UI fonts. Do **not** ship unlicensed font files.

## Product rules
- Show actions in a natural order and in straightforward English.
- Group navigation into campaigns, customers and configuration.
- Use predictable button positions and consistent field labels across modules.
- Keep technical Resend Domain IDs, DNS registration, developer messages and multi-tenant controls away from everyday bank staff.
- Offer contextual explanations for consent, templates, segments and campaign states.
- Preserve focus indicators, keyboard access, reduced-motion support and mobile overflow handling.
- Make Test email, Submit, Approve/Reject and Send approved campaign clearly different actions.

## Assets
Approved logo: `public/charis-official-logo.png`. Approved brand mark and favicon assets are in `public/`; admins can replace allowed assets using Brand & media.

## Approved design requirement: full visual campaign canvas (future Batch 2)
The user requests a genuine drag-and-drop email design experience, **not merely coloured content blocks**. The eventual canvas must support inserting rectangles, circles, pill badges, banners and shapes; typing and editing text inside the shapes; foreground/background colour, opacity, borders, size, padding, alignment, movement, layer order, undo/redo, reusable groups and responsive preview. Implement email-safe export (table-backed/rasterized-safe fallbacks as required), with sanitization and approved bank-hosted images. Never promise arbitrary browser/CSS effects will render identically in Gmail, Outlook and mobile email clients. This capability is NOT part of Migration 027 and should not be marked shipped in Batch 1.


## Batch 2A: visual template canvas
Implemented selectable email sections, drag-to-reorder with keyboard/button alternatives, inline shape text, rectangle and oval shapes, fill/text/border colours, width, height, padding, type size, alignment, duplication, bounded undo/redo and narrow-screen preview. Shape text remains escaped by the existing renderer; only validated structured properties are stored. Media still uses the bank-approved library. No template approval gate is added.

This is a flow-based email canvas. Free-position overlays, layer stacking, opacity, reusable groups and multi-column editing remain pending; do not call this the complete Phase 04 designer. Border radius may appear square in older Outlook clients; content remains readable. Preview is illustrative, not an inbox screenshot. Design undo does not change template metadata. Scoped editor CSS lives beside the component and does not redefine the global theme.
