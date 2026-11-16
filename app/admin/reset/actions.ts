'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { charisOrgId } from '@/lib/bank';

export type ResetActionState = {
  error?: string;
  data?: unknown;
  success?: string;
};

async function superAdminClient() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  const { data: staff, error } = await db
    .from('platform_staff')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || staff?.role !== 'super_admin') {
    throw new Error('Only a platform Super Admin can access workspace reset.');
  }
  const org = charisOrgId();
  if (!org) throw new Error('The Charis workspace ID is not configured.');
  return { db, org };
}

export async function previewWorkspaceReset(): Promise<ResetActionState> {
  try {
    const { db, org } = await superAdminClient();
    const { data, error } = await db.rpc('charis_reset_workspace_preview', { p_org: org });
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to prepare reset preview.' };
  }
}

export async function runWorkspaceReset(
  _previous: ResetActionState,
  formData: FormData
): Promise<ResetActionState> {
  try {
    const { db, org } = await superAdminClient();
    const phrase = String(formData.get('confirmation') || '');
    const { data, error } = await db.rpc('charis_reset_workspace', {
      p_org: org,
      p_confirmation: phrase,
    });
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/communications');
    revalidatePath('/admin/providers');
    return { success: 'Test workspace data has been reset.', data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Workspace reset failed.' };
  }
}
