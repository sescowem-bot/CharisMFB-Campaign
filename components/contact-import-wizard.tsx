'use client';

import {useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {parseCsv,normalizePhone} from '@/lib/contacts/parse-csv.mjs';
import {importColumnValue,normalizeColumnKey,previewColumnValue,restrictedColumn,suggestedColumn} from '@/lib/contacts/import-mapping.mjs';

const mainFields=[
 {key:'first_name',label:'First name / Full name'},
 {key:'last_name',label:'Last name'},
 {key:'email',label:'Email address'},
 {key:'phone',label:'Phone number'}
] as const;
type MainField=typeof mainFields[number]['key'];
type ExtraColumn={include:boolean;name:string};
type Counts={inserted:number;skipped:number;rejected:number};
type Preview={headers:string[];rows:string[][];filename:string};
const MAX_FILE_BYTES=5*1024*1024;
const MAX_RECORDS=5000;
const MAX_COLUMNS=60;
const MAX_EXTRA=56;
const headings:Record<MainField,string[]>={
 first_name:['firstname','first','givenname','customerfirstname','forename','fname','first_name','firstnames','given_name','customer_first_name','clientfirstname','fullname','customername','clientname','name','fullcustomername','customerfullname','clientfullname','fullnamecustomer','nameofcustomer','customernameof','accountname','account_name','beneficiaryname'],
 last_name:['lastname','surname','familyname','customerlastname','lname','last_name','family_name','customer_last_name','clientlastname'],
 email:['email','emailaddress','mail','customeremail','e_mail','emailid','email_id','email_address','customer_email','mailid','emailaddr','clientemail','customermail','clientmail','email1','emailaddress1','primaryemail','primaryemailaddress'],
 phone:['phone','phonenumber','mobile','mobilenumber','telephone','whatsapp','contactnumber','phone_number','mobile_number','mobilephone','cellphone','contact_phone','customerphone','customer_phone','mobile_no','phone_no','telephone_no','clientphone','contact']
};
const emptyCounts=()=>({inserted:0,skipped:0,rejected:0});
function normalizedHeader(header:string){return header.trim().toLowerCase().replace(/[^a-z0-9]/g,'');}
function detectHeaderRow(matrix:string[][]){
 const aliases=new Set(Object.values(headings).flat().map(value=>value.replace(/[^a-z0-9]/g,'')));
 let best=0,bestScore=0;
 for(let i=0;i<Math.min(matrix.length,20);i++){
  const values=matrix[i].map(normalizedHeader).filter(Boolean);
  const score=new Set(values.filter(value=>aliases.has(value))).size;
  if(score>bestScore){best=i;bestScore=score;}
 }
 return bestScore>=1?best:0;
}
function isCombinedNameHeader(header:string){
 const normalized=normalizedHeader(header);
 return new Set(['fullname','fullcustomername','customerfullname','clientfullname','fullnamecustomer','customername','clientname','name','nameofcustomer','accountname','beneficiaryname']).has(normalized);
}
function autoMap(field:MainField,header:string){
 const normalized=normalizedHeader(header);
 return headings[field].includes(normalized);
}

/**
 * The four core fields map directly to the contacts table. Up to 12 explicitly
 * chosen extra columns are saved to contacts.attributes and can be used in
 * campaign personalization. Email permission is confirmed against the bank's existing records, not inferred from spreadsheets.
 */
export function ContactImportWizard({org,lists,campaignMode=false,onComplete}:{org:string;lists:{id:string;name:string}[];campaignMode?:boolean;onComplete?:(listId:string|null)=>void}){
 const [preview,setPreview]=useState<Preview|null>(null);
 const [step,setStep]=useState(1);
 const [mapping,setMapping]=useState<Record<MainField,number>>({first_name:-1,last_name:-1,email:-1,phone:-1});
 const [extraColumns,setExtraColumns]=useState<Record<number,ExtraColumn>>({});
 const [consentConfirmed,setConsentConfirmed]=useState(false);
 const [consentSource,setConsentSource]=useState('signed_form');
 const [country,setCountry]=useState<'none'|'NG'>('NG');
 const [counts,setCounts]=useState<Counts>(emptyCounts);
 const [processed,setProcessed]=useState(0);
 const [busy,setBusy]=useState(false);
 const [fileLoading,setFileLoading]=useState(false);
 const [error,setError]=useState('');
 const [complete,setComplete]=useState(false);
 const [reviewBatch,setReviewBatch]=useState('');
 const [issueBatchCount,setIssueBatchCount]=useState(0);
 const batches=useRef<string[]>([]);
 const [listTarget,setListTarget]=useState('new');
 const [newListName,setNewListName]=useState('');
 const listRef=useRef<string|null>(null);

 function invalidate(){
  setError('');setComplete(false);setCounts(emptyCounts());setProcessed(0);batches.current=[];setReviewBatch('');setIssueBatchCount(0);
 }
 const mainIndexes=useMemo(()=>new Set(Object.values(mapping).filter(index=>index>=0)),[mapping]);
 const selectedExtras=useMemo(()=>{
  if(!preview)return [];
  return preview.headers.flatMap((header,index)=>{
   const option=extraColumns[index];
   if(mainIndexes.has(index)||!option?.include)return [];
   return [{index,header,key:option.name.trim()}];
  });
 },[preview,extraColumns,mainIndexes]);
 const prepared=useMemo(()=>{
  if(!preview)return [];
  const read=(row:string[],field:MainField)=>mapping[field]>=0?String(row[mapping[field]]??'').trim():'';
  return preview.rows.map(row=>{
   const firstValue=read(row,'first_name');
   const lastValue=read(row,'last_name');
   const fullNameColumn=mapping.first_name>=0&&mapping.last_name<0&&isCombinedNameHeader(preview.headers[mapping.first_name]);
   const nameParts=fullNameColumn?firstValue.trim().split(/\s+/).filter(Boolean):[];
   const firstName=fullNameColumn?(nameParts.shift()||''):firstValue;
   const lastName=fullNameColumn?nameParts.join(' '):lastValue;
   const attributes:Record<string,string>={};
   for(const item of selectedExtras){
    // Only values from deliberately selected, valid fields are sent to the server.
    if(!/^[a-z][a-z0-9_]{0,39}$/.test(item.key)||restrictedColumn(item.key))continue;
    const value=importColumnValue(item.key,row[item.index]??'');
    if(value)attributes[item.key]=value;
   }
   return {
    first_name:firstName,last_name:lastName,
    email:read(row,'email').toLowerCase(),phone:normalizePhone(read(row,'phone'),country),attributes
   };
  });
 },[preview,mapping,country,selectedExtras]);

 async function fileSelected(file?:File){
  invalidate();setPreview(null);setExtraColumns({});setStep(1);listRef.current=null;
  if(!file)return;
  if(file.size>MAX_FILE_BYTES){setError('This file is too large. Maximum size is 5 MB.');return;}
  if(!/\.(csv|tsv|txt|xlsx)$/i.test(file.name)){setError('Choose a CSV, TSV, TXT or Excel (.xlsx) file.');return;}
  setFileLoading(true);
  try{
   let matrix:string[][];
   if(/\.(csv|tsv|txt)$/i.test(file.name))matrix=parseCsv(await file.text(),{maxRows:MAX_RECORDS+20,maxColumns:MAX_COLUMNS});
   else {
    const {readSheet}=await import('read-excel-file/browser');
    const values=await readSheet(file);
    matrix=values.map(row=>row.map(cell=>cell==null?'':String(cell)));
   }
   const headerRow=detectHeaderRow(matrix);
   const dataRows=matrix.slice(headerRow+1).filter(row=>row.some(cell=>String(cell??'').trim()!==''));
   if(dataRows.length<1)throw new Error('We could not find a header row with customer records below it. Check that your file contains column headings and contact rows.');
   if(dataRows.length>MAX_RECORDS)throw new Error('You can import at most 5,000 contacts at a time.');
   const rawHeaders=matrix[headerRow]||[];
   if(rawHeaders.length>MAX_COLUMNS)throw new Error('You can upload a file with at most 60 columns.');
   const headers=rawHeaders.map((item,index)=>String(item||`Column ${index+1}`).trim());
   const defaults=Object.fromEntries(mainFields.map(({key})=>[key,headers.findIndex(h=>autoMap(key,h))])) as Record<MainField,number>;
   setMapping(defaults);
   setExtraColumns(Object.fromEntries(headers.map((header,index)=>[index,{include:false,name:normalizeColumnKey(header)}])));
   setPreview({headers,rows:dataRows.map(row=>headers.map((_,index)=>String(row[index]??''))),filename:file.name});
   setStep(2);
  }catch(e){setError(e instanceof Error?e.message:'The spreadsheet could not be read.');}
  finally{setFileLoading(false);}
 }
 function changeExtra(index:number,partial:Partial<ExtraColumn>){
  invalidate();setExtraColumns(current=>({...current,[index]:{...current[index],...partial}}));
 }
 function selectSuggested(){
  invalidate();
  if(!preview)return;
  setExtraColumns(current=>{
   const next={...current};
   let total=0;
   for(let i=0;i<preview.headers.length;i++){
    const key=next[i]?.name||normalizeColumnKey(preview.headers[i]);
    if(mainIndexes.has(i)||restrictedColumn(key))continue;
    if(next[i]?.include)total++;
   }
   for(let i=0;i<preview.headers.length&&total<MAX_EXTRA;i++){
    const key=next[i]?.name||normalizeColumnKey(preview.headers[i]);
    if(mainIndexes.has(i)||restrictedColumn(key)||next[i]?.include||!suggestedColumn(key))continue;
    next[i]={include:true,name:key};total++;
   }
   return next;
  });
 }
 function checkMapping(){
  if(mapping.email<0)return 'Choose an Email column. Phone numbers are optional.';
  const mapped=Object.values(mapping).filter(value=>value>=0);
  if(new Set(mapped).size!==mapped.length)return 'One spreadsheet column cannot be used as two main contact fields.';
  if(selectedExtras.length>MAX_EXTRA)return `You can select at most ${MAX_EXTRA} additional details.`;
  const names=new Set<string>();
  for(const entry of selectedExtras){
   if(!/^[a-z][a-z0-9_]{0,39}$/.test(entry.key))return `Check the field name for ${entry.header}. Use letters, numbers and underscores, starting with a letter.`;
   if(restrictedColumn(entry.key))return `${entry.header} is a restricted or reserved field and cannot be imported as a campaign detail.`;
   if(names.has(entry.key))return `You have used the field name "${entry.key}" twice. Give each extra field a different name.`;
   names.add(entry.key);
  }
  if(!consentConfirmed)return 'Confirm that the selected consent type is supported by existing customer records.';
  if(listTarget==='new'&&!newListName.trim())return 'Enter a name for your new customer group.';
  return '';
 }
 async function importRows(){
  if(!preview||busy||complete)return;
  const issue=checkMapping();if(issue){setError(issue);return;}
  // Preserve batch keys when retrying a partial network failure.
  setError('');setComplete(false);setCounts(emptyCounts());setProcessed(0);setReviewBatch('');setIssueBatchCount(0);setBusy(true);
  // Extra values can make requests large. Keep below the server's 95 KB body limit.
  const batchSize=selectedExtras.length>20?4:selectedExtras.length?25:100;
  const totalBatches=Math.ceil(prepared.length/batchSize);
  if(batches.current.length!==totalBatches)batches.current=Array.from({length:totalBatches},()=>crypto.randomUUID());
  let inserted=0,skipped=0,rejected=0;
  let firstIssueBatch='',issueBatches=0;
  try{
   let listId=listTarget==='none'?null:listTarget==='new'?listRef.current:listTarget;
   if(listTarget==='new'&&!listId){
    const response=await fetch('/api/contacts/lists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,name:newListName.trim()})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Could not create the group.');
    listId=result.id;listRef.current=listId;
   }
   for(let i=0;i<totalBatches;i++){
    const rows=prepared.slice(i*batchSize,(i+1)*batchSize).map((row,j)=>({...row,source_row:i*batchSize+j+2}));
    const response=await fetch('/api/contacts/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,batch_key:batches.current[i],rows,...(listId?{list_id:listId}:{}),consent:{confirmed:true,scope:'all_marketing',source:consentSource,reference:`staff-confirmed-import:${batches.current[i]}`,recorded_on:new Date().toISOString().slice(0,10),product:''}})});
    const result=await response.json();
    if(!response.ok)throw new Error(`Batch ${i+1}: ${result.error||'The import could not be completed.'}`);
    inserted+=result.inserted;skipped+=result.skipped;rejected+=result.rejected;
    if(result.skipped+result.rejected>0){issueBatches++;if(!firstIssueBatch&&result.batch_id)firstIssueBatch=result.batch_id;}
    setCounts({inserted,skipped,rejected});setProcessed(Math.min((i+1)*batchSize,prepared.length));
   }
   setComplete(true);setReviewBatch(firstIssueBatch);setIssueBatchCount(issueBatches);
  }catch(e){setError(e instanceof Error?e.message:'Could not import contacts.');}
  finally{setBusy(false);}
 }
 return <div className="import-flow">
  <div className="import-stepper" aria-label="Import progress"><ol>{["Upload","Match columns","Contact group","Permission","Review"].map((label,index)=><li key={label} aria-current={step===index+1?"step":undefined} className={step>index+1?"is-complete":step===index+1?"is-current":""}><span>{step>index+1?"✓":index+1}</span><small>{label}</small></li>)}</ol></div>
  {error&&<p role="alert" className="feedback-error">{error}</p>}
  <div className="admin-form" hidden={step!==1}>
   <h2>Step 1 · Upload your customer file</h2>
   <p className="muted">Use your existing spreadsheet. You do not need to rearrange it into a Charis template: the importer reads your column headings and lets you match them to contact fields.</p>
   <label>Choose a spreadsheet or delimited text file<input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy||fileLoading} onChange={e=>fileSelected(e.target.files?.[0])}/>{fileLoading&&<span className="muted" role="status">Reading spreadsheet and detecting headings…</span>}</label>
   <p className="muted">Maximum 5 MB, 5,000 contact rows and 60 columns. CSV, TSV, TXT and Excel (.xlsx) files are supported; column order and common bank-export delimiters are detected automatically. <a className="inline-link" href="/samples/contacts-import.csv" download>Basic example</a> · <a className="inline-link" href="/samples/contacts-extra-fields.csv" download>Example with extra details</a></p>
   <label>How should local phone numbers be handled?<select value={country} disabled={busy||complete} onChange={e=>{setCountry(e.target.value as 'none'|'NG');invalidate();}}><option value="NG">Nigeria (+234) — recommended for Charis exports</option><option value="none">Do not assume a country code</option></select><span className="muted">For Nigerian exports, numbers such as 080… and Excel-trimmed 80… / 90… are converted to +234. Existing +234 and valid international numbers are preserved. Invalid or unrecognised phone values are ignored; email is what identifies the customer.</span></label>
  </div>
  {preview&&<>
   <div className="admin-form" hidden={step!==2}>
    <h2>Step 2 · Match your spreadsheet headings</h2>
    <p className="muted"><strong>{preview.filename}</strong> · {preview.rows.length.toLocaleString()} customer rows · {preview.headers.length} columns found. Common headings are matched automatically; you can change any match below.</p>
    <h3>Main customer information</h3>
    <div className="mapping-grid">{mainFields.map(field=><label key={field.key}>{field.label}<select value={mapping[field.key]} disabled={busy||complete} onChange={e=>{setMapping(old=>({...old,[field.key]:Number(e.target.value)}));invalidate();}}><option value={-1}>Not included</option>{preview.headers.map((header,index)=><option value={index} key={index}>{header} (column {index+1})</option>)}</select></label>)}</div>
    <p className="muted">Email is required. Phone numbers are optional and can be left unmapped or ignored. A column labelled Full Name, Customer Name, Client Name or Account Name is recognised automatically; the first name is taken as the first word and the remaining words become the last name. Check the preview before importing. Permission must be confirmed in Step 4; no permission is inferred from a customer account.</p>
    <div className="workspace-heading"><div><h3>Other spreadsheet columns</h3><p className="muted">Choose additional details you want to keep for your campaigns. Rename them if needed.</p></div><button className="btn secondary" type="button" onClick={selectSuggested} disabled={busy||complete}>Select suggested fields</button></div>
    <p className="muted"><strong>{selectedExtras.length} of {MAX_EXTRA} extra fields selected.</strong> Select and name the additional columns you want to append to each contact. Unselected columns are ignored. Sensitive columns such as BVN, balances and PINs are blocked.</p>
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>Spreadsheet column</th><th>What to do</th><th>Save this detail as</th></tr></thead><tbody>{preview.headers.map((header,index)=>{
     const used=mainFields.find(field=>mapping[field.key]===index);
     const extra=extraColumns[index]||{include:false,name:normalizeColumnKey(header)};
     const blocked=restrictedColumn(normalizeColumnKey(header));
     return <tr key={index}><td><strong>{header}</strong><div className="muted">Column {index+1}</div></td><td>{used?<span className="muted">Used for {used.label}</span>:blocked?<span className="muted">Restricted field</span>:<label><input type="checkbox" checked={extra.include} disabled={busy||complete} onChange={e=>changeExtra(index,{include:e.target.checked})}/> Include in campaigns</label>}</td><td>{!used&&!blocked&&extra.include?<label><span className="sr-only">Saved field name for {header}</span><input aria-label={`Saved field name for ${header}`} value={extra.name} disabled={busy||complete} maxLength={40} onChange={e=>changeExtra(index,{name:e.target.value.toLowerCase().trim()})}/></label>:<span className="muted">{used?'Mapped above':blocked?'Not imported':'Not included'}</span>}</td></tr>;
    })}</tbody></table></div>
    <p className="muted">Full account numbers are retained and can be shown in campaign emails. For Excel files, format account-number columns as Text before saving so Excel does not remove leading zeros. Passwords, BVNs and account balances remain restricted.</p>
    <div className="import-actions"><button className="btn secondary" type="button" onClick={()=>setStep(1)}>Back</button><button className="btn" type="button" onClick={()=>{if(mapping.email<0){setError("Choose an Email column. Phone numbers are optional.");return;}const used=Object.values(mapping).filter(value=>value>=0);if(new Set(used).size!==used.length){setError("A column can only be mapped to one main contact field.");return;}setError("");setStep(3);}}>Next: Contact group</button></div>
   </div>
   <div className="admin-form" hidden={step!==3}>
    <h2>Step 3 · Save customers to a group</h2>
    <p className="muted">Group customers together so you can easily choose them when creating a campaign.</p>
    <label>Choose a group<select value={listTarget} disabled={busy||complete} onChange={e=>{setListTarget(e.target.value);listRef.current=null;invalidate();}}><option value="new">Create a new group</option>{lists.map(list=><option value={list.id} key={list.id}>{list.name}</option>)}{!campaignMode&&<option value="none">Do not use a group</option>}</select></label>
    {listTarget==='new'&&<label>New group name<input value={newListName} disabled={busy||complete} maxLength={100} onChange={e=>{setNewListName(e.target.value);listRef.current=null;invalidate();}} placeholder="October account updates"/></label>}
    <div className="import-actions"><button className="btn secondary" type="button" onClick={()=>setStep(2)}>Back</button><button className="btn" type="button" onClick={()=>{if(listTarget==='new'&&!newListName.trim()){setError("Enter a name for the new contact group.");return;}setError("");setStep(4);}}>Next: Permission</button></div>
   </div>
   <div className="admin-form" hidden={step!==4&&step!==5}>
    {step===4&&<>
    <h2>Step 4 · Confirm customer permission</h2>
    <p className="muted">Choose the existing permission record type and confirm that customers in this file have agreed to receive Charis marketing emails. Previous opt-outs and unsubscribes remain protected.</p>
    <label>Consent record type<select value={consentSource} disabled={busy||complete} onChange={e=>{setConsentSource(e.target.value);invalidate();}}><option value="signed_form">Signed account-opening / application form</option><option value="consent_register">Bank consent register / CRM</option><option value="digital_form">Digital opt-in</option><option value="recorded_call">Recorded customer permission</option><option value="other">Other documented permission</option></select></label>
    <label><input type="checkbox" checked={consentConfirmed} disabled={busy||complete} onChange={e=>{setConsentConfirmed(e.target.checked);invalidate();}}/> I confirm that the selected permission type is supported by existing records for every customer in this import.</label>
    <div className="import-actions"><button className="btn secondary" type="button" onClick={()=>setStep(3)}>Back</button><button className="btn" type="button" onClick={()=>{if(!consentConfirmed){setError("Please confirm existing customer permission before continuing.");return;}setError("");setStep(5);}}>Next: Review import</button></div>
    </>}
   </div>
   {step===5&&<div className="admin-form">
    <h2>Step 5 · Review and import</h2>
    <p className="muted">Previewing the first five rows. Check the mapped columns before importing.</p>
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>First name</th><th>Last name</th><th>Email</th><th>Phone (optional)</th>{selectedExtras.map(item=><th key={item.index}>{item.header}</th>)}</tr></thead><tbody>{prepared.slice(0,5).map((row,index)=><tr key={index}><td>{row.first_name||'—'}</td><td>{row.last_name||'—'}</td><td>{row.email||'—'}</td><td>{row.phone||'—'}</td>{selectedExtras.map(item=><td key={item.index}>{previewColumnValue(item.key,preview.rows[index]?.[item.index]||'')||'—'}</td>)}</tr>)}</tbody></table></div>
    <div className="import-actions"><button className="btn secondary" type="button" onClick={()=>setStep(4)} disabled={busy}>Back</button><button className="btn" type="button" onClick={importRows} disabled={busy||complete}>{busy?'Importing customers…':complete?'Import complete':'Import customers'}</button></div>
    {(busy||processed>0)&&<><progress max={prepared.length} value={processed} className="import-progress"/><p className="muted">Processed {processed} of {prepared.length} · Added {counts.inserted} · Duplicates {counts.skipped} · Invalid {counts.rejected}</p></>}
    {complete&&<div role="status" className="feedback-success"><p>Import complete. Existing contacts and opt-outs were preserved; suppressed emails were skipped. Product-limited permissions do not grant general broadcast eligibility.</p>{campaignMode&&<button type="button" className="btn" onClick={()=>onComplete?.(listTarget==='none'?null:listTarget==='new'?listRef.current:listTarget)}>Use imported recipients in this campaign</button>}{issueBatchCount>0&&<p><strong>Some imported rows were duplicates or need correction.</strong> <Link href={`/dashboard/imports?org=${org}&review=${reviewBatch}#import-review`}>Review those rows →</Link> Select other batches from the review dropdown if needed.</p>}<Link href="/dashboard/communications/new">Create a campaign →</Link></div>}
   </div>}
  </>}
  </div>;
}
