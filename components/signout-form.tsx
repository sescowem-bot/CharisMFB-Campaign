'use client';
import {useActionState} from 'react';
import {LogOut} from 'lucide-react';
import {signOutAction} from '@/app/auth/signout/actions';

export function SignOutForm() {
  const [state, action, pending] = useActionState(signOutAction, {});
  return <form action={action} className="sidebar-signout">
    <button type="submit" disabled={pending}><LogOut size={16}/>{pending ? 'Signing out…' : 'Sign out'}</button>
    {state.error && <p role="alert" className="sidebar-signout-error">{state.error}</p>}
  </form>;
}
