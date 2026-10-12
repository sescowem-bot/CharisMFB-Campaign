'use client';
import {useActionState} from 'react';
import Image from 'next/image';
import {uploadCharisMedia,removeCharisMedia} from '@/app/dashboard/branding/media-actions';

type Asset={id:string;file_name:string;public_url:string;bytes:number;created_at:string};
function UploadForm({org,kind}:{org:string;kind:'logo'|'favicon'|'media'}){
 const [state,action,pending]=useActionState(uploadCharisMedia,{});
 const label=kind==='logo'?'Upload bank logo':kind==='favicon'?'Upload browser favicon':'Upload media image';
 return <form action={action} className="admin-form charis-upload-form">
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="kind" value={kind}/>
  <label>{label}<input type="file" name="asset" accept="image/png,image/jpeg,image/webp" required/></label>
  <button className="btn secondary" type="submit" disabled={pending}>{pending?'Uploading…':label}</button>
  <div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</div>
 </form>;
}
function RemoveButton({org,id}:{org:string;id:string}){
 const [state,action,pending]=useActionState(removeCharisMedia,{});
 return <form action={action} onSubmit={e=>{if(!window.confirm('Remove this media file? This cannot be undone.'))e.preventDefault();}}>
  <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="asset_id" value={id}/>
  <button className="btn secondary" disabled={pending} type="submit">{pending?'Removing…':'Remove'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
 </form>;
}
export function CharisMediaLibrary({org,logo,favicon,assets,canEdit}:{org:string;logo:string;favicon:string;assets:Asset[];canEdit:boolean}){
 return <section className="panel charis-media-panel"><h2>Logo, favicon & media library</h2>
  <p className="muted">Upload Charis-approved images here. The uploaded logo appears on the site and dashboard; the favicon appears in browser tabs. Files are public branding graphics only, never customer information.</p>
  <div className="charis-asset-preview">
   <div><h3>Current logo</h3>{logo?<Image unoptimized src={logo} alt="Current Charis logo" width={100} height={100} className="charis-asset-image"/>:<span className="charis-asset-empty">C</span>}{canEdit&&<UploadForm org={org} kind="logo"/>}</div>
   <div><h3>Browser favicon</h3>{favicon?<Image unoptimized src={favicon} alt="Current browser favicon" width={64} height={64} className="charis-asset-image"/>:<span className="charis-asset-empty">C</span>}{canEdit&&<UploadForm org={org} kind="favicon"/>}</div>
  </div>
  <h3>Media library</h3>{canEdit&&<UploadForm org={org} kind="media"/>}
  {!assets.length&&<p className="muted">No images uploaded yet.</p>}
  <div className="charis-media-grid">{assets.map(a=><div className="charis-media-item" key={a.id}>
   <Image unoptimized src={a.public_url} width={160} height={115} alt={a.file_name} className="charis-media-thumb"/>
   <strong title={a.file_name}>{a.file_name}</strong><small>{(a.bytes/1024).toFixed(0)} KB</small>
   <div className="actions"><button type="button" className="btn secondary" onClick={()=>navigator.clipboard.writeText(a.public_url)}>Copy URL</button>{canEdit&&<RemoveButton org={org} id={a.id}/>}</div>
  </div>)}</div>
 </section>;
}
