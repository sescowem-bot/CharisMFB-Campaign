'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Eye,EyeOff,LockKeyhole} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

/** Authentication remains entirely Supabase managed; no credentials are stored by the app. */
export function AuthForm({mode}:{mode:'login'|'register'}) {
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const client=supabaseBrowser();
   if(mode==='register'){
    const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/auth/callback'}});
    if(error)throw error;
    setMessage('Check your inbox for a confirmation link. Your administrator must grant workspace access.');
   } else {
    const {error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    // Claim any verified outstanding staff invitation once on sign-in, rather
    // than repeating this database write on every dashboard navigation.
    // Existing members can still sign in if the invitation RPC is unavailable.
    await client.rpc('team_invitation_accept');
    // A full navigation uses the newly written Supabase SSR cookies immediately.
    window.location.replace('/dashboard');
   }
  }catch(err){setMessage(err instanceof Error?err.message:'Unable to sign in. Please retry.');}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="contact-card charis-auth-form" style={{display:'grid',gap:18}}>
  <div><h2>{mode==='login'?'Sign in to Charis':'Create your account'}</h2><p className="muted">{mode==='login'?'Use your authorised staff email and password.':'Your administrator will assign your workspace access.'}</p></div>
  <label htmlFor="charis-auth-email">Staff email address<input id="charis-auth-email" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} style={{display:'block',width:'100%',marginTop:7}} placeholder="you@company.com"/></label>
  <label htmlFor="charis-auth-password">Password<div className="charis-password-field"><input id="charis-auth-password" required minLength={8} type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',marginTop:7}}/><button type="button" className="charis-password-toggle" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
  <button className="btn" disabled={busy} type="submit" style={{width:'100%'}}><LockKeyhole size={17}/>{busy?'Please wait…':mode==='login'?'Secure sign in':'Create account'}</button>
  {message&&<p role="status" aria-live="polite" className="notice" style={{margin:0}}>{message}</p>}
  {mode==='register'&&<p>Already registered? <Link className="inline-link" href="/login">Sign in</Link></p>}
  <p className="muted" style={{fontSize:12,margin:0}}>Access is restricted to authorised staff. Never share your password.</p>
 </form>;
}
