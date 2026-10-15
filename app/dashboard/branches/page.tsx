import {redirect} from 'next/navigation';
import Link from 'next/link';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {BranchForm,StaffScopeForm,CustomerLocationForm,type BankBranch} from '@/components/charis-branch-forms';
export const dynamic='force-dynamic';
export default async function Branches({searchParams}:{searchParams:Promise<{customer?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id;
 const {customer=''}=await searchParams;
 const customerSearch=customer.trim().replace(/[^a-zA-Z0-9 @.+-]/g,'').slice(0,60);
 const canManage=account.permissions.includes('branches.manage')||account.permissions.includes('departments.manage');
 const canAssign=account.permissions.includes('access.manage');
 const canAllocate=account.permissions.includes('customers.manage')&&(account.permissions.includes('customers.assign')||canManage);
 const db=await supabaseServer();
 let customerQuery=db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).is('archived_at',null);
 if(customerSearch)customerQuery=customerQuery.or(`first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`);
 const [{data:branches,error},{data:assigned},{data:scopes},{data:staff},{data:departments},{data:customers}]=await Promise.all([
  db.from('charis_branches').select('id,name,code,description,active').eq('organization_id',org).order('name'),
  db.from('charis_staff_branch_assignments').select('user_id,branch_id').eq('organization_id',org),
  canAssign?db.from('charis_staff_scope_settings').select('user_id,bank_wide').eq('organization_id',org):Promise.resolve({data:[]}),
  canAssign?db.rpc('charis_access_staff_list',{p_org:org}):Promise.resolve({data:[]}),
  canAllocate?db.from('charis_departments').select('id,name').eq('organization_id',org).eq('active',true):Promise.resolve({data:[]}),
  canAllocate?customerQuery.order('created_at',{ascending:false}).limit(50):Promise.resolve({data:[]})
 ]);
 const list=(branches||[]) as BankBranch[];
 const people=(Array.isArray(staff)?staff:[]) as {id:string;email:string;base_role:string}[];
 const customerOptions=(customers||[]).map(c=>({id:c.id,name:[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Unnamed customer'}));
 return <WorkspaceShell title="Branches & data access" subtitle="Manage real bank branches, staff visibility and customer responsibility." org={org}>
  {error&&<p role="alert" className="feedback-error">Branch information is unavailable. Apply migration 029.</p>}
  <div className="admin-columns">{list.map(b=><section className="panel" key={b.id}><h2>{b.name}</h2><p className="muted">{b.code} · {b.active?'Active':'Archived'}</p>{b.description&&<p>{b.description}</p>}
   <p className="muted">{canAssign?`${(assigned||[]).filter(a=>a.branch_id===b.id).length} staff assignments`: 'Staff assignments managed by an administrator'}</p>
   {canManage&&<details><summary>Edit branch</summary><BranchForm branch={b}/></details>}
  </section>)}</div>
  {!list.length&&!error&&<section className="panel"><h2>No branches created</h2><p>Administrators can add branches below. No branches are hardcoded.</p></section>}
  {canManage&&<section className="panel"><h2>Create a branch</h2><BranchForm/></section>}
  {canAssign&&<StaffScopeForm branches={list} staff={people} scope={scopes||[]}/>}
  {canAllocate&&<><section className="panel"><h2>Find a customer to allocate</h2><p className="muted">Search any existing customer by name, email or phone. The most recent 50 matches are shown in the allocation list below.</p><form method="get" className="audience-search"><label>Customer search<input name="customer" defaultValue={customerSearch} placeholder="Search customer records" maxLength={60}/></label><button className="btn secondary" type="submit">Find customer</button></form></section><CustomerLocationForm branches={list} departments={departments||[]} customers={customerOptions}/></>}
  <p className="muted"><Link href="/dashboard/customers">View authorised customer workspace</Link></p>
 </WorkspaceShell>;
}
