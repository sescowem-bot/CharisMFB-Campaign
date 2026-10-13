'use client';
import {useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {parseCsv,normalizePhone} from '@/lib/contacts/parse-csv.mjs';
const fieldOptions=[{key:'first_name',label:'First name'},{key:'last_name',label:'Last name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'}] as const;
type Field=typeof fieldOptions[number]['key'];
type Counts={inserted:number;skipped:number;rejected:number};
type Preview={headers:string[];rows:string[][];filename:string};
const MAX_FILE_BYTES=5*1024*1024,MAX_RECORDS=5000;
function headingMatch(field:Field,header:string){const normalized=header.trim().toLowerCase().replace(/[^a-z0-9]/g,'');const aliases:Record<Field,string[]>={first_name:['firstname','first','givenname','customerfirstname'],last_name:['lastname','surname','familyname','customerlastname'],email:['email','emailaddress','mail','customeremail'],phone:['phone','phonenumber','mobile','mobilenumber','telephone','whatsapp']};return aliases[field].includes(normalized);}
export function ContactImportWizard({org,lists}:{org:string;lists:{id:string;name:string}[]}){
 const [preview,setPreview]=useState<Preview|null>(null);
 const [mapping,setMapping]=useState<Record<Field,number>>({first_name:-1,last_name:-1,email:-1,phone:-1});
 const [country,setCountry]=useState<'none'|'NG'>('none');
 const [customColumns,setCustomColumns]=useState(false);
 const [counts,setCounts]=useState<Counts>({inserted:0,skipped:0,rejected:0});
 const [processed,setProcessed]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [complete,setComplete]=useState(false);
 const batches=useRef<string[]>([]);
 const [listTarget,setListTarget]=useState('new');
 const [newListName,setNewListName]=useState('');
 const listRef=useRef<string|null>(null);
 const prepared=useMemo(()=>{
  if(!preview)return [];
  const cell=(row:string[],key:Field)=>{const index=mapping[key];return index>=0?String(row[index]||'').trim():''};
  return preview.rows.map(row=>{
   const attributes:Record<string,string>={};
   if(customColumns){
    const mapped=new Set(Object.values(mapping).filter(i=>i>=0));
    const blocked=new Set(['id','organization_id','__proto__','constructor','prototype']);
    preview.headers.forEach((header,i)=>{
     if(mapped.has(i)||Object.keys(attributes).length>=12)return;
     const key=header.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
     let value=String(row[i]||'').slice(0,500);
     if(/(password|pin|otp|bvn|nin|cvv|card_number|secret|token)/.test(key))return;
     if(['account_number','account_no','account_reference'].includes(key))value=value.replace(/\D/g,'').slice(-4);
     if(/^[a-z][a-z0-9_]{0,39}$/.test(key)&&!blocked.has(key)&&value&&!Object.hasOwn(attributes,key))attributes[key]=value;
    });
   }
   return {first_name:cell(row,'first_name'),last_name:cell(row,'last_name'),email:cell(row,'email').toLowerCase(),phone:normalizePhone(cell(row,'phone'),country),attributes};
  });
 },[preview,mapping,country,customColumns]);
 async function fileSelected(file?:File){
  setError('');setComplete(false);setCounts({inserted:0,skipped:0,rejected:0});setProcessed(0);setPreview(null);batches.current=[];listRef.current=null;
  if(!file)return;
  if(file.size>MAX_FILE_BYTES){setError('File is too large. Maximum file size is 5 MB.');return;}
  if(!/\.(csv|xlsx)$/i.test(file.name)){setError('Upload a .csv or .xlsx file.');return;}
  try{
   let matrix:string[][];
   if(/\.csv$/i.test(file.name)){matrix=parseCsv(await file.text(),{maxRows:MAX_RECORDS+1,maxColumns:60});}
   else{const {readSheet}=await import('read-excel-file/browser');const values=await readSheet(file);matrix=values.map(row=>row.map(cell=>cell==null?'':String(cell)));}
   if(matrix.length<2)throw Error('The file needs a header row and at least one contact.');
   if(matrix.length>MAX_RECORDS+1)throw Error('Maximum import size is 5,000 contacts.');
   if(matrix[0].length>60)throw Error('Maximum allowed columns: 60.');
   const headers=matrix[0].map((cell,i)=>String(cell||`Column ${i+1}`).trim());
   const guessed=Object.fromEntries(fieldOptions.map(({key})=>[key,headers.findIndex(h=>headingMatch(key,h))])) as Record<Field,number>;
   setMapping(guessed);setPreview({headers,rows:matrix.slice(1),filename:file.name});
  }catch(e){setError(e instanceof Error?e.message:'Unable to read file. Use a CSV or XLSX workbook.');}
 }
 async function importRows(){
  if(!preview||busy)return;
  if(mapping.email<0&&mapping.phone<0){setError('Map an email or phone column before importing.');return;}
  const mapped=fieldOptions.map(f=>mapping[f.key]).filter(x=>x>=0);
  if(new Set(mapped).size!==mapped.length){setError('Do not map the same source column to multiple fields.');return;}
  if(listTarget==='new'&&!newListName.trim()){setError('Name the new group to make it easy to select after import.');return;}
  setBusy(true);setError('');setComplete(false);
  const totalBatches=Math.ceil(prepared.length/100);
  if(batches.current.length!==totalBatches)batches.current=Array.from({length:totalBatches},()=>crypto.randomUUID());
  let inserted=0,skipped=0,rejected=0;
  try{
   let listId=listTarget==='none'?null:listTarget==='new'?listRef.current:listTarget;
   if(listTarget==='new'&&!listId){
    const response=await fetch('/api/contacts/lists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,name:newListName.trim()})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to create contact group');
    listId=result.id;listRef.current=listId;
   }
   for(let i=0;i<totalBatches;i++){
    const rows=prepared.slice(i*100,(i+1)*100);
    const response=await fetch('/api/contacts/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organization_id:org,batch_key:batches.current[i],rows,...(listId?{list_id:listId}:{})})});
    const result=await response.json();
    if(!response.ok)throw Error(`Batch ${i+1}: ${result.error||'Unable to import contacts'}`);
    inserted+=result.inserted;skipped+=result.skipped;rejected+=result.rejected;
    setCounts({inserted,skipped,rejected});setProcessed(Math.min((i+1)*100,prepared.length));
   }
   setComplete(true);
  }catch(e){setError(e instanceof Error?e.message:'Import failed.');}
  finally{setBusy(false);}
 }
 return <div className="import-flow"><div className="admin-form"><h2>Step 1 · Upload audience</h2><label>Contact file (.csv or .xlsx)<input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={e=>fileSelected(e.target.files?.[0])}/></label><p className="muted">Up to 5 MB / 5,000 rows. The spreadsheet is read in your browser; mapped contacts are sent to your company workspace. <a className="inline-link" href="/samples/contacts-import.csv" download>Download CSV sample</a> · <a className="inline-link" href="/samples/contacts-extra-fields.csv" download>Sample with extra columns</a></p><label>Phone numbers without country codes<select value={country} disabled={busy} onChange={e=>{setCountry(e.target.value as 'none'|'NG');batches.current=[];setProcessed(0);setCounts({inserted:0,skipped:0,rejected:0});setComplete(false);}}><option value="none">Do not modify numbers</option><option value="NG">Convert Nigerian 080… numbers to +234…</option></select></label></div>
 {preview&&<><div className="admin-form"><h2>Step 2 · Map columns</h2><p className="muted">{preview.filename} · {preview.rows.length.toLocaleString()} data rows. Confirm each mapping before import.</p><div className="mapping-grid">{fieldOptions.map(item=><label key={item.key}>{item.label}<select disabled={busy} value={mapping[item.key]} onChange={e=>{setMapping(old=>({...old,[item.key]:Number(e.target.value)}));setComplete(false);batches.current=[];setProcessed(0);setCounts({inserted:0,skipped:0,rejected:0});}}><option value={-1}>Not mapped</option>{preview.headers.map((h,i)=><option value={i} key={i}>{h} (column {i+1})</option>)}</select></label>)}</div><p className="muted">Imported contacts start with <strong>Unknown</strong> marketing consent. This prevents importing opt-in claims without supporting evidence.</p><label className="import-extra-option"><input type="checkbox" checked={customColumns} disabled={busy} onChange={e=>{setCustomColumns(e.target.checked);batches.current=[];setProcessed(0);setCounts({inserted:0,skipped:0,rejected:0});setComplete(false);}}/> Also import up to 12 unmapped columns as custom fields</label><p className="muted">Use this for useful details such as branch, account reference or product. Full account numbers are reduced to their last four digits; passwords, BVN and other credentials must not be imported.</p></div><div className="admin-form"><h2>Step 3 · Save as a recipient group</h2><p className="muted">Customers are added to the selected group automatically, so you can choose the entire imported list in Campaign Studio.</p><label>Where should these contacts go?<select value={listTarget} disabled={busy||complete} onChange={e=>{setListTarget(e.target.value);listRef.current=null;}}><option value="new">Create a new group</option>{lists.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}<option value="none">Do not create a group</option></select></label>{listTarget==='new'&&<label>Group name<input value={newListName} onChange={e=>{setNewListName(e.target.value);listRef.current=null;}} disabled={busy||complete} maxLength={100} placeholder="October customer updates"/></label>}</div><div className="admin-form"><h2>Step 4 · Verify and import</h2><div className="table-scroll"><table className="admin-table"><thead><tr><th>First name</th><th>Last name</th><th>Email</th><th>Phone</th></tr></thead><tbody>{prepared.slice(0,5).map((r,i)=><tr key={i}><td>{r.first_name}</td><td>{r.last_name}</td><td>{r.email}</td><td>{r.phone}</td></tr>)}</tbody></table></div><button className="btn" type="button" disabled={busy||complete} onClick={importRows}>{busy?'Importing…':complete?'Import complete':'Import contacts'}</button>{(busy||processed>0)&&<><progress max={prepared.length} value={processed} className="import-progress"/><p className="muted">Processed {processed} / {prepared.length} · Added {counts.inserted} · Duplicates {counts.skipped} · Invalid {counts.rejected}</p></>}{complete&&<p role="status" className="feedback-success">Import completed. Your contact group is ready to choose in Campaign Studio. Imported contacts still need documented email consent before marketing emails can be sent. <Link href={`/dashboard/campaigns?org=${org}&create=1`}>Create a campaign →</Link></p>}{error&&<p role="alert" className="feedback-error">{error}</p>}</div></>}
 {!preview&&error&&<p role="alert" className="feedback-error">{error}</p>}</div>;
}
