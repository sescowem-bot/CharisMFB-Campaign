# Charis Campaign Centre — Vercel ESLint build fix (26cd061)

This hotfix addresses four `react/no-unescaped-entities` build errors in three files reported on October 13, 2026. It does not change email, contact, approval, or database logic.

Corrected files:
- `app/dashboard/campaigns/page.tsx` (2 JSX text apostrophes)
- `components/bulk-list-manager.tsx` (1 JSX text apostrophe)
- `components/campaign-studio.tsx` (1 JSX text apostrophe)

### Install the hotfix

Extract the ZIP into your existing local Charis-Campaign-Centre Git repository, preserving folder structure and replacing the three files. Then run:

```bash
 git status
 git add app/dashboard/campaigns/page.tsx components/bulk-list-manager.tsx components/campaign-studio.tsx
 git commit -m "Fix JSX escape errors in Charis campaign workflow"
 git push origin main
```

Use the full ZIP only if your project matches the source at GitHub commit `26cd061`, or after reviewing diff. Do not overwrite a newer checkout blindly.

Full `npm run build` needs Node 24 and dependencies. Validate on Vercel after pushing. No database SQL, env, or provider changes needed.
