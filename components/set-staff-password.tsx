'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {supabaseBrowser} from '@/lib/supabase/browser';
export function SetStaffPassword(){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const router=useRouter();
 useEffect(()=>{
  let active=true;
  async function initialize(){
   try{
    const client=supabaseBrowser();
    const fragment=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const access=fragment.get('access_token'),refresh=fragment.get('refresh_token');
    if(fragment.has('error_description'))throw new Error(fragment.get('error_description')||'Invitation link invalid');
    if(access&&refresh){const {error}=await client.auth.setSession({access_token:access,refresh_token:refresh});if(error)throw error;window.history.replaceState(null,'',window.location.pathname);}
    else{const code=new URLSearchParams(window.location.search).get('code');if(code){const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;window.history.replaceState(null,'',window.location.pathname);}}
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)throw new Error('Your invitation session could not be verified. Request a fresh invitation from a Charis administrator.');
    await client.rpc('team_invitation_accept');
    if(active)setReady(true);
   }catch(err){if(active)setError(err instanceof Error?err.message:'Unable to verify invitation.');}
  }
  void initialize();
  return()=>{active=false;};
 },[]);
 async function submit(event:FormEvent){
  event.preventDefault();setError('');
  if(password!==confirm){setError('Passwords do not match.');return;}
  if(password.length<12){setError('Please choose a password with at least 12 characters.');return;}
  setBusy(true);
  try{const db=supabaseBrowser();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('Your invitation session has expired. Request another invitation from a Charis administrator.');
   const {error}=await db.auth.updateUser({password});if(error)throw error;
   router.replace('/dashboard');router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Unable to update password.');}finally{setBusy(false);}
 }
 return <section><form onSubmit={submit} className="auth-form" style={{marginTop:10}}><label>New password<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <p className="faint" style={{fontSize:12.5,margin:0}}>Use at least 12 characters. A passphrase of several words works well.</p><button className="btn" type="submit" disabled={busy||!ready}>{busy?'Saving password…':ready?'Complete staff setup':'Verifying invitation…'}</button>{error&&<p role="alert" className="feedback-error">{error}</p>}</form></section>;
}
