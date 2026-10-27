'use client';
import {useState,type ChangeEvent} from 'react';
type Loan={line:number;ref:string;name:string;email:string;phone:string;balance:number|null;due:string;issues:string[]};
const maxSize=3000000,maxRows=3000;
function parseCsv(text:string):string[][]{
 const rows:string[][]=[];let cells:string[]=[],cell='',quote=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quote){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quote=false;else cell+=c;}
  else if(c==='"'&&cell==='')quote=true;else if(c===','){cells.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;cells.push(cell);if(cells.some(v=>v.trim()))rows.push(cells);cells=[];cell='';if(rows.length>maxRows+1)throw Error('Too many rows.');}
  else cell+=c;
 }
 if(quote)throw Error('Unclosed CSV quote.');
 cells.push(cell);if(cells.some(v=>v.trim()))rows.push(cells);return rows;
}
function normalize(v:string){return v.toLowerCase().replace(/[^a-z0-9]/g,'');}
function review(data:unknown[][]):Loan[]{
 if(data.length<2||data.length>maxRows+1)throw Error('Include a heading and 1 to 3000 loans.');
 const h=data[0].map(v=>normalize(String(v??'')));
 const idx=(...names:string[])=>h.findIndex(x=>names.some(n=>normalize(n)===x));
 const ref=idx('loan_reference','loan ref','loan id','loan number','facility number');
 const name=idx('customer_name','borrower name','customer','name');
 const email=idx('email','email address'),phone=idx('phone','phone number','mobile');
 const balance=idx('outstanding','outstanding balance','balance','amount due');
 const due=idx('due_date','due on','maturity date','repayment date');
 if(ref<0||balance<0||due<0)throw Error('Required: loan_reference, outstanding, due_date.');
 const seen=new Set<string>();
 return data.slice(1).filter(r=>r.some(v=>String(v??'').trim())).map((r,i)=>{
  const at=(col:number)=>{const v=col<0?null:r[col];return v instanceof Date&&!Number.isNaN(v.getTime())?v.toISOString().slice(0,10):String(v??'').trim();};
  const key=at(ref),person=at(name),mail=at(email),tel=at(phone);
  const raw=at(balance).replace(/[₦,\s]/g,'');const val=raw?Number(raw):NaN;
  const amount=Number.isFinite(val)&&val>=0&&val<1e13?Math.round(val*100)/100:null;
  const date=at(due),validDate=/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  const issues:string[]=[];
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_/-]{2,63}$/.test(key))issues.push('Invalid reference');
  if(seen.has(key.toLowerCase()))issues.push('Duplicate in file');seen.add(key.toLowerCase());
  if(!person)issues.push('Missing customer name');
  if(amount===null)issues.push('Invalid balance');else if(amount===0)issues.push('Settled: do not remind');
  if(!validDate)issues.push('Use YYYY-MM-DD due date');
  if(!mail&&!tel)issues.push('No delivery address');
  if(mail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail))issues.push('Invalid email');
  return {line:i+2,ref:key,name:person,email:mail,phone:tel,balance:amount,due:validDate?date:'',issues};
 });
}
export function CreditMonthlyImportPreview(){
 const [items,setItems]=useState<Loan[]>([]),[error,setError]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false);
 async function load(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];setItems([]);setError('');setName('');
  if(!file)return;
  if(file.size>maxSize){setError('Maximum file size is 3 MB.');return;}
  setBusy(true);
  try{
   const ext=file.name.split('.').pop()?.toLowerCase();
   const data:unknown[][]=ext==='csv' ? parseCsv((await file.text()).replace(/^\uFEFF/,'')) : ext==='xlsx' ? (await (await import('read-excel-file/browser')).readSheet(file)) as unknown as unknown[][] : [];
   if(ext!=='csv'&&ext!=='xlsx')throw Error('Choose .csv or .xlsx');
   setItems(review(data));setName(file.name);
  }catch(err){setError(err instanceof Error?err.message:'Unable to inspect file.');}
  finally{setBusy(false);e.target.value='';}
 }
 const flagged=items.filter(x=>x.issues.length);
 return <section className="panel"><h2>Monthly Credit export</h2>
  <p className="notice">Review only: no data is written to the loan register and no borrower is contacted. Confirm amounts against core banking before an authorised import.</p>
  <label>CSV or Excel file<input type="file" accept=".csv,.xlsx" disabled={busy} onChange={load}/></label>
  <p className="muted">Columns: loan_reference, customer_name, email or phone, outstanding, due_date (YYYY-MM-DD). Up to 3000 rows / 3 MB. Exclude BVN, PIN and account secrets.</p>
  {busy&&<p role="status">Checking file…</p>}{error&&<p role="alert" className="feedback-error">{error}</p>}
  {items.length>0&&<><h3>{name}</h3>
   <p>Total: {items.length} · Ready for reconciliation: {items.length-flagged.length} · Problems: {flagged.length}</p>
   <div className="table-scroll"><table className="admin-table"><thead><tr><th>Line</th><th>Reference</th><th>Customer</th><th>Outstanding</th><th>Due</th><th>Review</th></tr></thead>
   <tbody>{items.slice(0,100).map(x=><tr key={x.line}><td>{x.line}</td><td>{x.ref}</td><td>{x.name}</td><td>{x.balance??'—'}</td><td>{x.due}</td><td>{x.issues.join('; ')||'Ready for reconciliation'}</td></tr>)}</tbody></table></div>
   <p className="muted">Showing first 100 rows. Approval and audited import will be added only after the real banking schema has been reconciled.</p>
  </>}
 </section>;
}