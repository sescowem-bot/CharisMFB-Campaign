'use client';
import {useActionState,useMemo,useState} from 'react';
import {bulkListAction} from '@/app/dashboard/contacts/actions';
type Customer={id:string;name:string};
type Group={id:string;name:string};
export function BulkListManager({org,lists,contacts}:{org:string;lists:Group[];contacts:Customer[]}){
 const [search,setSearch]=useState('');const [chosen,setChosen]=useState<string[]>([]);
 const [state,action,pending]=useActionState(bulkListAction,{});
 const matches=useMemo(()=>contacts.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).slice(0,200),[contacts,search]);
 const all=matches.length>0&&matches.every(c=>chosen.includes(c.id));
 return <section className="panel"><h2>Manage several group members</h2><p className="muted">Select one or more customers and add or remove them together. This does not change anyone&apos;s marketing consent.</p>
  <input type="search" aria-label="Find customers to select" placeholder="Search loaded customers" value={search} onChange={e=>setSearch(e.target.value)}/>
  <div className="charis-bulk-bar"><strong>{chosen.length} selected</strong><button className="btn secondary" type="button" onClick={()=>setChosen(all?chosen.filter(id=>!matches.some(c=>c.id===id)):[...new Set([...chosen,...matches.map(c=>c.id)])])} disabled={!matches.length}>{all?'Deselect shown':'Select all shown'}</button><button className="btn secondary" type="button" onClick={()=>setChosen([])}>Clear</button></div>
  <div className="charis-checklist">{matches.map(c=><label key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} onChange={e=>setChosen(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/><span>{c.name}</span></label>)}{!matches.length&&<p className="muted">No matching customers.</p>}</div>
  <form className="admin-form" action={action}><input type="hidden" name="organization_id" value={org}/><input type="hidden" name="contacts" value={JSON.stringify(chosen)}/><label>Saved group<select name="list_id" required defaultValue=""><option value="">Choose a group</option>{lists.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label><div className="actions"><button className="btn" name="operation" value="add" disabled={pending||!chosen.length||!lists.length}>Add selected to group</button><button className="btn secondary" name="operation" value="remove" disabled={pending||!chosen.length||!lists.length}>Remove selected</button></div>{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}</form>
  {contacts.length===200&&<p className="muted">Showing the 200 most recently added customers. Importing customers into a group remains available for larger files.</p>}
 </section>;
}
