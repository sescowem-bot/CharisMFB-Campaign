'use client';
import {useCallback,useEffect,useState} from 'react';

type Contact={id:string;first_name:string;last_name:string;email:string};
export function RecipientPicker({org,selected,onChange}:{org:string;selected:Contact[];onChange:(people:Contact[])=>void}){
 const [query,setQuery]=useState('');const [page,setPage]=useState(1);
 const [results,setResults]=useState<Contact[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const find=useCallback(async (q:string,p:number)=>{
  setBusy(true);setError('');
  try{const response=await fetch(`/api/contacts/search?org=${encodeURIComponent(org)}&q=${encodeURIComponent(q)}&page=${p}`,{cache:'no-store'});
   const json=await response.json();if(!response.ok)throw new Error(json.error||'Search failed');
   setResults(json.contacts||[]);
  }catch(e){setError(e instanceof Error?e.message:'Unable to search recipients');setResults([]);}finally{setBusy(false);}
 },[org]);
 useEffect(()=>{void find('',1);},[find]);
 const selectedIds=new Set(selected.map(c=>c.id));
 const add=(people:Contact[])=>{const next=new Map(selected.map(c=>[c.id,c]));for(const p of people){if(next.size>=500)break;next.set(p.id,p);}onChange([...next.values()]);};
 return <section className="recipient-picker" aria-label="Choose individual recipients">
  <div className="recipient-picker-heading"><div><h3>Choose customers</h3><p className="muted">Select one, several, or everyone in the search results. Maximum 500 selected contacts per campaign.</p></div><strong className="recipient-count">{selected.length} selected</strong></div>
  <form className="recipient-search-row" onSubmit={e=>{e.preventDefault();setPage(1);void find(query,1);}}><label className="sr-only" htmlFor="recipient-query">Search contact by name, email or phone</label><input id="recipient-query" value={query} maxLength={80} placeholder="Search name, email or phone" onChange={e=>setQuery(e.target.value)}/><button type="submit" className="btn secondary" disabled={busy}>{busy?'Searching…':'Search'}</button></form>
  <div className="recipient-picker-actions"><button type="button" className="btn secondary" disabled={selected.length===500||!results.length} onClick={()=>add(results)}>Select all shown</button><button type="button" className="btn secondary" disabled={!selected.length} onClick={()=>onChange([])}>Clear selection</button><small>Only eligible opted-in email contacts appear.</small></div>
  {error&&<p role="alert" className="feedback-error">{error}</p>}
  <div className="recipient-results" aria-live="polite">{results.map(person=><label className="recipient-result" key={person.id}><input type="checkbox" checked={selectedIds.has(person.id)} disabled={!selectedIds.has(person.id)&&selected.length>=500} onChange={e=>onChange(e.target.checked?[...selected,person]:selected.filter(c=>c.id!==person.id))}/><span><strong>{[person.first_name,person.last_name].filter(Boolean).join(' ')||'Customer'}</strong><small>{person.email}</small></span></label>)}{!busy&&!error&&results.length===0&&<p className="muted">No eligible customers found. Add a consenting contact or choose a different search.</p>}</div>
  <div className="recipient-search-row"><button type="button" className="btn secondary" disabled={busy||page===1} onClick={()=>{setPage(page-1);void find(query,page-1);}}>Previous</button><span>Page {page}</span><button type="button" className="btn secondary" disabled={busy||results.length<30||page>=100} onClick={()=>{setPage(page+1);void find(query,page+1);}}>Next</button></div>
  {selected.length>0&&<details className="recipient-chosen"><summary>Review {selected.length} selected recipient{selected.length===1?'':'s'}</summary><div className="recipient-chip-list">{selected.map(person=><button type="button" key={person.id} className="recipient-chip" title="Remove from selection" onClick={()=>onChange(selected.filter(c=>c.id!==person.id))}>{person.first_name||person.email} ×</button>)}</div></details>}
 </section>;
}
