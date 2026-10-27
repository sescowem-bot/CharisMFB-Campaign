'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '@/lib/supabase/browser';
export default function ResetPassword(){
 const [ready,setReady]=useState(false),[saving,setSaving]=useState(false),[done,setDone]=useState(false),[show,setShow]=useState(false);
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  async function verify(){
   try{
    const db=supabaseBrowser(),query=new URLSearchParams(window.location.search),fragment=new URLSearchParams(window.location.hash.replace(/^#/,''));
    if(query.has('error')||fragment.has('error'))throw Error();
    if(fragment.has('access_token')&&fragment.has('refresh_token')){
     const {error}=await db.auth.setSession({access_token:fragment.get('access_token')!,refresh_token:fragment.get('refresh_token')!});if(error)throw error;
    }else if(query.has('code')){
     const {error}=await db.auth.exchangeCodeForSession(query.get('code')!);if(error)throw error;
    }else throw Error();
    const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error();
    window.history.replaceState(null,'',window.location.pathname);
    if(live)setReady(true);
   }catch{if(live)setError('This reset link is invalid or expired. Please request another link.');}
  }
  void verify();return()=>{live=false};
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!ready||saving)return;
  if(password.length<8){setError('Use at least 8 characters.');return;}
  if(password!==confirm){setError('Passwords do not match.');return;}
  setSaving(true);setError('');
  try{
   const db=supabaseBrowser();const {error}=await db.auth.updateUser({password});if(error)throw error;
   await db.auth.signOut();setDone(true);setReady(false);
  }catch{setError('Password update unsuccessful. Check bank password requirements or request a fresh link.');}
  finally{setSaving(false);}
 }
 return <main className="shell section" style={{maxWidth:560,margin:'8vh auto'}}><section className="panel">
  <h1>Charis Campaign Centre</h1><h2>{done?'Password changed':'Choose a new password'}</h2>
  {done?<><p role="status">Your password was updated. Sign in with your new password.</p><Link href="/login" className="btn">Sign in</Link></>:
  <form onSubmit={submit} className="admin-form">
   <label>New password<input type={show?'text':'password'} required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Confirm password<input type={show?'text':'password'} required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   <button type="button" className="btn secondary" onClick={()=>setShow(v=>!v)}>{show?'Hide passwords':'Show passwords'}</button>
   <button className="btn" disabled={!ready||saving}>{saving?'Updating…':ready?'Change password':'Verifying link…'}</button>
   {error&&<p className="feedback-error" role="alert">{error}</p>}
  </form>}
  <p><Link href="/auth/forgot-password" className="inline-link">Request another link</Link></p>
 </section></main>;
}