'use client';
import {useActionState,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {uploadCharisMedia} from '@/app/dashboard/branding/media-actions';
import {saveTemplate} from '@/app/dashboard/actions';
import {createStarterDesign,resolveBrandLinks,verifiedBrandWebsite,type EmailDesign} from '@/lib/campaign/design';
import {charisTemplatePresets} from '@/lib/campaign/template-presets';
import {EmailDesignCanvas} from '@/components/email-design-canvas';
import {renderCampaign} from '@/lib/campaigns/render';
import './email-design-canvas.css';
type MediaAsset={id:string;file_name:string;public_url:string};
export function TemplateStudio({org,initial,brandName='Charis Microfinance Bank',brandColor='#40239a',websiteUrl='',assets=[]}:{org:string;brandName?:string;brandColor?:string;websiteUrl?:string;assets?:MediaAsset[];initial?:{id:string;name:string;subject:string;description:string;category:string;design:EmailDesign}}){
 const website=verifiedBrandWebsite(websiteUrl);
 const router=useRouter();
 const [uploadResult,uploadAction,uploadPending]=useActionState(uploadCharisMedia,{});
 useEffect(()=>{if(uploadResult.success)router.refresh();},[uploadResult.success,router]);
 const [history,setHistory]=useState<{past:EmailDesign[];present:EmailDesign;future:EmailDesign[]}>({past:[],present:resolveBrandLinks(initial?.design||createStarterDesign(website),website),future:[]});
 const design=history.present;
 function change(next:EmailDesign){setHistory(h=>({past:[...h.past,h.present].slice(-80),present:next,future:[]}));}
 function undo(){setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future]}:h);}
 function redo(){setHistory(h=>h.future.length?{past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)}:h);}
 const [state,action,pending]=useActionState(saveTemplate,{});
 const [savedId,setSavedId]=useState(initial?.id||'');
 useEffect(()=>{if(state.templateId)setSavedId(state.templateId);},[state.templateId]);
 const [name,setName]=useState(initial?.name||'Customer announcement');
 const [subject,setSubject]=useState(initial?.subject||'An update from our team');
 const [category,setCategory]=useState(initial?.category||'general');
 const [description,setDescription]=useState(initial?.description||'');
 const [presetId,setPresetId]=useState('');
 const [showRenderedPreview,setShowRenderedPreview]=useState(false);
 const [mobilePreview,setMobilePreview]=useState(false);
 const renderedPreview=useMemo(()=>{
  if(!showRenderedPreview)return {html:'',error:''};
  try{
   const result=renderCampaign({design,subject,company:brandName,address:'Charis Microfinance Bank',color:brandColor,contact:{first_name:'Customer',last_name:'Example',email:'customer@example.com'},testPreview:true});
   return {html:result.html,error:''};
  }catch(error){return {html:'',error:error instanceof Error?error.message:'Unable to render this email.'};}
 },[showRenderedPreview,design,subject,brandName,brandColor]);
 function applyPreset(){const preset=charisTemplatePresets.find(p=>p.id===presetId);if(preset)change(structuredClone(preset.design));}
 return <div className="template-studio-workspace">
  <form className="admin-form" action={action}>
   <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="template_id" value={state.templateId||savedId}/><input type="hidden" name="design" value={JSON.stringify(design)}/>
   <div className="visual-studio-heading"><div><h2>Template Studio</h2><p className="muted">Create a clear, branded message for your customers.</p></div><button className="btn" disabled={pending}>{pending?'Saving…':'Save template'}</button></div>
   <div className="visual-template-details"><label>Template name<input name="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={120}/></label><label>Subject line<input name="subject" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={200}/></label><label>Category<select name="category" value={category} onChange={e=>setCategory(e.target.value)}><option value="general">General</option><option value="newsletter">Newsletter</option><option value="announcement">Announcement</option><option value="promotion">Promotion</option><option value="event">Event</option></select></label></div>
   <details className="visual-template-options"><summary>Layout and template options</summary><div className="visual-template-details"><label>Description<input name="description" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Email layout<select value={design.style||'classic'} onChange={e=>change({...design,style:e.target.value as EmailDesign['style']})}>{['classic','modern','minimal','announcement'].map(s=><option key={s}>{s}</option>)}</select></label><label>Starting design<select value={presetId} onChange={e=>setPresetId(e.target.value)}><option value="">Choose a design</option>{charisTemplatePresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="button" disabled={!presetId} onClick={applyPreset}>Apply design</button></div></details>
   <div className="visual-history"><button type="button" disabled={!history.past.length} onClick={undo}>Undo design change</button><button type="button" disabled={!history.future.length} onClick={redo}>Redo</button><span>{design.blocks.length} / 30 sections</span></div>
   <EmailDesignCanvas design={design} onChange={change} assets={assets} brandName={brandName} brandColor={brandColor} websiteUrl={website}/>
   <section aria-label="Rendered email preview" className="visual-template-options" style={{marginTop:20}}>
    <div className="visual-studio-heading"><div><h3>Actual email preview</h3><p className="muted">Inspect the email-safe HTML used for delivery, not only the editing canvas. Sample customer details are shown.</p></div><button type="button" className="btn secondary" aria-expanded={showRenderedPreview} onClick={()=>setShowRenderedPreview(value=>!value)}>{showRenderedPreview?'Close preview':'Preview email'}</button></div>
    {showRenderedPreview&&<div>
     <div role="group" aria-label="Rendered preview width" className="visual-history"><button type="button" aria-pressed={!mobilePreview} onClick={()=>setMobilePreview(false)}>Desktop</button><button type="button" aria-pressed={mobilePreview} onClick={()=>setMobilePreview(true)}>Mobile</button></div>
     {renderedPreview.error?<p role="alert" className="feedback-error">{renderedPreview.error}</p>:<div style={{display:'flex',justifyContent:'center',overflowX:'auto',padding:'16px 0',background:'#e9edf3'}}><iframe key={mobilePreview?'mobile':'desktop'} title="Rendered email preview" sandbox="" srcDoc={renderedPreview.html} style={{width:mobilePreview?375:'100%',maxWidth:mobilePreview?375:720,minHeight:580,border:'1px solid #cbd5e1',borderRadius:8,background:'#fff'}}/></div>}
    </div>}
   </section>
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  </form>
  <details className="visual-template-options"><summary>Image library</summary><form action={uploadAction} className="admin-form"><input type="hidden" name="organization_id" value={org}/><input type="hidden" name="kind" value="media"/><label>Upload image · PNG, JPG or WebP, up to 2 MB<input type="file" name="asset" accept="image/png,image/jpeg,image/webp" required/></label><button className="btn secondary" disabled={uploadPending}>{uploadPending?'Uploading…':'Upload image'}</button>{uploadResult.error&&<p role="alert">{uploadResult.error}</p>}{uploadResult.success&&<p role="status">{uploadResult.success}</p>}</form><Link href={`/dashboard/branding?org=${org}`}>Manage media library</Link></details>
 </div>;
}
