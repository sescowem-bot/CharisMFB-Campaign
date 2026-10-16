# Charis Campaign Centre — Release 049

## Scope

This is a **targeted UX and reporting repair** built from the provided 048 full-source package. It does not replace the Resend API implementation, send customer messages, reset databases, or modify existing sent message records on installation.

### Included
- Communications page is the normal route for new messages; direct sends follow the Release 047 optional-approval policy.
- Old Campaign Studio is labelled **Previous campaigns**. Standard create links route to Communications, while previous designs/approvals are retained under the advanced legacy path.
- Resend Broadcast delivery is shown as **Submitted to Resend** when the provider submission was acknowledged. Intentionally paused legacy runs are no longer displayed as if the broadcast remained unsent in the queue view. A broadcast-specific report avoids misrepresenting legacy pending snapshot rows.
- Cleaner staff-facing labels, less repetitive guidance, one subject field rather than duplicate title and subject inputs.
- Permissioned communication-history management: Super Admin/communication administrators can archive finished direct messages, restore them, or permanently delete **unapproved, never-sent direct messages only**. Administrator may delegate that right to a staff member using Communication Settings. Every action is audited. Already-sent or uncertain-outcome records are not deleted. Existing customer archive/delete remains under the existing customer module permissions.
- Preserves the previous 048 bank website link safeguards.

### Not included / not yet certified
- Full convergence of rich legacy campaign design into the new direct-service composer. The new direct composer still creates branded text-based service emails; its visual template sending needs a future integration.
- Reconciliation of individual Resend Broadcast delivery events via webhook. A broadcast `submitted` flag demonstrates provider acceptance, not inbox delivery; the inbox result must be checked in Resend. Do not resend an existing accepted broadcast.
- Production deployment or live provider execution. This release has **not** been pushed to GitHub, and SQL 049 has **not** been executed against the production Supabase instance.
- Full Node 24 Next.js production build verification. Local environment supplies Node 22 and lacks the project dependency tree. Source parsing and focused tests are performed instead.

## Install order
1. Back up your current GitHub commit and Supabase data before deploying changes.
2. Confirm that migration `047_charis_simple_communications.sql` was applied successfully. **Do not rerun 047 without checking the deployed schema.**
3. Run `supabase/migrations/049_charis_communications_history_permissions.sql` as a **whole script** in Supabase SQL Editor. It contains no data deletion.
4. Run `supabase/verification/049_charis_communications_history_verify.sql`. Expect all six boolean columns to be `true`.
5. Merge the Release 049 changes into your working project. Preserve your `.git` and `.env` files; review differences if the live GitHub branch has changed after commit `a1716d951efc1b10ac14f0933203843c86cf822e`.
6. On Node 24, execute `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Do not push if any checks fail. Only deploy after confirming the changes in a test deployment.
7. Open `/dashboard/communications`, `/dashboard/communications/new`, and `/admin/communications` under authorised test accounts. Verify approval is **Off** in the communication settings. For real service emails, set an authorised provider sender once in Communication Settings. The legacy Resend **marketing** route is a separate configuration and does not by itself activate service email sending.
8. Verify `/dashboard/delivery` and `/dashboard/reports?run=...` show an already submitted Resend Broadcast as **Submitted to Resend** without treating legacy snapshot rows as unsent emails. Verify its receipt in Resend; do **not** send it again.
9. Assign staff permissions to manage message history if required. Archived message records can be restored; sent or uncertain delivery records cannot be hard-deleted by this UI. For customers, use the existing customer archive/delete tool and its data-retention safeguards.
10. If immediate sending to more than three recipients is required, verify the `EMAIL_WORKER_SECRET` + scheduled worker integration is active. The direct workflow initially dispatches three recipients during the page action; additional messages need the worker. Do not show “Delivered” until a provider event confirms it.

## About Resend unsubscribe branding
Resend Broadcasts use managed audiences and unsubscribe pages; to change the branding, visit https://resend.com/settings/unsubscribe-page. Resend's public documentation states that changing the logo/colours/message is supported and removing **Powered by Resend** requires Pro or higher. Normal bank service notices can be sent using Resend's `/emails` API without using a Broadcast, when appropriately classified and authorised. Any future marketing email API path still requires valid consent and unsubscribe handling.

## Existing record and migration safety
- SQL 049 adds columns, policies and guarded RPC functions; it does not `DELETE` production rows at installation time.
- Staff cannot delete sent records. Hard deletion is explicitly limited to an unapproved, completely unsent communication with only pending recipient snapshots.
- Existing legacy campaigns and loan reminders remain unchanged, and are not silently migrated or resubmitted.
