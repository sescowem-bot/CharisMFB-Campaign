import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
export default async function Audit(){
 const org=z.string().uuid().safeParse(process.env.SINGLE_COMPANY_ORG_ID);if(!org.success)redirect('/setup-required');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:permitted}=await db.rpc('charis_has_permission',{p_org:org.data,p_key:'audit.view'});if(!permitted)redirect('/dashboard');
 const {data,error}=await db.from('audit_logs').select('id,actor_id,action,entity_type,entity_id,created_at').eq('organization_id',org.data).order('id',{ascending:false}).limit(100);
 return <WorkspaceShell title="Audit activity" org={org.data} admin subtitle="Recent changes and communication operations.">
  {error?<p role="alert" className="feedback-error">Audit history is temporarily unavailable.</p>:
  <div className="table-scroll"><table className="admin-table"><thead><tr><th>Time</th><th>Action</th><th>Performed by</th><th>Record type</th></tr></thead><tbody>{(data||[]).map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString('en-NG')}</td><td>{e.action.replaceAll('_',' ')}</td><td>{e.actor_id?.slice(0,8)||'System'}</td><td>{e.entity_type}</td></tr>)}</tbody></table>{!data?.length&&<p>No recent changes.</p>}</div>}
 </WorkspaceShell>;
}
