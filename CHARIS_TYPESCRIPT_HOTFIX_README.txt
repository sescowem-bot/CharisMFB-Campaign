CHARIS CAMPAIGN VERCEL TYPESCRIPT HOTFIX
=====================================

Build error:
  app/dashboard/campaigns/page.tsx:46:13
  Type error: existingRun.data.length is possibly undefined.

Fix:
  Before: existingRun.data?.length>0
  After:  (existingRun.data?.length ?? 0)>0

OPTION A - Fast GitHub fix
1. Open app/dashboard/campaigns/page.tsx in GitHub.
2. Replace the expression as shown above.
3. Commit to main and watch Vercel redeploy.

OPTION B - Upload the fixed file
1. Unzip Charis_Campaign_TypeScript_Hotfix.zip.
2. Replace app/dashboard/campaigns/page.tsx in your project.
3. Run git add app/dashboard/campaigns/page.tsx
4. Run git commit -m "Fix campaign run length TypeScript error"
5. Run git push origin main

OPTION C - Replace the whole project
Charis_Campaign_Full_Source_TypeScript_Fixed.zip contains your last packaged
Charis codebase with this one-line repair; do not overwrite newer changes.

Verification:
- The modified file was syntax-parsed with TypeScript without errors.
- A complete dependency-backed build could not be run here because the
  environment has Node 22, whereas this project requires Node 24, and npm ci
  did not complete successfully. Vercel must perform the final build check.
- No changes to Supabase SQL are required for this TypeScript error.
