import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {DepartmentAssignmentForm} from '@/components/department-assignment-form';
import {CreateDepartmentForm,EditDepartmentForm} from '@/components/department-management-form';
export const dynamic='force-dynamic';
type Department={id:string;name:string;slug:string;description:string;active:boolean};
export default async function DepartmentWorkspaces({searchParams}:{searchParams:Promise<{org?:string}>}){
 const params=await searchParams;const org=z.string().uuid().parse(process.env.SINGLE_COMPANY_ORG_ID);
 if(params.org&&params.org!==org)redirect('/dashboard');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const [{data:canManage},{data:departments,error}]=await Promise.all([
  db.rpc('charis_has_permission',{p_org:org,p_key:'departments.manage'}),
  db.from('charis_departments').select('id,slug,name,description,active').eq('organization_id',org).order('name')
 ]);
 const administrator=canManage===true;
 const visible=(departments||[]).filter(d=>d.active) as Department[];
 const archived=(departments||[]).filter(d=>!d.active) as Department[];
 const [members,staffResult]=administrator?await Promise.all([
  db.from('charis_department_members').select('department_id,user_id,department_role').eq('organization_id',org).limit(500),
  db.rpc('charis_access_staff_list',{p_org:org})
 ]):[{data:[],error:null},{data:[],error:null}];
 const staff=((Array.isArray(staffResult.data)?staffResult.data:[]) as unknown[]).filter((s):s is {id:string;email:string;base_role:string}=>{
  if(!s||typeof s!=='object')return false;const a=s as Record<string,unknown>;return typeof a.id==='string'&&typeof a.email==='string'&&typeof a.base_role==='string';
 });
 const people=new Map(staff.map(s=>[s.id,s.email]));
 return <WorkspaceShell title="Departments" org={org} subtitle="Workspaces and responsibilities configured by your bank.">
  {error&&<p className="feedback-error" role="alert">Departments are unavailable. Contact the system administrator.</p>}
  {administrator&&<><CreateDepartmentForm/><div className="actions"><Link className="btn secondary" href="/admin/access">Roles & permissions</Link></div></>}
  <div className="charis-dept-grid">{visible.map(d=>{const deptMembers=(members.data||[]).filter(m=>m.department_id===d.id);
   return <section className="charis-dept-card" key={d.id}><span className="charis-dept-eyebrow">Department</span><h2>{d.name}</h2>{d.description&&<p>{d.description}</p>}<div className="actions"><Link className="btn secondary" href={`/dashboard/reminders?org=${encodeURIComponent(org)}&department=${d.id}`}>Open workspace</Link></div>
    {administrator&&<><details><summary>Staff ({deptMembers.length})</summary><div className="charis-member-list">{deptMembers.map(m=><p key={m.user_id}>{people.get(m.user_id)||'Staff'} · {m.department_role}</p>)}{!deptMembers.length&&<p>No staff assigned.</p>}</div></details><details><summary>Edit department</summary><EditDepartmentForm department={d}/></details></>}
   </section>;})}</div>
  {!visible.length&&!error&&<section className="panel"><h2>No departments available</h2><p>{administrator?'Create the first department above.':'Ask your administrator to assign a department to your account.'}</p></section>}
  {administrator&&<>{archived.length>0&&<section className="panel"><h2>Archived departments</h2>{archived.map(d=><details key={d.id}><summary>{d.name}</summary><EditDepartmentForm department={d}/></details>)}</section>}<DepartmentAssignmentForm org={org} departments={visible.map(d=>({id:d.id,name:d.name}))} staff={staff.map(s=>({id:s.id,email:s.email,role:s.base_role}))}/></>}
 </WorkspaceShell>;
}
