import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Mail,MessageSquareText,ClipboardCheck,Send,ArrowRight,FileCheck2,Landmark,CalendarClock} from 'lucide-react';
import {WorkspaceShell} from '@/components/workspace-shell';
import {supabaseServer} from '@/lib/supabase/server';
import {currentAccount} from '@/lib/auth/account';
export const dynamic='force-dynamic';
type RecentMessage={id:string;label:string;kind:'Email'|'SMS';status:string;updated_at:string;href:string};
function StatusLabel({status}:{status:string}){
 const display:Record<string,string>={draft:'Draft',pending_approval:'Awaiting approval',approved:'Approved',queued:'Queued',rejected:'Needs changes',sent:'Sent',archived:'Archived'};
 return <span className="status-chip">{display[status]||status.replaceAll('_',' ')}</span>;
}
export default async function Communications(){
 const account=await currentAccount();if(!account)redirect('/login');
 const canRead=account.permissions.includes('campaigns.view')||account.permissions.includes('service_notices.view')||account.permissions.includes('service_notices.create')||account.permissions.includes('service_notices.approve')||account.permissions.includes('loans.view')||account.permissions.includes('loans.manage')||account.permissions.includes('loans.repayments')||account.permissions.some(p=>p.startsWith('credit_reminders.'));
 if(!canRead)redirect('/dashboard');
 const org=account.workspace.id;
 const db=await supabaseServer();
 const hasMarketing=account.permissions.includes('campaigns.view');
 const [{data:emails,error:emailError},{data:sms,error:smsError}]=await Promise.all([
  hasMarketing?db.from('campaign_drafts').select('id,name,status,updated_at').eq('organization_id',org).order('updated_at',{ascending:false}).limit(35):Promise.resolve({data:[],error:null}),
  hasMarketing?db.from('charis_sms_campaigns').select('id,title,status,updated_at').eq('organization_id',org).order('updated_at',{ascending:false}).limit(35):Promise.resolve({data:[],error:null})
 ]);
 const recent:RecentMessage[]=[...(emails||[]).map(c=>({id:c.id,label:c.name,kind:'Email' as const,status:c.status,updated_at:c.updated_at,href:`/dashboard/campaigns?org=${org}&id=${c.id}`})),
  ...(sms||[]).map(c=>({id:c.id,label:c.title,kind:'SMS' as const,status:c.status,updated_at:c.updated_at,href:`/dashboard/sms?org=${org}`}))]
  .sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()).slice(0,40);
 const pending=recent.filter(c=>c.status==='pending_approval').length;
 const approved=recent.filter(c=>c.status==='approved').length;
 const canCreate=account.permissions.includes('campaigns.create');
 const hasService=account.permissions.some(p=>['service_notices.view','service_notices.create','service_notices.approve'].includes(p));
 const hasCredit=account.permissions.some(p=>['loans.view','loans.manage','loans.repayments'].includes(p));
 const hasReminder=account.permissions.some(p=>['credit_reminders.view','credit_reminders.create','credit_reminders.approve','credit_reminders.queue'].includes(p));
 const canApprove=account.permissions.includes('campaigns.approve');
 const canSend=account.permissions.includes('campaigns.send');
 const routes=[
  {title:'Email campaigns',icon:<Mail size={22}/>,description:'Compose branded communications with recipient selection and delivery tracking.',href:`/dashboard/campaigns?org=${org}`,allowed:hasMarketing},
  {title:'SMS communications',icon:<MessageSquareText size={22}/>,description:'Prepare short customer notices with staff approval and controlled provider settings.',href:`/dashboard/sms?org=${org}`,allowed:hasMarketing},
  {title:'Account-service notices',icon:<FileCheck2 size={22}/>,description:'Prepare and independently review customer-specific non-promotional account notices. Delivery remains disabled.',href:'/dashboard/communications/service',allowed:hasService},
  {title:'Credit repayment reminders',icon:<CalendarClock size={22}/>,description:'Select loan customers, prepare professional repayment reminders, review decisions and stage approved messages without sending.',href:'/dashboard/credit-reminders',allowed:hasReminder},
  {title:'Loan register',icon:<Landmark size={22}/>,description:'Review allocated customer loans, balances and repayment records.',href:'/dashboard/loans',allowed:hasCredit},
  {title:'Approval inbox',icon:<ClipboardCheck size={22}/>,description:'Review submitted communications under the bank’s assigned permissions.',href:`/dashboard/approvals?org=${org}`,allowed:canApprove},
  {title:'Delivery queue',icon:<Send size={22}/>,description:'Review approved email dispatch and delivery outcomes.',href:`/dashboard/delivery?org=${org}`,allowed:canSend}
 ];
 return <WorkspaceShell title="Communications" subtitle="One place to prepare, review and follow Charis customer communications." org={org}
  actions={canCreate?<Link className="btn" href={`/dashboard/campaigns?org=${org}&create=1`}>Create email campaign</Link>:undefined}>
  {hasMarketing&&<div className="audience-kpis"><div className="audience-kpi"><span>Recent email campaigns</span><strong>{emails?.length||0}</strong></div>
   <div className="audience-kpi"><span>Recent SMS records</span><strong>{sms?.length||0}</strong></div>
   <div className="audience-kpi"><span>Awaiting approval (recent)</span><strong>{pending}</strong></div><div className="audience-kpi"><span>Approved (recent)</span><strong>{approved}</strong></div></div>}
  {(emailError||smsError)&&<p role="alert" className="feedback-error">Some communications could not be loaded. Please contact an administrator.</p>}
  <div className="admin-columns">{routes.filter(r=>r.allowed).map(r=><section className="panel" key={r.title}>
   <div className="workspace-heading"><span aria-hidden="true">{r.icon}</span><h2>{r.title}</h2></div>
   <p className="muted">{r.description}</p><Link href={r.href} className="btn secondary">Open workspace <ArrowRight size={16}/></Link>
  </section>)}</div>
  {hasMarketing&&<section className="panel"><div className="workspace-heading"><h2>Recent promotional communications</h2><Link href={`/dashboard/campaigns?org=${org}`}>All email campaigns</Link></div>
   {recent.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Communication</th><th>Channel</th><th>Status</th><th>Last updated</th><th>Open</th></tr></thead><tbody>
    {recent.map(c=><tr key={`${c.kind}:${c.id}`}><td>{c.label}</td><td>{c.kind}</td><td><StatusLabel status={c.status}/></td><td>{new Date(c.updated_at).toLocaleString('en-NG')}</td><td><Link href={c.href}>View</Link></td></tr>)}
   </tbody></table></div>:<p className="muted">No communications have been created yet. Create an email campaign or SMS draft to begin.</p>}
  </section>}
  <p className="muted">Saving or approving a draft does not automatically send a message. Dispatch remains subject to bank permissions, recipient eligibility and enabled delivery configuration.</p>
 </WorkspaceShell>;
}
