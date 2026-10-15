import Link from 'next/link';
import {redirect} from 'next/navigation';
import {WorkspaceShell} from '@/components/workspace-shell';
import {NotificationReadForm} from '@/components/charis-followup-forms';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function Notifications(){
 const account=await currentAccount();if(!account)redirect('/login');
 const db=await supabaseServer();
 const {error:dueError}=await db.rpc('charis_staff_due_alerts_043',{p_org:account.workspace.id});
 const {data,error}=await db.from('charis_staff_notifications')
  .select('id,title,body,target_path,created_at,read_at').eq('organization_id',account.workspace.id)
  .eq('recipient_id',account.id).order('created_at',{ascending:false}).limit(100);
 const rows=data||[],unread=rows.filter(n=>!n.read_at).length;
 return <WorkspaceShell title="Staff alerts" subtitle="Private in-app updates about tasks assigned to you." org={account.workspace.id}>
  <div className="audience-kpis"><div className="audience-kpi"><span>Unread in this view</span><strong>{unread}</strong></div><div className="audience-kpi"><span>Recent notifications</span><strong>{rows.length}</strong></div></div>
  {dueError&&<p className="notice">Daily task alerts are unavailable until Migration 043 is installed.</p>}
  {error&&<p className="feedback-error" role="alert">Notifications are unavailable. Confirm that Migration 033 is installed.</p>}
  <section className="panel"><h2>Inbox</h2>{!error&&!rows.length&&<p className="muted">No notifications yet. Assigned Credit follow-ups will appear here.</p>}
   <div className="charis-reminder-list">{rows.map(n=><div className="charis-reminder-row" key={n.id}><div>
    <h3>{n.title}{!n.read_at&&<span className="status-chip" style={{marginLeft:8}}>New</span>}</h3><p>{n.body}</p>
    <small>{new Date(n.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</small>
    <p><Link className="inline-link" href={n.target_path==='/dashboard/tasks'?'/dashboard/tasks?org='+encodeURIComponent(account.workspace.id):'/dashboard/credit-followups'}>Open related work</Link></p></div>
    {!n.read_at&&<NotificationReadForm id={n.id}/>}</div>)}</div>
  </section>
 </WorkspaceShell>;
}
