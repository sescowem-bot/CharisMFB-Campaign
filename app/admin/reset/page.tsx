import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { WorkspaceShell } from '@/components/workspace-shell';
import { charisOrgId } from '@/lib/bank';
import { WorkspaceResetPanel } from '@/components/workspace-reset-panel';

export const dynamic = 'force-dynamic';

export default async function ResetWorkspacePage() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const { data: staff } = await db
    .from('platform_staff')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (staff?.role !== 'super_admin') redirect('/dashboard');

  const org = charisOrgId();
  if (!org) redirect('/setup-required');

  return (
    <WorkspaceShell admin title="Reset workspace data" subtitle="Remove test records and start with a clean Charis campaign workspace.">
      <main className="charis-reset-page">
        <p><Link href="/admin">← Back to administration</Link></p>
        <WorkspaceResetPanel />
      </main>
    </WorkspaceShell>
  );
}
