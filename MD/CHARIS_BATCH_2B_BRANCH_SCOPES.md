# Charis Campaign Centre — Recovered Batch 2B (Migration 029)

This release extends the saved **028 Visual Template Studio** project. It introduces administrator-managed branches, staff visibility settings and branch assignment for customer records. It preserves existing contacts, departments, archived items, subscriber preferences, campaign history and provider configuration.

## What works in this release

- An authorised Charis administrator can create, rename and archive branches; no branch directory is hardcoded.
- The system owner or a delegated access administrator can allow a staff member bank-wide visibility or restrict them to selected branches. An administrator cannot alter their own scope or the system owner.
- Existing staff are grandfathered for bank-wide *visibility* at migration time to avoid unexpectedly interrupting ongoing operations. New staff have no bank-wide visibility until assigned.
- A bank-wide contact administrator can allocate customers to existing branches and optional dynamic departments.
- Staff with `customers.view` can open **Customer workspace** and see only customers whose branch matches their assigned branches. Unallocated customers are available only to authorised bank-wide viewers. Contact RLS enforces this, not merely interface filters.
- Branch-scoped staff have read-only customer access in this milestone. The older customer write RPCs still require bank-wide `customers.manage`.
- This release intentionally refuses branch-only access to legacy campaign/report functions until those endpoints can enforce matching branches. No new customer messages are sent.

## Installation (not executed for you)

1. Keep the current Supabase project; **do not reset** or rerun the fresh installer. Ensure 027 is installed, then apply `028_charis_visual_template_canvas.sql` if not already installed, then `029_charis_branch_customer_scopes.sql`.
2. Deploy source after the bank's change approval. The current repo `main` does not yet contain 028/029; review the full source archive before deployment.
3. In Charis go to **Branches** to create entries; then invite verified staff from **Team Access** and assign them in **Branches**. A new staff member with no assigned branch may see no customer records.
4. Assign customer responsibility for existing customers through the Branches page. The selector shows the most recent 100 unarchived customers; customer matching/bulk branch allocation can be added with Phase 10.
5. Use the Help & workflows page for a staff-facing explanation. Do not enable real outbound delivery as part of this install.

## Explicit boundary

This is an incremental customer-read security milestone, **not yet an end-to-end banking data segmentation certification**. Existing list imports, audience and campaign authorisation, reports, and other security-definer operations must undergo branch-specific enforcement before enabling branch-only campaign roles. The backend denies branch-only campaign, report, approval and customer-edit capabilities at the permission evaluator, but every legacy RPC and cross-table RLS policy still requires review. Do not use customer segmentation as a guarantee that every existing feature is branch-isolated.

## Next development (Batch 3)

Phase 05 (started): Unified Communications workspace now shows Email and SMS side by side, with current statuses and links to existing editors, approvals and delivery. **Still remaining:** consistent cross-channel recipient picker and bank-configurable approval policy (per-role and per-workflow). Existing independent review and provider safeguards stay in place.

Phase 06: Secure loan register (manual/CSV loan data, maturity/due dates, balance, repayment status, ownership by authorised Credit staff, audit changes). Avoid full bank account numbers, BVN/NIN, passwords, or other high-risk identifiers in campaign import files.

Batch 4 then connects configurable Credit approvals and reminders to approved delivery providers. Approval settings must be per-role/per-workflow, and no unnecessary testing or technical chatter should appear for ordinary bank staff.
