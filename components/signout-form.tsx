'use client';

import {useState, type FormEvent} from 'react';
import {LogOut} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type SignOutVariant = 'sidebar' | 'button' | 'text';

/** Sign out through the same browser Supabase client used to sign in.
 * Supabase SSR clears auth cookies in the browser, so logout does not depend
 * on proxy Origin / x-forwarded-host behaviour in a Vercel server action.
 */
export function SignOutForm({variant = 'sidebar'}: {variant?: SignOutVariant}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const client = supabaseBrowser();
      const {error: signOutError} = await client.auth.signOut({scope: 'local'});
      if (signOutError && signOutError.name !== 'AuthSessionMissingError') {
        throw signOutError;
      }
      // A full navigation clears protected Next.js client-side page caches.
      window.location.replace('/login');
    } catch {
      setError('Sign out failed. Please try again.');
      setPending(false);
    }
  }

  const sidebar = variant === 'sidebar';
  return <form onSubmit={handleSignOut} className={sidebar ? 'sidebar-signout' : 'charis-signout-form'}>
    <button
      type="submit"
      className={variant === 'button' ? 'btn secondary' : variant === 'text' ? 'account-signout' : undefined}
      disabled={pending}
      aria-label="Sign out of Charis Campaign Centre"
    >
      {sidebar && <LogOut size={16}/>}
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
    {error && <p role="alert" className={sidebar ? 'sidebar-signout-error' : 'feedback-error'}>{error}</p>}
  </form>;
}
