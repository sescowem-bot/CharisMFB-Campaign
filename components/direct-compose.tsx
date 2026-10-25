'use client';
import {useActionState,useEffect,useMemo,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {Check,ShieldCheck,MessageSquareText,UsersRound,Eye,ArrowRight,ArrowLeft,Info,ClipboardCheck} from 'lucide-react';
import './direct-campaign-wizard.css';
import {createDirectMessage} from '@/app/dashboard/communications/actions';
import {designSchema,resolveBrandLinks,type EmailBlock,type EmailDesign} from '@/lib/campaign/design';
import {renderDirectEmailPreview} from '@/lib/direct/preview';
import {DirectEmailPreview} from '@/components/direct-email-preview';
import {campaignParagraphs,checkDirectDesign} from '@/lib/direct/campaign-design';
import {customerFieldOptions} from '@/lib/campaign/customer-fields';
const GrapesEmailEditor=dynamic(()=>import('@/components/grapes-email-editor').then(m=>m.GrapesEmailEditor),{ssr:false,loading:()=> <p className="muted" role="status">Opening visual email editor…</p>});

type Contact={id:string;first_name:string|null;last_name:string|null;email:string|null;phone:string|null;attributes?:Record<string,string>|null};
type Group={id:string;name:string};
type Template={id:string;name:string;subject:string;design:EmailDesign;source:'bank'|'starter'};
type MediaAsset={id:string;file_name:string;public_url:string};
export function DirectCompose({token,contacts,groups,canBulk,emailEnabled,smsEnabled,maxRecipients,templates,assets,templateStudioUrl,brand,schedulingEnabled,approvalRequired=false,customFields=[]}:{
 token:string;contacts:Contact[];groups:Group[];canBulk:boolean;emailEnabled:boolean;smsEnabled:boolean;maxRecipients:number;
 templates:Template[];assets:MediaAsset[];templateStudioUrl:string;brand:{name:string;color:string;address:string;website:string};schedulingEnabled:boolean;approvalRequired?:boolean;customFields?:string[];
}){
 const [state,submit,pending]=useActionState(createDirectMessage,{});
 const [step,setStep]=useState(0);
 const stepNavRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(step>0)stepNavRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[step]);
 const [confirmed,setConfirmed]=useState(false);
 const [channel,setChannel]=useState<'email'|'sms'>(emailEnabled?'email':'sms');
 const [purpose,setPurpose]=useState('general_notice');
 const [product,setProduct]=useState('general');
 const [audience,setAudience]=useState<'selected'|'list'|'all'>('selected');
 const [groupId,setGroupId]=useState('');
 const [chosen,setChosen]=useState<string[]>([]);
 const [query,setQuery]=useState('');const [body,setBody]=useState('');const [subject,setSubject]=useState('');
 const [design,setDesign]=useState<EmailDesign|null>(null);
 const [templateId,setTemplateId]=useState('');
 const [editorMode,setEditorMode]=useState<'visual'|'sections'>('visual');
 const [variable,setVariable]=useState('first_name');
 const fieldChoices=customerFieldOptions(customFields);
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
 // Keep typing responsive: render HTML for review/confirmation, not during editing.
 const designError=useMemo(()=>{
  if(!design||channel!=='email')return '';
  try{checkDirectDesign(design,brand.website,subject);return '';}
  catch(e){return e instanceof Error?e.message:'Check the email design.';}
 },[design,brand.website,subject,channel]);
 const sampleContact=audience==='selected'?chosen.map(id=>selectedDetails[id]).find(Boolean):undefined;
 const preview=useMemo(()=>{
  if(step<2||channel!=='email')return {html:'',subject,error:'',sampleName:'Sample customer'};
  if(designError)return {html:'',subject,error:designError,sampleName:'Sample customer'};
  return renderDirectEmailPreview({design,subject,body,brand,contact:sampleContact,customFields});
 },[step,channel,design,subject,body,brand,designError,sampleContact,customFields]);
 const messageReady=subject.trim().length>=3&&subject.trim().length<=180&&composedBody.trim().length>=10&&composedBody.trim().length<=2000&&!designError;
 const recipientsReady=audience==='selected'?chosen.length>0:audience==='list'?Boolean(groupId):canBulk;
 const scheduleReady=mode==='now'||(schedulingEnabled&&sendAt.trim().length>0);
 const audienceLabel=audience==='selected'?chosen.length+' selected contact'+(chosen.length===1?'':'s'):
  audience==='list'?groups.find(g=>g.id===groupId)?.name||'No group chosen':'All eligible contacts (within your limit)';
 const typeLabel=purpose==='general_notice'?'General bank notice':purpose==='service_notice'?'Service update':'Account notification';
 const productLabel=({general:'General banking',savings:'Savings',current:'Current account',fixed_deposit:'Fixed deposit',loans:'Loans',mobile_app:'Mobile banking',other:'Other'} as Record<string,string>)[product]||'General banking';
 const steps=[{label:'Message',sub:'Content & design',icon:MessageSquareText},
              {label:'Recipients',sub:'Who receives it',icon:UsersRound},
              {label:'Preview',sub:'Check the email',icon:Eye},
              {label:'Confirm & send',sub:'Final approval',icon:ClipboardCheck}];

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
 function insertDetail(target:'subject'|'message'){
  if(!design||channel!=='email')return;
  const token='{{'+variable+'}}';
  if(target==='subject'){setSubject(old=>(old+' '+token).trim().slice(0,180));return;}
  const index=design.blocks.findIndex(b=>b.type==='paragraph');
  if(index<0){
   if(design.blocks.length>=30)return;
   setDesign(d=>d?{...d,blocks:[...d.blocks,{type:'paragraph',text:token}]}:d);
  }else setDesign(d=>d?{...d,blocks:d.blocks.map((b,i)=>i===index&&b.type==='paragraph'
   ?{...b,text:(b.text+' '+token).trim().slice(0,2000)}:b)}:d);
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
 return <form action={submit} className="admin-form direct-composer direct-wizard charis-campaign-flow" style={{maxWidth:'none'}}
  onKeyDown={e=>{if(e.key==='Enter'&&['INPUT','SELECT'].includes((e.target as HTMLElement).tagName))e.preventDefault();}}
  onSubmit={e=>{
   const submitter=(e.nativeEvent as SubmitEvent).submitter;
   if(step!==3||!confirmed||!messageReady||!recipientsReady||!scheduleReady||pending||!!state.id||
      submitter?.getAttribute('name')!=='commit_send'||submitter?.getAttribute('value')!=='yes'){
    e.preventDefault();
   }
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
  <div className="charis-flow-intro"><div><div className="charis-flow-eyebrow"><MessageSquareText size={15}/> CHARIS CAMPAIGN CENTRE</div>
   <h2>Create a customer message</h2><p>Four simple steps: write your message, choose recipients, check the preview and confirm delivery.</p></div>
   <span className="charis-flow-safe"><ShieldCheck size={15}/> Nothing is sent until you confirm</span>
  </div>
  <nav ref={stepNavRef} aria-label="Campaign steps" className="direct-simple-steps charis-flow-steps">{steps.map((item,index)=>
   <span key={item.label} className={step===index?'current':step>index?'complete':''} aria-current={step===index?'step':undefined}>
    <span className="charis-flow-step-number">{step>index?<Check size={15}/>:index+1}</span>
    <span><span className="charis-flow-step-name">{item.label}</span><small className="charis-flow-step-sub">{item.sub}</small></span>
   </span>)}</nav>
  <section style={{display:step===0?'block':'none'}} aria-label="Create message" className="charis-flow-panel"><div className="charis-flow-panel-heading"><span className="charis-flow-panel-icon"><MessageSquareText size={21}/></span><div><h3>Write your message</h3><p>Choose a message type and template, then edit the content in plain language.</p></div></div>
   <div className="form-two"><label>Channel<select value={channel} onChange={e=>{if(e.target.value==='sms'&&design){setBody(richBody);setDesign(null);setTemplateId('');}setChannel(e.target.value as 'email'|'sms');setChosen([]);setSelectedDetails({});setAudience('selected');}}>
    {emailEnabled&&<option value="email">Email</option>}{smsEnabled&&<option value="sms">SMS</option>}</select></label>
   <label>Message type<select value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="general_notice">General bank notice</option><option value="service_notice">Service update</option><option value="account_update">Account notification</option></select></label></div>
   <label>Related product<select value={product} onChange={e=>setProduct(e.target.value)}><option value="general">General</option><option value="savings">Savings</option><option value="current">Current account</option><option value="fixed_deposit">Fixed deposit</option><option value="loans">Loans</option><option value="mobile_app">Mobile banking</option><option value="other">Other</option></select></label>
   {channel==='email'&&<div className="direct-layout-control"><label>Start with an email template<select aria-label="Email layout" value={templateId} onChange={e=>selectTemplate(e.target.value)}>
     <option value="">Simple message</option>
     <optgroup label="Saved Charis templates">{templates.filter(t=>t.source==='bank').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
     <optgroup label="Ready-to-edit starter designs">{templates.filter(t=>t.source==='starter').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
    </select></label>
    <Link href={templateStudioUrl} className="inline-link">Open Template Studio</Link></div>}
   <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={180} placeholder="Account service update"/></label>
   {channel==='email'&&design&&<div className="direct-editor" aria-label="Customer detail tools">
    <strong>Personalise this email</strong>
    <p className="muted">Choose customer information from your uploaded contacts. No codes needed. Information is added separately for each recipient during sending.</p>
    <div className="actions">
     <label>Customer detail<select aria-label="Customer detail" value={variable} onChange={e=>setVariable(e.target.value)}>
      {fieldChoices.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
     </select></label>
     <button type="button" className="btn secondary" onClick={()=>insertDetail('subject')}>Insert in subject</button>
     <button type="button" className="btn secondary" onClick={()=>insertDetail('message')}>Insert in message</button>
    </div>
   </div>}
   {!design||channel==='sms'?<label>Message<textarea rows={6} maxLength={channel==='sms'?480:2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a clear message. Never request a PIN, password or OTP."/><small className="muted">{body.length}/{channel==='sms'?480:2000}</small></label>:
    <div className="direct-editor">
     <div className="actions" role="group" aria-label="Email editing mode">
      <button type="button" className="btn secondary" aria-pressed={editorMode==='visual'} onClick={()=>setEditorMode('visual')}>Visual drag-and-drop editor</button>
      <button type="button" className="btn secondary" aria-pressed={editorMode==='sections'} onClick={()=>setEditorMode('sections')}>Detailed sections</button>
     </div>
     {editorMode==='visual'?<GrapesEmailEditor design={design} onChange={setDesign} assets={assets} brandName={brand.name} brandColor={brand.color} websiteUrl={brand.website} availableFields={customFields}/>:
     <><h3>Email sections</h3>{design.blocks.map((block,index)=><div key={index} className="direct-block-editor"><div className="direct-block-top"><strong>{block.type==='shape'?'Accent':block.type}</strong><span><button type="button" onClick={()=>moveBlock(index,-1)} disabled={index===0} aria-label="Move section up">↑</button><button type="button" onClick={()=>moveBlock(index,1)} disabled={index===design.blocks.length-1} aria-label="Move section down">↓</button><button type="button" disabled={design.blocks.length===1} onClick={()=>setDesign(d=>d?{...d,blocks:d.blocks.filter((_,i)=>i!==index)}:d)} aria-label="Remove section">×</button></span></div>
     {['heading','paragraph','shape'].includes(block.type)&&<textarea aria-label={`Section ${index+1} text`} rows={block.type==='paragraph'?4:2} value={block.text} onChange={e=>updateBlock(index,{text:e.target.value})} maxLength={block.type==='paragraph'?2000:200}/>}
     {block.type==='button'&&<><label>Button label<input value={block.text} maxLength={200} onChange={e=>updateBlock(index,{text:e.target.value})}/></label><label>Button destination<input type="url" value={block.url} onChange={e=>updateBlock(index,{url:e.target.value} as Partial<EmailBlock>)}/></label></>}
     {block.type==='image'&&<small className="muted">Bank-approved image · {block.text}</small>}
    </div>)}
     <div className="actions"><button type="button" className="btn secondary" onClick={()=>addBlock('paragraph')}>+ Paragraph</button><button type="button" className="btn secondary" onClick={()=>addBlock('heading')}>+ Heading</button>{Boolean(brand.website)&&<button type="button" className="btn secondary" onClick={()=>addBlock('button')}>+ Button</button>}<button type="button" className="btn secondary" onClick={()=>addBlock('divider')}>+ Divider</button></div>
     </>}
     {designError&&<p role="alert" className="feedback-error">{designError}</p>}<p className="muted">Full email preview is available in step 3. No email is sent while editing.</p>
    </div>}
  </section>
  <section style={{display:step===1?'block':'none'}} aria-label="Choose recipients" className="charis-flow-panel"><div className="charis-flow-panel-heading"><span className="charis-flow-panel-icon"><UsersRound size={21}/></span><div><h3>Choose your recipients</h3><p>Find the customers who should receive this message. Only eligible recipients are included.</p></div></div>
   <div className="direct-audience-head"><h3>Recipients</h3><small className="muted">Maximum {maxRecipients} per campaign</small></div>
   <label>Send to<select value={audience} onChange={e=>{setAudience(e.target.value as 'selected'|'list'|'all');setChosen([]);setSelectedDetails({});}}>
    <option value="selected">Selected contacts</option>{canBulk&&<option value="list">Contact group</option>}{canBulk&&<option value="all">All accessible contacts (within limit)</option>}</select></label>
   {audience==='selected'&&<div className="direct-contact-panel"><input aria-label="Find customers" placeholder="Search by name, email or phone" value={query} onChange={e=>setQuery(e.target.value)} className="direct-search"/>
    <p className="muted" role="status" aria-live="polite">{searching?'Searching…':searchError?'Search unavailable':search.length<2?'Recent contacts · Type 2 characters to search all':`${filtered.length} matching contact${filtered.length===1?'':'s'}`}</p>
    {searchError&&<p role="alert" className="feedback-error">{searchError}</p>}
    {!searching&&!searchError&&filtered.filter(c=>channel==='email'?!!c.email:!!c.phone).length===0&&
     <p className="charis-flow-guidance" role="status"><Info size={16}/><span>{search.length>=2?'No matching customers with a valid contact address. Try another name, email or phone number.':'No recent customers available. Enter at least two characters to search the contact directory.'}</span></p>}
    <div className="direct-contact-list">{filtered.filter(c=>channel==='email'?!!c.email:!!c.phone).map(c=><label className="direct-contact-row" key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} disabled={!chosen.includes(c.id)&&chosen.length>=maxRecipients} onChange={e=>{if(e.target.checked){setChosen(old=>old.length>=maxRecipients?old:[...old,c.id]);setSelectedDetails(old=>({...old,[c.id]:c}));}else{setChosen(old=>old.filter(id=>id!==c.id));setSelectedDetails(old=>{const updated={...old};delete updated[c.id];return updated;});}}}/><span><strong>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Customer'}</strong><small>{channel==='email'?c.email:c.phone}</small></span></label>)}</div>
    {chosen.length>0&&<div className="direct-selection-summary" aria-live="polite"><strong>{chosen.length} selected</strong>{chosen.map(id=><button key={id} type="button" className="direct-selection-chip" onClick={()=>{setChosen(old=>old.filter(x=>x!==id));setSelectedDetails(old=>{const updated={...old};delete updated[id];return updated;});}} aria-label={`Remove ${selectedDetails[id]?.first_name||'contact'}`}><span>{[selectedDetails[id]?.first_name,selectedDetails[id]?.last_name].filter(Boolean).join(' ')||selectedDetails[id]?.email||'Contact'}</span><span aria-hidden="true"> ×</span></button>)}</div>}
   </div>}
   {audience==='list'&&<label>Contact group<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Choose group</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
   {audience==='all'&&<p className="muted">The system checks recipient eligibility and your access. If the audience exceeds {maxRecipients}, choose a smaller group.</p>}
  </section>
  <section style={{display:step===2?'block':'none'}} aria-label="Preview campaign" className="charis-flow-panel"><div className="charis-flow-panel-heading"><span className="charis-flow-panel-icon"><Eye size={21}/></span><div><h3>Review your message</h3><p>Read the email carefully and inspect how it appears on a computer or phone.</p></div></div>
   <h3>Preview campaign</h3>
   <p className="muted">Review the message and recipients. Nothing will be sent on this step.</p>
   <dl className="charis-flow-summary" aria-label="Campaign review summary">
    <div><dt>Channel</dt><dd>{channel==='email'?'Email':'SMS'}</dd></div>
    <div><dt>Message type</dt><dd>{typeLabel}</dd></div>
    <div><dt>Subject</dt><dd>{subject}</dd></div>
    <div><dt>Audience</dt><dd>{audienceLabel}</dd></div>
   </dl>
   {audience==='selected'&&<details className="charis-flow-guidance"><summary>View selected recipients ({chosen.length})</summary><ul aria-label="Selected recipients">{chosen.slice(0,12).map(id=><li key={id}>{[selectedDetails[id]?.first_name,selectedDetails[id]?.last_name].filter(Boolean).join(' ')||selectedDetails[id]?.email||'Selected customer'}</li>)}{chosen.length>12&&<li>And {chosen.length-12} more</li>}</ul></details>}
   {channel==='email'?(step===2&&<DirectEmailPreview key="review" preview={preview}/>):
    <div className="direct-review" style={{background:'#fff',whiteSpace:'pre-wrap'}} aria-label="Message preview">
     <p>{composedBody}</p>
    </div>}
   <p className="muted">Use Back to make changes, or Continue to confirm.</p>
  </section>
  <section style={{display:step===3?'block':'none'}} aria-label="Confirm campaign" className="charis-flow-panel"><div className="charis-flow-panel-heading"><span className="charis-flow-panel-icon"><ClipboardCheck size={21}/></span><div><h3>Final check before sending</h3><p>Check the content and audience once more. No message is sent until you authorise it.</p></div></div>
   <h3>Confirm campaign</h3>
   <dl className="charis-flow-summary" aria-label="Final campaign summary">
    <div><dt>Subject</dt><dd>{subject}</dd></div>
    <div><dt>Recipients</dt><dd>{audienceLabel}</dd></div>
    <div><dt>Channel & type</dt><dd>{channel.toUpperCase()} · {typeLabel}</dd></div>
    <div><dt>Product</dt><dd>{productLabel}</dd></div>
   </dl>
   {channel==='email'?(step===3&&<DirectEmailPreview key="confirmation" preview={preview} finalReview/>):
    <div className="direct-review" style={{whiteSpace:'pre-wrap'}} aria-label="Final SMS preview">{composedBody}</div>}
   <label>When to send<select value={mode} onChange={e=>{setConfirmed(false);setMode(e.target.value as 'now'|'later');}}><option value="now">Send now</option>{schedulingEnabled&&<option value="later">Schedule for later</option>}</select></label>
   {mode==='later'&&<label>Send on (Nigeria time · WAT)<input type="datetime-local" value={sendAt} onChange={e=>{setConfirmed(false);setSendAt(e.target.value);}}/></label>}
   <div className="charis-flow-guidance"><Info size={16}/><span>Check the final preview above and recipient list before authorising delivery. Delivery may be queued or require approval, depending on bank settings.</span></div>
   <label className="direct-send-confirm charis-flow-approval"><input type="checkbox" name="confirmed" value="yes" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
    I have reviewed the message and recipients, and I authorise this campaign to be {mode==='later'?'scheduled':'submitted'}.
   </label>
   <p className="muted">{approvalRequired?'The campaign will go for approval before sending.':mode==='later'?'It will be queued for your selected time.':'Messages will be submitted when you click Confirm & Send.'}</p>
  </section>
  {step===0&&!messageReady&&<p className="charis-flow-guidance" role="status"><Info size={16}/><span>To continue, enter a subject (3–180 characters) and a message (10–2,000 characters), and resolve any design warnings.</span></p>}
  {step===1&&!recipientsReady&&<p className="charis-flow-guidance" role="status"><Info size={16}/><span>Select at least one customer or choose a contact group to continue.</span></p>}
  {step===2&&!!preview.error&&<p className="charis-flow-guidance" role="alert"><Info size={16}/><span>Fix the preview issue before continuing. Use Back to edit the message.</span></p>}
  <div className="direct-wizard-actions"><p className="charis-flow-navigation-note">Step {step+1} of 4 · You can go back without losing the message you have written.</p><div className="charis-flow-button-group">
   {step>0&&<button type="button" className="btn secondary" disabled={pending||!!state.id} onClick={()=>{setConfirmed(false);setStep(s=>s-1);}}><ArrowLeft size={15}/> Back</button>}
   {step<3?<button type="button" className="btn" disabled={pending||!!state.id||(step===0?!messageReady:step===1?!recipientsReady:!!preview.error)} onClick={()=>{setConfirmed(false);setStep(s=>Math.min(3,s+1));}} >{step===2?'Continue to confirmation':'Continue'} <ArrowRight size={15}/></button>:
    <button type="submit" name="commit_send" value="yes" className="btn" disabled={pending||!!state.id||!confirmed||!messageReady||!recipientsReady||!scheduleReady}>{pending?'Submitting…':approvalRequired?'Confirm & Submit for Approval':mode==='later'?'Confirm & Schedule':'Confirm & Send'}</button>}
   </div></div>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}
  {state.success&&<div role="status" className="notice"><strong>{state.success}</strong> {state.id&&<Link className="inline-link" href={`/dashboard/communications/history?id=${state.id}`}>View status →</Link>}</div>}
 </form>;
}
