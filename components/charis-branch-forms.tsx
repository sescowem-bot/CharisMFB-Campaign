'use client';
import {useActionState,useState} from 'react';
import {saveBranch,setStaffScope,setCustomerLocation} from '@/app/dashboard/branches/actions';
export type BankBranch={id:string;name:string;code:string;description:string;active:boolean};
export function BranchForm({branch}:{branch?:BankBranch}){
 const [state,action,pending]=useActionState(saveBranch,{});
 return <form action={action} className="admin-form">
  <input type="hidden" name="id" value={branch?.id||''}/>
  <label>Branch name<input required name="name" minLength={2} maxLength={100} defaultValue={branch?.name||''} placeholder="Branch name"/></label>
  <label>Branch code<input required name="code" minLength={2} maxLength={20} defaultValue={branch?.code||''} placeholder="Internal code"/></label>
  <label>Description<textarea name="description" maxLength={300} defaultValue={branch?.description||''}/></label>
  {branch&&<label>Status<select name="active" defaultValue={branch.active?'yes':'no'}><option value="yes">Active</option><option value="no">Archived</option></select></label>}
  <button className="btn" disabled={pending}>{pending?'Saving…':branch?'Save branch':'Create branch'}</button>
  {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
 </form>;
}
export function StaffScopeForm({branches,staff,scope}:{branches:BankBranch[];staff:{id:string;email:string;base_role:string}[];scope:{user_id:string;bank_wide:boolean}[]}){
 const [state,action,pending]=useActionState(setStaffScope,{});
 const [selectedStaff,setSelectedStaff]=useState('');
 const initialWide=(id:string)=>scope.find(x=>x.user_id===id)?.bank_wide===true;
 const [bankWide,setBankWide]=useState(false);
 return <section className="panel"><h2>Staff customer data access</h2><p className="muted">Choose a staff member to review their current visibility. Assign only the bank branches they need. New staff receive no bank-wide access by default.</p>
  <form className="admin-form" action={action}>
   <label>Staff member<select name="staff" required value={selectedStaff} onChange={e=>{setSelectedStaff(e.target.value);setBankWide(initialWide(e.target.value));}}><option value="" disabled>Select staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.email} · {s.base_role}{initialWide(s.id)?' · Bank-wide':''}</option>)}</select></label>
   <label>Customer data visibility<select name="bank_wide" value={bankWide?'yes':'no'} onChange={e=>setBankWide(e.target.value==='yes')}><option value="no">Selected branches only</option><option value="yes">Bank-wide access</option></select></label>
   <label>Branch (optional when bank-wide)<select name="branch"><option value="">No branch change</option>{branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select></label>
   <label>Branch assignment<select name="assign"><option value="yes">Allow selected branch</option><option value="no">Remove selected branch</option></select></label>
   <button className="btn" disabled={pending||!selectedStaff}>{pending?'Saving…':'Update staff access'}</button>
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  </form><p className="muted">Changing bank-wide visibility may affect which customer records this staff member can access.</p></section>;
}
export function CustomerLocationForm({branches,departments,customers}:{branches:BankBranch[];departments:{id:string;name:string}[];customers:{id:string;name:string}[]}){
 const [state,action,pending]=useActionState(setCustomerLocation,{});
 return <section className="panel"><h2>Assign customer responsibility</h2><p className="muted">Only bank-wide customer administrators can allocate a customer to a branch. A staff member with selected-branch access sees only allocated customers belonging to their branches.</p>
  <form action={action} className="admin-form">
   <label>Customer<select name="contact" required defaultValue=""><option value="" disabled>Select a customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Branch<select name="branch" required defaultValue=""><option value="" disabled>Select a branch</option>{branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label>Department<select name="department"><option value="">Not assigned</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <button disabled={pending||!customers.length||!branches.some(b=>b.active)} className="btn">{pending?'Saving…':'Assign customer'}</button>
   {state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p role="status" className="feedback-success">{state.success}</p>}
  </form></section>;
}
