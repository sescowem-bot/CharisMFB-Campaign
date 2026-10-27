'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '@/lib/supabase/browser';
export default function ForgotPassword(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const {error:failure}=await supabaseBrowser().auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:new URL('/auth/reset-password',window.location.origin).toString()});
   if(failure)throw failure;
   setDone(true);
  }catch{setError('The reset service is unavailable or rate-limited. Try again later or contact the bank administrator.');}
  finally{setBusy(false);}
 }
 return <main className="shell section" style={{maxWidth:560,margin:'8vh auto'}}><section className="panel">
  <h1>Charis Campaign Centre</h1><h2>Reset your password</h2>
  {done?<p role="status">If the address belongs to an authorised staff account, a secure reset link has been sent. Check your inbox.</p>:
  <form className="admin-form" onSubmit={submit}><p className="muted">Enter your registered staff email to receive a secure password link.</p>
   <label>Staff email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button className="btn" disabled={busy}>{busy?'Requesting…':'Send password link'}</button>
   {error&&<p className="feedback-error" role="alert">{error}</p>}
  </form>}
  <p><Link className="inline-link" href="/login">Return to sign in</Link></p>
 </section></main>;
}