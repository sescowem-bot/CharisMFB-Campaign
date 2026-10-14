import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {DepartmentAssignmentForm} from '@/components/department-assignment-form';
import {departmentProfiles} from '@/lib/charis-departments';
export const dynamic='force-dynamic';
type Department={id:string;name:string;slug:string;description:string};
export default async function DepartmentWorkspaces({searchParams}:{searchParams:Promise<{org?:string}>}){
 const params=await searchParams;const parsed=z.string().uuid().safeParse(params.org);
 if(!parsed.success)redirect('/dashboard');const org=parsed.data;
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:administrator}=await db.rpc('can_manage_team',{p_org:org});
 const {data:departments,error}=await db.from('charis_departments').select('id,slug,name,description').eq('organization_id',org).eq('active',true).order('name');
 const visible=(departments||[]) as Department[];
 const [members,staffResult]=administrator?await Promise.all([
  db.from('charis_department_members').select('department_id,user_id,department_role').eq('organization_id',org).limit(500),
  db.rpc('team_members',{p_org:org})
 ]):[{data:[],error:null},{data:[],error:null}];
 const staff=((Array.isArray(staffResult.data)?staffResult.data:[]) as unknown[]).filter((s):s is {id:string;email:string;role:string}=>{if(!s||typeof s!=='object')return false;const a=s as Record<string,unknown>;return typeof a.id==='string'&&typeof a.email==='string'&&typeof a.role==='string';});
 const people=new Map(staff.map(s=>[s.id,s.email]));
 return <WorkspaceShell title="Departments & workspaces" org={org} subtitle="Each team sees its authorised workspace. Staff access is assigned by the Charis administrator.">
  {error&&<p className="feedback-error" role="alert">Department access is not ready. Apply Migration 026 after the existing migrations.</p>}
  <div className="charis-dept-grid">{visible.map(d=>{const profile=departmentProfiles.find(p=>p.slug===d.slug);const deptMembers=(members.data||[]).filter(m=>m.department_id===d.id);
    return <section className="charis-dept-card" key={d.id}><div className="charis-dept-eyebrow">Charis department</div><h2>{d.name}</h2><div className="charis-dept-role">{profile?.role||'Team member'}</div><p>{d.description||profile?.purpose}</p>{profile?.plannedActions&&<p><strong>Planned responsibilities:</strong> {profile.plannedActions}</p>}<div className="actions"><Link className="btn secondary" href={`/dashboard/reminders?org=${encodeURIComponent(org)}&department=${d.id}`}>Open reminders →</Link></div>
    {administrator&&<details><summary>Assigned staff ({deptMembers.length})</summary><div className="charis-member-list">{deptMembers.map(m=><p key={m.user_id}>{people.get(m.user_id)||'Staff ID: '+m.user_id.slice(0,8)} · {m.department_role}</p>)}{!deptMembers.length&&<p>No staff assigned yet.</p>}</div></details>}
   </section>;})}</div>
  {!visible.length&&!error&&<p className="notice">No department is assigned to your account. Ask the Charis system administrator to grant access.</p>}
  {administrator&&<DepartmentAssignmentForm org={org} departments={visible.map(d=>({id:d.id,name:d.name}))} staff={staff}/>}
  <div className="notice">Department membership is separate from campaign permissions. Existing company-wide customer and campaign views still need additional department-scoping before branch-restricted data can be used in production.</div>
 </WorkspaceShell>;
}
