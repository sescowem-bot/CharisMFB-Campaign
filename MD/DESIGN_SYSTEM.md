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
