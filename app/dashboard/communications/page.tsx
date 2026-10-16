import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Mail,MessageSquare,Send,Settings2} from 'lucide-react';
import {WorkspaceShell} from '@/components/workspace-shell';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
import {DirectApprovalForm} from '@/components/direct-approval-form';
export const dynamic='force-dynamic';
export const maxDuration=120;
const names:Record<string,string>={queued:'Queued',pending_approval:'Awaiting approval',sending:'Processing',completed:'Processed',paused:'Needs review',cancelled:'Cancelled'};
export default async function Communications(){
 const account=await currentAccount();if(!account)redirect('/login');const org=account.workspace.id,db=await supabaseServer();
 const [{data:canSend},{data:isAdmin},{data:messages,error},{data:settings}]=await Promise.all([
  db.rpc('charis_direct_can_send',{p_org:org}),db.rpc('charis_direct_is_admin',{p_org:org}),
  db.from('charis_direct_messages').select('id,title,subject,channel,purpose,status,recipient_count,created_by,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(50),
  db.from('charis_direct_settings').select('approval_required').eq('organization_id',org).maybeSingle()
 ]);
 const canApprove=account.permissions.includes('campaigns.approve')||isAdmin===true;
 return <WorkspaceShell title="Communications" subtitle="Write a bank message, select customers and send. Your delivery history is here." actions={canSend?<Link href="/dashboard/communications/new" className="btn"><Send size={16}/> New message</Link>:undefined}>
  <section className="direct-welcome panel"><div><h2>Make customer communication simple.</h2><p className="muted">No compulsory review queue. Staff send with their assigned access; the bank controls providers and optional approvals in Settings.</p></div>
   {canSend&&<Link href="/dashboard/communications/new" className="btn">Compose a message →</Link>}</section>
  <div className="direct-quicklinks"><Link href="/dashboard/communications/new"><Mail size={19}/> Email or SMS</Link>{isAdmin&&<Link href="/admin/communications"><Settings2 size={19}/> Communication settings</Link>}
   {account.permissions.includes('templates.manage')&&<Link href={`/dashboard/templates?org=${org}`}>Design templates</Link>}
  </div>
  {settings?.approval_required&&<p className="notice">The bank currently requires message approval. An authorised administrator can turn it off in Communication settings.</p>}
  <section className="panel"><h2>Message history</h2>{error&&<p role="alert" className="feedback-error">Direct message history is unavailable. Confirm SQL 047 is installed.</p>}
  {messages?.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Message</th><th>Channel</th><th>Recipients</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>
   {messages.map(m=><tr key={m.id}><td><strong>{m.title}</strong><small style={{display:'block'}}>{m.subject}</small></td><td>{m.channel==='email'?<Mail size={17}/>:<MessageSquare size={17}/>}</td><td>{m.recipient_count}</td><td><span className="status-chip">{names[m.status]||m.status}</span></td><td>{new Date(m.created_at).toLocaleString('en-NG')}</td><td>{m.status==='pending_approval'&&canApprove&&m.created_by!==account.id?<DirectApprovalForm id={m.id}/>:<Link href={`/dashboard/communications/history?id=${m.id}`}>Details</Link>}</td></tr>)}
  </tbody></table></div>:!error&&<p className="muted">No direct messages yet. Select New message to begin.</p>}</section>
  <details className="panel"><summary>Older campaign tools</summary><p className="muted">Existing promotional campaigns, draft designs, approval history and legacy queue records remain available during the upgrade.</p>
   <div className="actions"><Link className="btn secondary" href={`/dashboard/campaigns?org=${org}`}>Legacy Campaign Studio</Link><Link className="btn secondary" href={`/dashboard/delivery?org=${org}`}>Legacy queue</Link><Link className="btn secondary" href={`/dashboard/approvals?org=${org}`}>Legacy approvals</Link>{account.permissions.includes('service_notices.view')&&<Link className="btn secondary" href="/dashboard/communications/service">Account service notices</Link>}{account.permissions.includes('campaigns.view')&&<Link className="btn secondary" href={`/dashboard/sms?org=${org}`}>SMS communications (legacy)</Link>}</div></details>
 </WorkspaceShell>;
}
