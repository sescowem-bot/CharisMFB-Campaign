'use server';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';

export type SignOutState = {error?: string};
export async function signOutAction(_:SignOutState, _formData: FormData): Promise<SignOutState> {
  try {
    const client = await supabaseServer();
    const {error} = await client.auth.signOut();
    if (error) return {error: 'We could not sign you out. Please try again.'};
  } catch {
    return {error: 'We could not sign you out. Please try again.'};
  }
  redirect('/login');
}
