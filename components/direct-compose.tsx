'use client';
import {useActionState,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {createDirectMessage} from '@/app/dashboard/communications/actions';
import {designSchema,resolveBrandLinks,type EmailBlock,type EmailDesign} from '@/lib/campaign/design';
import {renderCampaign} from '@/lib/campaigns/render';
import {campaignParagraphs,checkDirectDesign} from '@/lib/direct/campaign-design';

type Contact={id:string;first_name:string|null;last_name:string|null;email:string|null;phone:string|null};
type Group={id:string;name:string};
type Template={id:string;name:string;subject:string;design:EmailDesign};
export function DirectCompose({token,contacts,groups,canBulk,emailEnabled,smsEnabled,maxRecipients,templates,templateStudioUrl,brand,schedulingEnabled}:{
 token:string;contacts:Contact[];groups:Group[];canBulk:boolean;emailEnabled:boolean;smsEnabled:boolean;maxRecipients:number;
 templates:Template[];templateStudioUrl:string;brand:{name:string;color:string;address:string;website:string};schedulingEnabled:boolean;
}){
 const [state,submit,pending]=useActionState(createDirectMessage,{});
 const [step,setStep]=useState(0);
 const [channel,setChannel]=useState<'email'|'sms'>(emailEnabled?'email':'sms');
 const [purpose,setPurpose]=useState('general_notice');
 const [product,setProduct]=useState('general');
 const [audience,setAudience]=useState<'selected'|'list'|'all'>('selected');
 const [groupId,setGroupId]=useState('');
 const [chosen,setChosen]=useState<string[]>([]);
 const [query,setQuery]=useState('');const [body,setBody]=useState('');const [subject,setSubject]=useState('');
 const [design,setDesign]=useState<EmailDesign|null>(null);
 const [templateId,setTemplateId]=useState('');
 const [mode,setMode]=useState<'now'|'later'>('now');
 const [sendAt,setSendAt]=useState('');
 const [results,setResults]=useState<Contact[]>([]);
 const [selectedDetails,setSelectedDetails]=useState<Record<string,Contact>>({});
 const [searching,setSearching]=useState(false);const [searchError,setSearchError]=useState('');
 const search=query.trim();
 useEffect(()=>{
  if(search.length<2)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setSearching(true);setSearchError('');
   try{
    const response=await fetch('/api/direct/contacts?q='+encodeURIComponent(search),{cache:'no-store',signal:controller.signal});
    const payload=await response.json();
    if(!response.ok||!Array.isArray(payload.contacts))throw Error('Search unavailable');
    if(!controller.signal.aborted)setResults(payload.contacts as Contact[]);
   }catch(error){if(!controller.signal.aborted){setResults([]);setSearchError(error instanceof Error?error.message:'Search unavailable');}}
   finally{if(!controller.signal.aborted)setSearching(false);}
  },350);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[search]);
 const filtered=(search.length<2?contacts:results).filter(c=>search.length<2||`${c.first_name||''} ${c.last_name||''} ${c.email||''} ${c.phone||''}`.toLowerCase().includes(search.toLowerCase())).slice(0,40);
 const richBody=design?campaignParagraphs(design):body;
 const composedBody=channel==='email'&&design?richBody:body.trim();
 const preview=useMemo(()=>{
  if(!design||channel!=='email')return {html:'',error:''};
  try{
   checkDirectDesign(design,brand.website,subject);
   const rendered=renderCampaign({design,subject:subject||'Message preview',company:brand.name,address:brand.address,color:brand.color,contact:{first_name:'Customer',last_name:'Example'},testPreview:true});
   return {html:rendered.html,error:''};
  }catch(e){return {html:'',error:e instanceof Error?e.message:'Design is incomplete.'};}
 },[design,brand,subject,channel]);
 const messageReady=subject.trim().length>=3&&subject.trim().length<=180&&composedBody.trim().length>=10&&composedBody.trim().length<=2000&&!preview.error;
 const recipientsReady=audience==='selected'?chosen.length>0:audience==='list'?Boolean(groupId):canBulk;
 const scheduleReady=mode==='now'||(schedulingEnabled&&sendAt.trim().length>0);
 function selectTemplate(id:string){
  setTemplateId(id);
  if(!id){setBody(richBody||body);setDesign(null);return;}
  const t=templates.find(t=>t.id===id);
  if(!t)return;
  const safe=designSchema.safeParse(t.design);
  if(!safe.success)return;
  const copy=resolveBrandLinks(safe.data,brand.website);
  setSubject(t.subject);setDesign(copy);setBody(campaignParagraphs(copy));
 }
 function updateBlock(index:number,update:Partial<EmailBlock>){
  setDesign(d=>d?{...d,blocks:d.blocks.map((b,i)=>i===index?{...b,...update} as EmailBlock:b)}:d);
 }
 function moveBlock(index:number,offset:number){
  setDesign(d=>{if(!d)return d;const items=[...d.blocks],target=index+offset;
   if(target<0||target>=items.length)return d;
   [items[index],items[target]]=[items[target],items[index]];
   return {...d,blocks:items};});
 }
 function addBlock(type:'heading'|'paragraph'|'divider'|'button'){
  setDesign(d=>{if(!d||d.blocks.length>=30)return d;
   const newBlock:EmailBlock=type==='heading'?{type:'heading',text:'New heading'}:
    type==='paragraph'?{type:'paragraph',text:'Write your message here.'}:
    type==='divider'?{type:'divider',text:''}:
    {type:'button',text:'Visit Charis',url:brand.website};
   return {...d,blocks:[...d.blocks,newBlock]};});
 }
 return <form action={submit} className="admin-form direct-composer direct-wizard" style={{maxWidth:'none'}} onSubmit={e=>{
  if(step!==2||!messageReady||!recipientsReady||!scheduleReady){e.preventDefault();setStep(s=>Math.min(2,s+1));}
 }}>
  <input type="hidden" name="token" value={token}/>
  <input type="hidden" name="subject" value={subject}/>
  <input type="hidden" name="body" value={composedBody}/>
  <input type="hidden" name="purpose" value={purpose}/>
  <input type="hidden" name="product" value={product}/>
  <input type="hidden" name="channel" value={channel}/>
  <input type="hidden" name="audience" value={audience}/>
  <input type="hidden" name="contact_ids" value={chosen.join(',')}/>
  <input type="hidden" name="list_id" value={audience==='list'?groupId:''}/>
  <input type="hidden" name="design" value={channel==='email'&&design?JSON.stringify(design):''}/>
  <input type="hidden" name="mode" value={mode}/>
  <input type="hidden" name="send_at" value={mode==='later'?sendAt:''}/>
  <nav aria-label="Campaign steps" className="direct-simple-steps">{['Message','Recipients','Review & send'].map((label,index)=><span key={label} className={step===index?'current':''} aria-current={step===index?'step':undefined}>{index+1}. {label}</span>)}</nav>
  <section style={{display:step===0?'block':'none'}} aria-label="Create message">
   <div className="form-two"><label>Channel<select value={channel} onChange={e=>{if(e.target.value==='sms'&&design){setBody(richBody);setDesign(null);setTemplateId('');}setChannel(e.target.value as 'email'|'sms');setChosen([]);setSelectedDetails({});setAudience('selected');}}>
    {emailEnabled&&<option value="email">Email</option>}{smsEnabled&&<option value="sms">SMS</option>}</select></label>
   <label>Message type<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="general_notice">General bank notice</option><option value="service_notice">Service update</option><option value="account_update">Account notification</option></select></label></div>
   <label>Related product<select value={product} onChange={e=>setProduct(e.target.value)}><option value="general">General</option><option value="savings">Savings</option><option value="current">Current account</option><option value="fixed_deposit">Fixed deposit</option><option value="loans">Loans</option><option value="mobile_app">Mobile banking</option><option value="other">Other</option></select></label>
   {channel==='email'&&<div className="direct-layout-control"><label>Email layout<select aria-label="Email layout" value={templateId} onChange={e=>selectTemplate(e.target.value)}><option value="">Simple message</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <Link href={templateStudioUrl} className="inline-link">Open Template Studio</Link></div>}
   <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={180} placeholder="Account service update"/></label>
   {!design||channel==='sms'?<label>Message<textarea rows={6} maxLength={channel==='sms'?480:2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a clear message. Never request a PIN, password or OTP."/><small className="muted">{body.length}/{channel==='sms'?480:2000}</small></label>:
    <div className="direct-editor"><h3>Email sections</h3>{design.blocks.map((block,index)=><div key={index} className="direct-block-editor"><div className="direct-block-top"><strong>{block.type==='shape'?'Accent':block.type}</strong><span><button type="button" onClick={()=>moveBlock(index,-1)} disabled={index===0} aria-label="Move section up">↑</button><button type="button" onClick={()=>moveBlock(index,1)} disabled={index===design.blocks.length-1} aria-label="Move section down">↓</button><button type="button" disabled={design.blocks.length===1} onClick={()=>setDesign(d=>d?{...d,blocks:d.blocks.filter((_,i)=>i!==index)}:d)} aria-label="Remove section">×</button></span></div>
     {['heading','paragraph','shape'].includes(block.type)&&<textarea aria-label={`Section ${index+1} text`} rows={block.type==='paragraph'?4:2} value={block.text} onChange={e=>updateBlock(index,{text:e.target.value})} maxLength={block.type==='paragraph'?2000:200}/>}
     {block.type==='button'&&<><label>Button label<input value={block.text} maxLength={200} onChange={e=>updateBlock(index,{text:e.target.value})}/></label><label>Button destination<input type="url" value={block.url} onChange={e=>updateBlock(index,{url:e.target.value} as Partial<EmailBlock>)}/></label></>}
     {block.type==='image'&&<small className="muted">Bank-approved image · {block.text}</small>}
    </div>)}
     <div className="actions"><button type="button" className="btn secondary" onClick={()=>addBlock('paragraph')}>+ Paragraph</button><button type="button" className="btn secondary" onClick={()=>addBlock('heading')}>+ Heading</button>{Boolean(brand.website)&&<button type="button" className="btn secondary" onClick={()=>addBlock('button')}>+ Button</button>}<button type="button" className="btn secondary" onClick={()=>addBlock('divider')}>+ Divider</button></div>
     {preview.error?<p role="alert" className="feedback-error">{preview.error}</p>:<details><summary>Preview email</summary><iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{border:'1px solid #e2e8f0',borderRadius:8,width:'100%',height:470}}/></details>}
    </div>}
  </section>
  <section style={{display:step===1?'block':'none'}} aria-label="Choose recipients">
   <div className="direct-audience-head"><h3>Recipients</h3><small className="muted">Maximum {maxRecipients} per campaign</small></div>
   <label>Send to<select value={audience} onChange={e=>{setAudience(e.target.value as 'selected'|'list'|'all');setChosen([]);setSelectedDetails({});}}>
    <option value="selected">Selected contacts</option>{canBulk&&<option value="list">Contact group</option>}{canBulk&&<option value="all">All accessible contacts (within limit)</option>}</select></label>
   {audience==='selected'&&<div className="direct-contact-panel"><input aria-label="Find customers" placeholder="Search by name, email or phone" value={query} onChange={e=>setQuery(e.target.value)} className="direct-search"/>
    <p className="muted" role="status" aria-live="polite">{searching?'Searching…':searchError?'Search unavailable':search.length<2?'Recent contacts · Type 2 characters to search all':`${filtered.length} matching contact${filtered.length===1?'':'s'}`}</p>
    {searchError&&<p role="alert" className="feedback-error">{searchError}</p>}
    <div className="direct-contact-list">{filtered.filter(c=>channel==='email'?!!c.email:!!c.phone).map(c=><label className="direct-contact-row" key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} disabled={!chosen.includes(c.id)&&chosen.length>=maxRecipients} onChange={e=>{if(e.target.checked){setChosen(old=>old.length>=maxRecipients?old:[...old,c.id]);setSelectedDetails(old=>({...old,[c.id]:c}));}else{setChosen(old=>old.filter(id=>id!==c.id));setSelectedDetails(old=>{const updated={...old};delete updated[c.id];return updated;});}}}/><span><strong>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer'}</strong><small>{channel==='email'?c.email:c.phone}</small></span></label>)}</div>
    {chosen.length>0&&<div className="direct-selection-summary" aria-live="polite"><strong>{chosen.length} selected</strong>{chosen.map(id=><button key={id} type="button" className="direct-selection-chip" onClick={()=>{setChosen(old=>old.filter(x=>x!==id));setSelectedDetails(old=>{const updated={...old};delete updated[id];return updated;});}} aria-label={`Remove ${selectedDetails[id]?.first_name||'contact'}`}><span>{[selectedDetails[id]?.first_name,selectedDetails[id]?.last_name].filter(Boolean).join(' ')||selectedDetails[id]?.email||'Contact'}</span><span aria-hidden="true"> ×</span></button>)}</div>}
   </div>}
   {audience==='list'&&<label>Contact group<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Choose group</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
   {audience==='all'&&<p className="muted">The system checks recipient eligibility and your access. If the audience exceeds {maxRecipients}, choose a smaller group.</p>}
  </section>
  <section style={{display:step===2?'block':'none'}} aria-label="Review campaign">
   <h3>Review campaign</h3>
   <div className="direct-review"><p><strong>Channel:</strong> {channel.toUpperCase()}</p><p><strong>Subject:</strong> {subject}</p><p><strong>Recipients:</strong> {audience==='selected'?`${chosen.length} contacts`:audience==='list'?groups.find(g=>g.id===groupId)?.name||'Group':'Eligible contacts (within limit)'}</p><p><strong>Layout:</strong> {templateId?templates.find(t=>t.id===templateId)?.name:'Simple message'}</p><p className="direct-review-copy">{composedBody}</p></div>
   <label>Send when<select value={mode} onChange={e=>setMode(e.target.value as 'now'|'later')}><option value="now">Send now</option>{schedulingEnabled&&<option value="later">Schedule for later</option>}</select></label>
   {mode==='later'&&<label>Send on (Nigeria time · WAT)<input type="datetime-local" value={sendAt} onChange={e=>setSendAt(e.target.value)}/></label>}
   <small className="muted">{mode==='later'?'Messages will be processed after the selected time by the delivery worker.':'Provider acceptance and final delivery are tracked separately.'}</small>
  </section>
  <div className="direct-wizard-actions">
   {step>0&&<button type="button" className="btn secondary" disabled={pending} onClick={()=>setStep(s=>s-1)}>Back</button>}
   {step<2?<button type="button" className="btn" disabled={step===0?!messageReady:!recipientsReady} onClick={()=>setStep(s=>Math.min(2,s+1))}>Continue</button>:
    <button type="submit" className="btn" disabled={pending||!!state.id||!messageReady||!recipientsReady||!scheduleReady}>{pending?'Saving…':mode==='later'?'Schedule campaign':'Send campaign'}</button>}
  </div>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<div role="status" className="notice"><strong>{state.success}</strong> {state.id&&<Link className="inline-link" href={`/dashboard/communications/history?id=${state.id}`}>View status →</Link>}</div>}
 </form>;
}
