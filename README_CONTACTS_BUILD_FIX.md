# Charis Vercel build fix: Contacts page (commit 8860a56)

Fixes the TypeScript error at `app/dashboard/contacts/page.tsx:28`:
`Type 'string | undefined' is not assignable to type 'string'`.

Cause: `params.org` was not narrowed inside the `.map(c => ...)` callback for `ContactRowActions`.
The fix stores `params.org` in an immutable `org` constant, checks it, and passes
`org` to the button component. No database changes.

## Apply

1. Extract the ZIP.
2. Copy `app/dashboard/contacts/page.tsx` into the same path in your
   existing Charis repository, replacing ONLY that file.
3. Run `npm run typecheck` and `npm run build` in your local Node 24 environment.
4. If successful, commit and push the fix:

```bash
git add app/dashboard/contacts/page.tsx
git commit -m "Fix customer actions TypeScript build error"
git push origin main
```

This fix is based on the exact file at GitHub commit 8860a56, so
compare changes if your repository has been updated since that commit.
It has not been pushed or deployed, and a full build has not yet been verified.
