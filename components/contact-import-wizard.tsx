'use client';

import {useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {parseCsv,normalizePhone} from '@/lib/contacts/parse-csv.mjs';
import {importColumnValue,normalizeColumnKey,previewColumnValue,restrictedColumn,suggestedColumn} from '@/lib/contacts/import-mapping.mjs';

const mainFields=[
 {key:'first_name',label:'First name'},
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
const MAX_EXTRA=12;
const headings:Record<MainField,string[]>={
 first_name:['firstname','first','givenname','customerfirstname','forename'],
 last_name:['lastname','surname','familyname','customerlastname'],
 email:['email','emailaddress','mail','customeremail'],
 phone:['phone','phonenumber','mobile','mobilenumber','telephone','whatsapp','contactnumber']
};
const emptyCounts=()=>({inserted:0,skipped:0,rejected:0});
function autoMap(field:MainField,header:string){
 const normalized=header.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
 return headings[field].includes(normalized);
}

/**
 * The four core fields map directly to the contacts table. Up to 12 explicitly
 * chosen extra columns are saved to contacts.attributes and can be used in
 * campaign personalization. Consent for marketing emails is confirmed against bank records, not inferred from spreadsheets.
 */
export function ContactImportWizard({org,lists}:{org:string;lists:{id:string;name:string}[]}){
 const [preview,setPreview]=useState<Preview|null>(null);
 const [mapping,setMapping]=useState<Record<MainField,number>>({first_name:-1,last_name:-1,email:-1,phone:-1});
 const [extraColumns,setExtraColumns]=useState<Record<number,ExtraColumn>>({});
 const [consentConfirmed,setConsentConfirmed]=useState(false);
 const [consentScope,setConsentScope]=useState<'all_marketing'|'product_specific'>('all_marketing');
 const [consentSource,setConsentSource]=useState('consent_register');
 const [consentReference,setConsentReference]=useState('');
 const [consentDate,setConsentDate]=useState('');
 const [consentProduct,setConsentProduct]=useState('');
 const [country,setCountry]=useState<'none'|'NG'>('none');
 const [counts,setCounts]=useState<Counts>(emptyCounts);
 const [processed,setProcessed]=useState(0);
 const [busy,setBusy]=useState(false);
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
   const attributes:Record<string,string>={};
   for(const item of selectedExtras){
    // Only values from deliberately selected, valid fields are sent to the server.
    if(!/^[a-z][a-z0-9_]{0,39}$/.test(item.key)||restrictedColumn(item.key))continue;
    const value=importColumnValue(item.key,row[item.index]??'');
    if(value)attributes[item.key]=value;
   }
   return {
    first_name:read(row,'first_name'),last_name:read(row,'last_name'),
    email:read(row,'email').toLowerCase(),phone:normalizePhone(read(row,'phone'),country),attributes
   };
  });
 },[preview,mapping,country,selectedExtras]);

 async function fileSelected(file?:File){
  invalidate();setPreview(null);setExtraColumns({});listRef.current=null;
  if(!file)return;
  if(file.size>MAX_FILE_BYTES){setError('This file is too large. Maximum size is 5 MB.');return;}
  if(!/\.(csv|xlsx)$/i.test(file.name)){setError('Choose a CSV or Excel (.xlsx) file.');return;}
  try{
   let matrix:string[][];
   if(/\.csv$/i.test(file.name))matrix=parseCsv(await file.text(),{maxRows:MAX_RECORDS+1,maxColumns:MAX_COLUMNS});
   else {
    const {readSheet}=await import('read-excel-file/browser');
    const values=await readSheet(file);
    matrix=values.map(row=>row.map(cell=>cell==null?'':String(cell)));
   }
   if(matrix.length<2)throw new Error('The file must have column headings and at least one customer.');
   if(matrix.length>MAX_RECORDS+1)throw new Error('You can import at most 5,000 contacts at a time.');
   if(matrix[0].length>MAX_COLUMNS)throw new Error('You can upload a file with at most 60 columns.');
   const headers=matrix[0].map((item,index)=>String(item||`Column ${index+1}`).trim());
   const defaults=Object.fromEntries(mainFields.map(({key})=>[key,headers.findIndex(h=>autoMap(key,h))])) as Record<MainField,number>;
   setMapping(defaults);
   setExtraColumns(Object.fromEntries(headers.map((header,index)=>[index,{include:false,name:normalizeColumnKey(header)}])));
   setPreview({headers,rows:matrix.slice(1),filename:file.name});
  }catch(e){setError(e instanceof Error?e.message:'The spreadsheet could not be read.');}
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
  if(mapping.email<0&&mapping.phone<0)return 'Choose at least an Email or Phone column.';
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
  if(!consentConfirmed)return 'Confirm that each included customer has already consented to the selected marketing purpose.';
  if(consentReference.trim().length<8)return 'Enter a consent register, signed-form or CRM record reference (at least 8 characters).';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(consentDate)||consentDate>new Date().toISOString().slice(0,10))return 'Enter the actual date the permission was recorded.';
  if(consentScope==='product_specific'&&consentProduct.trim().length<2)return 'Enter the product or service covered by the permission.';
  if(listTarget==='new'&&!newListName.trim())return 'Enter a name for your new customer group.';
  return '';
 }
 async function importRows(){
  if(!preview||busy||complete)return;
  const issue=checkMapping();if(issue){setError(issue);return;}
  // Preserve batch keys when retrying a partial network failure.
  setError('');setComplete(false);setCounts(emptyCounts());setProcessed(0);setReviewBatch('');setIssueBatchCount(0);setBusy(true);
  // Extra values can make requests large. Keep below the server's 95 KB body limit.
  const batchSize=selectedExtras.length?25:100;
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
    const response=await fetch('/api/contacts/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,batch_key:batches.current[i],rows,...(listId?{list_id:listId}:{}),consent:{confirmed:true,scope:consentScope,source:consentSource,reference:consentReference.trim(),recorded_on:consentDate,product:consentProduct.trim()}})});
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
  <div className="admin-form">
   <h2>Step 1 · Upload your customer file</h2>
   <label>Choose CSV or Excel (.xlsx)<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={e=>fileSelected(e.target.files?.[0])}/></label>
   <p className="muted">Maximum 5 MB, 5,000 rows and 60 spreadsheet columns. <a className="inline-link" href="/samples/contacts-import.csv" download>Basic example</a> · <a className="inline-link" href="/samples/contacts-extra-fields.csv" download>Example with extra details</a></p>
   <label>Phone numbers without country codes<select value={country} disabled={busy||complete} onChange={e=>{setCountry(e.target.value as 'none'|'NG');invalidate();}}><option value="none">Keep numbers as they are</option><option value="NG">Convert Nigerian 080… numbers to +234…</option></select></label>
  </div>
  {preview&&<>
   <div className="admin-form">
    <h2>Step 2 · Choose what each column means</h2>
    <p className="muted"><strong>{preview.filename}</strong> · {preview.rows.length.toLocaleString()} customer rows · {preview.headers.length} columns found.</p>
    <h3>Main customer information</h3>
    <div className="mapping-grid">{mainFields.map(field=><label key={field.key}>{field.label}<select value={mapping[field.key]} disabled={busy||complete} onChange={e=>{setMapping(old=>({...old,[field.key]:Number(e.target.value)}));invalidate();}}><option value={-1}>Not included</option>{preview.headers.map((header,index)=><option value={index} key={index}>{header} (column {index+1})</option>)}</select></label>)}</div>
    <p className="muted">You need at least Email or Phone. Names are optional. Consent must be documented in Step 4; no permission is inferred from a customer account.</p>
    <div className="workspace-heading"><div><h3>Other spreadsheet columns</h3><p className="muted">Choose additional details you want to keep for your campaigns. Rename them if needed.</p></div><button className="btn secondary" type="button" onClick={selectSuggested} disabled={busy||complete}>Select suggested fields</button></div>
    <p className="muted"><strong>{selectedExtras.length} of {MAX_EXTRA} extra fields selected.</strong> Other spreadsheet columns are ignored. Sensitive columns such as BVN, balances and PINs are not imported.</p>
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>Spreadsheet column</th><th>What to do</th><th>Save this detail as</th></tr></thead><tbody>{preview.headers.map((header,index)=>{
     const used=mainFields.find(field=>mapping[field.key]===index);
     const extra=extraColumns[index]||{include:false,name:normalizeColumnKey(header)};
     const blocked=restrictedColumn(normalizeColumnKey(header));
     return <tr key={index}><td><strong>{header}</strong><div className="muted">Column {index+1}</div></td><td>{used?<span className="muted">Used for {used.label}</span>:blocked?<span className="muted">Restricted field</span>:<label><input type="checkbox" checked={extra.include} disabled={busy||complete} onChange={e=>changeExtra(index,{include:e.target.checked})}/> Include in campaigns</label>}</td><td>{!used&&!blocked&&extra.include?<label><span className="sr-only">Saved field name for {header}</span><input aria-label={`Saved field name for ${header}`} value={extra.name} disabled={busy||complete} maxLength={40} onChange={e=>changeExtra(index,{name:e.target.value.toLowerCase().trim()})}/></label>:<span className="muted">{used?'Mapped above':blocked?'Not imported':'Not included'}</span>}</td></tr>;
    })}</tbody></table></div>
    <p className="muted">Account references are stored as their last four digits only. Full account numbers, passwords, BVNs and account balances should not be uploaded as campaign details.</p>
   </div>
   <div className="admin-form">
    <h2>Step 3 · Save customers to a group</h2>
    <p className="muted">Group customers together so you can easily choose them when creating a campaign.</p>
    <label>Choose a group<select value={listTarget} disabled={busy||complete} onChange={e=>{setListTarget(e.target.value);listRef.current=null;invalidate();}}><option value="new">Create a new group</option>{lists.map(list=><option value={list.id} key={list.id}>{list.name}</option>)}<option value="none">Do not use a group</option></select></label>
    {listTarget==='new'&&<label>New group name<input value={newListName} disabled={busy||complete} maxLength={100} onChange={e=>{setNewListName(e.target.value);listRef.current=null;invalidate();}} placeholder="October account updates"/></label>}
   </div>
   <div className="admin-form">
    <h2>Step 4 · Verify existing customer marketing permission</h2>
    <p className="muted">Import only people who already gave documented permission. A new upload will never undo a previous opt-out. Contacts whose permission is limited to one product are stored without eligibility for general marketing broadcasts.</p>
    <label>Permission covers<select value={consentScope} disabled={busy||complete} onChange={e=>{setConsentScope(e.target.value as 'all_marketing'|'product_specific');invalidate();}}><option value="all_marketing">All Charis promotional updates (explicit permission required)</option><option value="product_specific">Only one product or service (not eligible for general broadcasts)</option></select></label>
    {consentScope==='product_specific'&&<label>Approved product/service<input value={consentProduct} maxLength={80} disabled={busy||complete} onChange={e=>{setConsentProduct(e.target.value);invalidate();}} placeholder="e.g. Fixed deposits"/></label>}
    <label>Where was permission recorded?<select value={consentSource} disabled={busy||complete} onChange={e=>{setConsentSource(e.target.value);invalidate();}}><option value="consent_register">Bank consent register / CRM</option><option value="signed_form">Signed customer opt-in form</option><option value="digital_form">Online opt-in form</option><option value="recorded_call">Recorded customer permission</option><option value="other">Other documented evidence</option></select></label>
    <label>Evidence/register reference<input value={consentReference} maxLength={200} disabled={busy||complete} onChange={e=>{setConsentReference(e.target.value);invalidate();}} placeholder="Consent register batch, form or record ID"/></label>
    <label>Date of existing permission<input type="date" value={consentDate} max={new Date().toISOString().slice(0,10)} disabled={busy||complete} onChange={e=>{setConsentDate(e.target.value);invalidate();}}/></label>
    <label><input type="checkbox" checked={consentConfirmed} disabled={busy||complete} onChange={e=>{setConsentConfirmed(e.target.checked);invalidate();}}/> I confirm that evidence is available for each contact in this file, and that this import does not include people who declined or withdrew promotional permission.</label>
    <h2>Step 5 · Review and import</h2>
    <p className="muted">Previewing the first five rows. Check the mapped columns before importing.</p>
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>First name</th><th>Last name</th><th>Email</th><th>Phone</th>{selectedExtras.map(item=><th key={item.index}>{item.header}</th>)}</tr></thead><tbody>{prepared.slice(0,5).map((row,index)=><tr key={index}><td>{row.first_name||'—'}</td><td>{row.last_name||'—'}</td><td>{row.email||'—'}</td><td>{row.phone||'—'}</td>{selectedExtras.map(item=><td key={item.index}>{previewColumnValue(item.key,preview.rows[index]?.[item.index]||'')||'—'}</td>)}</tr>)}</tbody></table></div>
    <button className="btn" type="button" onClick={importRows} disabled={busy||complete}>{busy?'Importing customers…':complete?'Import complete':'Import customers with recorded consent'}</button>
    {(busy||processed>0)&&<><progress max={prepared.length} value={processed} className="import-progress"/><p className="muted">Processed {processed} of {prepared.length} · Added {counts.inserted} · Duplicates {counts.skipped} · Invalid {counts.rejected}</p></>}
    {complete&&<div role="status" className="feedback-success"><p>Import complete. Existing contacts and opt-outs were preserved; suppressed emails were skipped. Product-limited permissions do not grant general broadcast eligibility.</p>{issueBatchCount>0&&<p><strong>{issueBatchCount} batch(es) contain duplicates or invalid rows.</strong> <Link href={`/dashboard/imports?org=${org}&review=${reviewBatch}#import-review`}>Review those rows →</Link> Select other batches from the review dropdown if needed.</p>}<Link href={`/dashboard/campaigns?org=${org}&create=1`}>Create a campaign →</Link></div>}
    {error&&<p role="alert" className="feedback-error">{error}</p>}
   </div>
  </>}
  {!preview&&error&&<p role="alert" className="feedback-error">{error}</p>}
 </div>;
}
