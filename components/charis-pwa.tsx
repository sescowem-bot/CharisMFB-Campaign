'use client';

import {useEffect,useState} from 'react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
declare global{interface Window{__charisInstallPrompt?:InstallPrompt|null;}}
function isInstalled(){return typeof window!=='undefined'&&window.matchMedia('(display-mode: standalone)').matches;}

/** Registers a minimal offline fallback, never banking data. */
export function CharisPwaRegistration(){
 useEffect(()=>{
  if(!window.isSecureContext||!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register('/charis-sw.js',{scope:'/'}).catch(()=>{});
  const save=(event:Event)=>{
   event.preventDefault();window.__charisInstallPrompt=event as InstallPrompt;
   window.dispatchEvent(new Event('charis-install-ready'));
  };
  const clear=()=>{window.__charisInstallPrompt=null;window.dispatchEvent(new Event('charis-install-ready'));};
  window.addEventListener('beforeinstallprompt',save);
  window.addEventListener('appinstalled',clear);
  return ()=>{window.removeEventListener('beforeinstallprompt',save);window.removeEventListener('appinstalled',clear);};
 },[]);
 return null;
}
export function CharisInstallControls(){
 const [available,setAvailable]=useState(false);
 const [installed,setInstalled]=useState(false);
 const [working,setWorking]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  const update=()=>{setInstalled(isInstalled());setAvailable(Boolean(window.__charisInstallPrompt));};
  update();
  window.addEventListener('charis-install-ready',update);
  window.addEventListener('appinstalled',update);
  return ()=>{window.removeEventListener('charis-install-ready',update);window.removeEventListener('appinstalled',update);};
 },[]);
 const install=async()=>{
  const prompt=window.__charisInstallPrompt;if(!prompt)return;
  setWorking(true);setMessage('');window.__charisInstallPrompt=null;setAvailable(false);
  try{await prompt.prompt();const response=await prompt.userChoice;
   setMessage(response.outcome==='accepted'?'Installation approved. Find Charis in your Start menu.':'Installation cancelled. You can try again from your browser menu.');
  }catch{setMessage('Use your browser menu to install Charis Campaign Centre.');}
  finally{setWorking(false);}
 };
 return <div className="charis-install-section">
  {installed?<p className="charis-install-success" role="status">Charis Campaign Centre is already open as an installed app on this computer.</p>:<>
   <h2>Install Charis on this computer</h2>
   <p>Open Charis from your desktop or Start menu, like other work applications.</p>
   {available&&<button className="btn" type="button" onClick={install} disabled={working}>{working?'Opening installation…':'Install Charis Campaign Centre'}</button>}
   {message&&<p role="status">{message}</p>}
   <div className="charis-install-steps">
    <div><strong>Microsoft Edge</strong><p>Open the menu (•••), select <b>Apps</b>, then <b>Install this site as an app</b>.</p></div>
    <div><strong>Google Chrome</strong><p>Open the browser menu (⋮), then choose <b>Cast, save and share</b> and <b>Install page as app</b> (menu wording may vary).</p></div>
   </div>
   <p className="charis-install-note">Requires an internet connection and your authorised bank login. No customer or loan records are stored for offline access.</p>
  </>}
 </div>;
}
