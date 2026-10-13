'use client';
import {useState, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Eye, EyeOff, Loader2} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

/** Staff sign-in. Accounts are created by invitation only, so there is no public registration. */
export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const client = supabaseBrowser();
      const {error} = await client.auth.signInWithPassword({email, password});
      if (error) throw error;
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <label>Work email
        <input required type="email" autoComplete="email" placeholder="you@charismfb.com" value={email} onChange={e => setEmail(e.target.value)}/>
      </label>
      <label>Password
        <span className="password-wrap">
          <input required minLength={8} type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}/>
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
        </span>
      </label>
      {message && <p role="alert" className="feedback-error" style={{margin: 0}}>{message}</p>}
      <button className="btn" disabled={busy} type="submit">{busy ? <><Loader2 size={16} className="animate-spin"/> Signing in…</> : 'Sign in'}</button>
    </form>
  );
}
