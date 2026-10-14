'use client';
import Link from 'next/link';
import {useActionState,useState} from 'react';
import {ContactRowActions} from '@/components/contact-row-actions';
import {bulkContactsAction} from '@/app/dashboard/contacts/actions';

type Customer={id:string;first_name:string;last_name:string;email:string|null;phone:string|null;source:string;consent_status:string;archived_at:string|null};
export function CustomerTable({org,people}:{org:string;people:Customer[]}){
 const [selected,setSelected]=useState<string[]>([]);
 const [result,action,pending]=useActionState(bulkContactsAction,{});
 const current=people.map(c=>c.id);
 const allSelected=current.length>0&&current.every(id=>selected.includes(id));
 return <>
  <div className="charis-bulk-bar"><strong>{selected.length} selected</strong>
   <button type="button" className="btn secondary" disabled={!people.length} onClick={()=>setSelected(allSelected?[]:current)}> {allSelected?'Clear page':'Select page'} </button>
   <form action={action} onSubmit={e=>{const button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
    if(!selected.length||!window.confirm(button?.value==='delete'?`Permanently delete ${selected.length} customers? Only records with no protected campaign history can be deleted.`:`Archive ${selected.length} customers and remove them from future marketing?`))e.preventDefault();}}>
    <input type="hidden" name="organization_id" value={org}/><input type="hidden" name="contacts" value={JSON.stringify(selected)}/>
    <button className="btn secondary" name="operation" value="archive" disabled={pending||!selected.length}>Archive selected</button>
    <button className="btn secondary" name="operation" value="delete" disabled={pending||!selected.length}>Delete selected</button>
   </form>
  </div>
  {result.error&&<p role="alert" className="feedback-error">{result.error}</p>}{result.success&&<p role="status" className="feedback-success">{result.success}</p>}
  <div className="table-scroll"><table className="admin-table"><thead><tr><th scope="col">Select</th><th>Customer</th><th>Email</th><th>Phone</th><th>Source</th><th>Marketing consent</th><th>Actions</th></tr></thead><tbody>
   {people.map(c=><tr key={c.id}><td><input type="checkbox" aria-label={`Select ${c.email||c.first_name||'customer'}`} checked={selected.includes(c.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/></td><td>{[c.first_name,c.last_name].filter(Boolean).join(' ')||'Unnamed customer'}</td><td>{c.email||'—'}</td><td>{c.phone||'—'}</td><td>{c.source}</td><td><span className={`status-chip status-${c.consent_status}`}>{c.consent_status==='granted'?'Agreed':c.consent_status==='denied'?'Promotions stopped':'Not confirmed'}</span></td><td><Link href={`/dashboard/contacts?org=${org}&edit=${c.id}`}>Edit</Link><ContactRowActions org={org} id={c.id} archived={Boolean(c.archived_at)}/></td></tr>)}
  </tbody></table></div>
 </>;
}
