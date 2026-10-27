'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '@/lib/supabase/browser';
export function StaffChangePassword({email}:{email:string}){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setError('');
  if(next.length<8||next!==confirm||next===current){setError('Choose a different password of at least 8 characters and confirm it.');return;}
  setBusy(true);
  try{
   const db=supabaseBrowser(),{data:{user}}=await db.auth.getUser();
   if(!user||user.email?.toLowerCase()!==email.toLowerCase())throw Error();
   const check=await db.auth.signInWithPassword({email,password:current});if(check.error||check.data.user?.id!==user.id)throw Error();
   const {error:changed}=await db.auth.updateUser({password:next});if(changed)throw changed;
   await db.auth.signOut();setDone(true);setCurrent('');setNext('');setConfirm('');
  }catch{setError('Password change unsuccessful. Verify your current password or use password recovery.');}
  finally{setBusy(false);}
 }
 return <section className="panel" style={{maxWidth:600}}><h2>Change your password</h2>
 {done?<><p role="status">Password updated. Please sign in again.</p><Link className="btn" href="/login">Sign in</Link></>:
 <form onSubmit={submit} className="admin-form">
  <label>Current password<input required type={show?'text':'password'} autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label>
  <label>New password<input required minLength={8} type={show?'text':'password'} autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)}/></label>
  <label>Confirm new password<input required minLength={8} type={show?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
  <button type="button" className="btn secondary" onClick={()=>setShow(v=>!v)}>{show?'Hide passwords':'Show passwords'}</button>
  <button className="btn" disabled={busy}>{busy?'Updating…':'Save new password'}</button>
  {error&&<p className="feedback-error" role="alert">{error}</p>}
  <p><Link className="inline-link" href="/auth/forgot-password">Forgot your current password?</Link></p>
 </form>}</section>;
}