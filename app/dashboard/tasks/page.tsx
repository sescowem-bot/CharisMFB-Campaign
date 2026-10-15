import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ReminderCreator,ReminderStatusForm} from '@/components/reminder-forms';
export const dynamic='force-dynamic';
type Department={id:string;name:string};
export default async function StaffTasks({searchParams}:{searchParams:Promise<{org?:string;department?:string;status?:string}>}){
 const params=await searchParams;const org=z.string().uuid().safeParse(params.org);if(!org.success)redirect('/dashboard');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:administrator}=await db.rpc('can_manage_team',{p_org:org.data});
 const [deptsResult,membersResult]=await Promise.all([
  db.from('charis_departments').select('id,name').eq('organization_id',org.data).eq('active',true).order('name'),
  db.from('charis_department_members').select('department_id,user_id,department_role').eq('organization_id',org.data).limit(500)
 ]);
 const departments=(deptsResult.data||[]) as Department[];
 const ids=new Set(departments.map(d=>d.id));
 const writable=administrator?departments:departments.filter(d=>(membersResult.data||[]).some(m=>m.department_id===d.id&&m.user_id===user.id&&m.department_role!=='observer'));
 const writableIds=new Set(writable.map(d=>d.id));
 const selected=z.string().uuid().safeParse(params.department);
 const department=selected.success&&ids.has(selected.data)?selected.data:null;
 const activeStatus=['open','done','cancelled','all'].includes(params.status||'')?params.status||'open':'open';
 let query=db.from('charis_reminders').select('id,title,notes,due_at,priority,status,created_by,assigned_to,department_id').eq('organization_id',org.data).order('due_at',{ascending:true}).limit(100);
 if(department)query=query.eq('department_id',department);
 if(activeStatus!=='all')query=query.eq('status',activeStatus);
 const {data:reminders,error}=await query;
 const staff=(membersResult.data||[]).map(m=>({department_id:m.department_id,user_id:m.user_id,label:m.user_id===user.id?'Me (my account)':`Staff ${m.user_id.slice(0,8)}`}));
 if(administrator){
  const {data:team}=await db.rpc('team_members',{p_org:org.data});
  const names=new Map((Array.isArray(team)?team:[]).map(s=>[s.id,s.email]));
  staff.forEach(item=>{item.label=String(names.get(item.user_id)||item.label);});
 }
 const currentStaff=administrator?[
  ...staff,
  ...departments.filter(d=>!staff.some(s=>s.department_id===d.id&&s.user_id===user.id)).map(d=>({department_id:d.id,user_id:user.id,label:'Me (administrator)'}))
 ]:staff;
 const path=(s:string)=>`/dashboard/tasks?org=${org.data}${department?`&department=${department}`:''}&status=${s}`;
 return <WorkspaceShell org={org.data} title="Staff tasks & alerts" subtitle="Your internal work queue, assignments and deadlines. Customer loan reminders are managed separately under Credit Operations.">
  <div className="charis-task-intro"><strong>Internal tasks only</strong><p>Organise team work and due dates here. To contact a customer about a loan, use the separately approved Loan Reminders module.</p></div>
  {deptsResult.error&&<p role="alert" className="feedback-error">Department setup is unavailable. Install Migration 026.</p>}
  <div className="workspace-links">{(['open','done','all'] as const).map(s=><a className="btn secondary" key={s} aria-current={activeStatus===s?'page':undefined} href={path(s)}>{s==='open'?'To do':s==='done'?'Completed':'All tasks'}</a>)}</div>
  {error&&<p className="feedback-error" role="alert">Unable to load tasks. Please check department access.</p>}
  <div className="charis-reminder-list">{(reminders||[]).map(r=>{const overdue=r.status==='open'&&new Date(r.due_at).getTime()<Date.now();return <section className="charis-reminder-row" key={r.id}>
   <div><div className="charis-reminder-meta"><span className={`charis-priority ${r.priority}`}>{r.priority} priority</span><span>{departments.find(d=>d.id===r.department_id)?.name||'Department'}</span><span>{overdue?'Overdue':r.status==='done'?'Completed':r.status==='cancelled'?'Cancelled':'Upcoming'}</span></div>
    <h2>{r.title}</h2>{r.notes&&<p>{r.notes}</p>}<small>Due {new Date(r.due_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</small>
   </div>{writableIds.has(r.department_id)&&(administrator||r.created_by===user.id||r.assigned_to===user.id)&&<ReminderStatusForm org={org.data} id={r.id} status={r.status}/>}
  </section>;})}</div>
  {!reminders?.length&&!error&&<p className="notice">No tasks found in this view. Create one below.</p>}
  {!!writable.length&&<ReminderCreator org={org.data} departments={department?writable.filter(d=>d.id===department):writable} staff={currentStaff} currentUser={user.id}/>}
  {!writable.length&&<p className="muted">You have read-only department access. An administrator can give you editing responsibility.</p>}<p className="muted">These are staff-only tasks. They never send messages to customers. Repayment messages are prepared in Loan Reminders.</p>
 </WorkspaceShell>;
}
