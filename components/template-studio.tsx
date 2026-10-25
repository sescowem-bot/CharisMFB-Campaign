'use client';
import {useActionState,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {uploadCharisMedia} from '@/app/dashboard/branding/media-actions';
import {saveTemplate} from '@/app/dashboard/actions';
import {createStarterDesign,resolveBrandLinks,verifiedBrandWebsite,designSchema,type EmailDesign} from '@/lib/campaign/design';
import {charisTemplatePresets} from '@/lib/campaign/template-presets';
import {EmailDesignCanvas} from '@/components/email-design-canvas';
import dynamic from 'next/dynamic';
const GrapesEmailEditor=dynamic(()=>import('@/components/grapes-email-editor').then(mod=>mod.GrapesEmailEditor),{ssr:false,loading:()=> <p role="status" className="muted">Loading visual editor…</p>});
import {renderCampaign} from '@/lib/campaigns/render';
import './email-design-canvas.css';
import './template-studio-premium.css';
type MediaAsset={id:string;file_name:string;public_url:string};
export function TemplateStudio({org,initial,brandName='Charis Microfinance Bank',brandColor='#40239a',websiteUrl='',assets=[],mode='create',newDesign}:{org:string;brandName?:string;brandColor?:string;websiteUrl?:string;assets?:MediaAsset[];mode?:'create'|'edit';newDesign?:EmailDesign;initial?:{id:string;name:string;subject:string;description:string;category:string;design:EmailDesign}}){
 const website=verifiedBrandWebsite(websiteUrl);
 const imageLibraryRef=useRef<HTMLDetailsElement>(null);
 const router=useRouter();
 const [uploadResult,uploadAction,uploadPending]=useActionState(uploadCharisMedia,{});
 useEffect(()=>{if(uploadResult.success)router.refresh();},[uploadResult.success,router]);
 const [history,setHistory]=useState<{past:EmailDesign[];present:EmailDesign;future:EmailDesign[]}>({past:[],present:resolveBrandLinks(initial?.design||newDesign||createStarterDesign(website),website),future:[]});
 const design=history.present;
 function change(next:EmailDesign){setHistory(h=>({past:[...h.past,h.present].slice(-80),present:next,future:[]}));}
 function undo(){setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future]}:h);}
 function redo(){setHistory(h=>h.future.length?{past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)}:h);}
 const [state,action,pending]=useActionState(saveTemplate,{});
 const [savedId,setSavedId]=useState(initial?.id||'');
 useEffect(()=>{if(state.templateId)setSavedId(state.templateId);},[state.templateId]);
 useEffect(()=>{if(state.success&&state.templateId&&mode==='create')router.replace(`/dashboard/templates/${state.templateId}/edit`);},[state.success,state.templateId,mode,router]);
 const [name,setName]=useState(initial?.name||'Untitled email template');
 const [subject,setSubject]=useState(initial?.subject||'An update from Charis');
 const [category,setCategory]=useState(initial?.category||'general');
 const [description,setDescription]=useState(initial?.description||'');
 const [presetId,setPresetId]=useState('');
 const [editorMode,setEditorMode]=useState<'grapes'|'classic'>('grapes');
 // Browser-only recovery for design drafts; server remains authoritative until Save template.
 const draftKey=`charis-template-draft:${org}:${initial?.id||'new'}`;
 const [recovery,setRecovery]=useState<null|{name:string;subject:string;category:string;description:string;design:EmailDesign}>(null);
 const [draftStatus,setDraftStatus]=useState('');
 const [recoveryChecked,setRecoveryChecked]=useState(false);
 useEffect(()=>{
  try {
   const raw=localStorage.getItem(draftKey);
   if(raw){
    const value=JSON.parse(raw) as {name?:unknown;subject?:unknown;category?:unknown;description?:unknown;design?:unknown};
    const result=designSchema.safeParse(value.design);
    if(result.success&&typeof value.name==='string'&&typeof value.subject==='string'&&typeof value.category==='string'&&typeof value.description==='string')
     setRecovery({name:value.name,subject:value.subject,category:value.category,description:value.description,design:result.data});
   }
  }catch{/* Storage may be unavailable or a draft may be corrupt. */}
  setRecoveryChecked(true);
 },[draftKey]);
 useEffect(()=>{
  if(!recoveryChecked||recovery||state.success)return;
  const timer=setTimeout(()=>{
   try {
    localStorage.setItem(draftKey,JSON.stringify({name,subject,category,description,design}));
    setDraftStatus('Unsaved changes backed up on this browser.');
   }catch{setDraftStatus('Browser draft backup unavailable. Save the template to keep your changes.');}
  },1200);
  return ()=>clearTimeout(timer);
 },[draftKey,recoveryChecked,recovery,name,subject,category,description,design,state.success]);
 useEffect(()=>{
  if(!state.success)return;
  try{localStorage.removeItem(draftKey);}catch{/* Optional browser backup */}
  setDraftStatus('Saved to Template Library.');
 },[state.success,draftKey]);
 function restoreDraft(){
  if(!recovery)return;
  setName(recovery.name);setSubject(recovery.subject);setCategory(recovery.category);setDescription(recovery.description);
  change(recovery.design);setRecovery(null);setDraftStatus('Recovered your unsaved draft. Save it to the library.');
 }
 function discardDraft(){
  try{localStorage.removeItem(draftKey);}catch{/* Optional browser backup */}
  setRecovery(null);setDraftStatus('');
 }
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
 return <div className="template-studio-workspace charis-editor-shell">
  <form className="admin-form" action={action}>
   <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="template_id" value={state.templateId||savedId}/><input type="hidden" name="design" value={JSON.stringify(design)}/>
   <div className="charis-editor-heading"><div><span className="charis-eyebrow">CHARIS TEMPLATE DESIGNER</span><h2>{mode==='edit'?'Edit your template':'Create a new email template'}</h2><p>Make your design, inspect the final email, then save it to the library.</p></div>
    <div className="charis-editor-actions"><button type="button" className="btn secondary" onClick={()=>{if(imageLibraryRef.current){imageLibraryRef.current.open=true;imageLibraryRef.current.scrollIntoView({behavior:'smooth',block:'start'});}}}>Image library</button><button type="button" className="btn secondary" onClick={()=>setShowRenderedPreview(true)}>Preview email</button>
     <button type="submit" className="btn" disabled={pending}>{pending?'Saving…':mode==='edit'?'Save changes':'Save template'}</button></div>
   </div>
   {recovery&&<div className="notice" role="status"><strong>Unsaved design found on this browser.</strong> Restore it or keep the current saved template. <button type="button" className="btn secondary" onClick={restoreDraft}>Restore draft</button> <button type="button" onClick={discardDraft}>Discard backup</button></div>}
   {draftStatus&&<p className="muted" role="status">{draftStatus}</p>}
   <section className="charis-editor-details"><h3>1. Template information</h3><div className="visual-template-details"><label>Template name<input name="name" value={name} onChange={e=>setName(e.target.value)} required maxLength={120}/></label><label>Subject line<input name="subject" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={200}/></label><label>Category<select name="category" value={category} onChange={e=>setCategory(e.target.value)}><option value="general">General</option><option value="newsletter">Newsletter</option><option value="announcement">Announcement</option><option value="promotion">Promotion</option><option value="event">Event</option></select></label></div></section>
   <details className="visual-template-options"><summary>More settings · description, layout and starter design</summary><div className="visual-template-details"><label>Description<input name="description" maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Email layout<select value={design.style||'classic'} onChange={e=>change({...design,style:e.target.value as EmailDesign['style']})}>{['classic','modern','minimal','announcement'].map(s=><option key={s}>{s}</option>)}</select></label><label>Starting design<select value={presetId} onChange={e=>setPresetId(e.target.value)}><option value="">Choose a design</option>{charisTemplatePresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="button" disabled={!presetId} onClick={applyPreset}>Apply design</button></div></details>
   <p className="charis-workflow-hint"><strong>2. Design your message</strong> · Click a section on the canvas to edit it, or add a heading, picture, button, banner or shape from the left panel.</p>
   <div className="visual-history"><button type="button" disabled={!history.past.length} onClick={undo}>Undo design change</button><button type="button" disabled={!history.future.length} onClick={redo}>Redo</button><span>{design.blocks.length} / 30 sections</span></div>
   <div className="charis-mode-switch" role="group" aria-label="Choose template editor">
    <button type="button" aria-pressed={editorMode==='grapes'} onClick={()=>setEditorMode('grapes')}>Drag-and-drop editor</button>
    <button type="button" aria-pressed={editorMode==='classic'} onClick={()=>setEditorMode('classic')}>Detailed section editor</button>
   </div>
   {editorMode==='grapes'?<GrapesEmailEditor design={design} onChange={change} assets={assets} brandName={brandName} brandColor={brandColor} websiteUrl={website}/>:<EmailDesignCanvas design={design} onChange={change} assets={assets} brandName={brandName} brandColor={brandColor} websiteUrl={website}/>}
   {showRenderedPreview&&<div className="charis-preview-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowRenderedPreview(false);}}><section role="dialog" aria-modal="true" aria-label="Actual rendered email preview" className="charis-preview-modal">
    <div className="charis-preview-header"><div><h3>Final email preview</h3><p className="muted">Sample customer data · Emails are not sent from this screen.</p></div>
     <div className="charis-editor-actions"><button type="button" aria-pressed={!mobilePreview} onClick={()=>setMobilePreview(false)}>Desktop</button><button type="button" aria-pressed={mobilePreview} onClick={()=>setMobilePreview(true)}>Mobile</button><button type="button" onClick={()=>setShowRenderedPreview(false)}>Close ✕</button></div>
    </div>
    {renderedPreview.error?<p role="alert" className="feedback-error">{renderedPreview.error}</p>:<div className="charis-preview-body"><iframe key={mobilePreview?'mobile':'desktop'} title="Rendered email preview" sandbox="" srcDoc={renderedPreview.html} style={{width:mobilePreview?375:'100%',maxWidth:mobilePreview?375:720}}/></div>}
   </section></div>}
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  </form>
  <details ref={imageLibraryRef} className="visual-template-options"><summary>3. Image library · upload a new picture or banner</summary><form action={uploadAction} className="admin-form"><input type="hidden" name="organization_id" value={org}/><input type="hidden" name="kind" value="media"/><label>Upload image · PNG, JPG or WebP, up to 2 MB<input type="file" name="asset" accept="image/png,image/jpeg,image/webp" required/></label><label>Image crop<select name="crop" defaultValue="none"><option value="none">Keep aspect ratio and optimise</option><option value="square">Crop square (1000 × 1000)</option><option value="banner">Crop banner (1200 × 600)</option></select></label><p className="muted">Campaign images are automatically resized and optimised as JPEG or PNG for reliable email compatibility before storage. The image library keeps existing uploads unchanged.</p><button className="btn secondary" disabled={uploadPending}>{uploadPending?'Uploading…':'Upload image'}</button>{uploadResult.error&&<p role="alert">{uploadResult.error}</p>}{uploadResult.success&&<p role="status">{uploadResult.success}</p>}</form><Link href={`/dashboard/branding?org=${org}`}>Manage media library</Link></details>
 </div>;
}
