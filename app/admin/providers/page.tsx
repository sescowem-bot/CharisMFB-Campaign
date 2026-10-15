import Link from 'next/link';
import {ProviderCapacityPlanner} from '@/components/provider-capacity-planner';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {charisOrgId} from '@/lib/bank';
import {ProviderForm,ProviderLimitsForm} from '@/components/provider-form';
import {ProviderRouteForm,MailjetSenderConnect,BrevoSenderConnect,MonthlyEmailBudgetForm} from '@/components/provider-route-form';

/** Provider health and limits. No DNS, Domain ID or old company-registration flows in Charis. */
export default async function Providers() {
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const org=charisOrgId();if(!org)redirect('/setup-required');
 const {data:charisAdmin,error:accessError}=await db.rpc('can_manage_senders',{p_org:org});
 if(accessError||charisAdmin!==true)redirect('/dashboard');
 const [{data,error},{data:routes},{data:senders},{data:domains},{data:budget}]=await Promise.all([
  db.from('email_provider_settings').select('*').order('provider'),
  org?db.from('charis_email_routes').select('provider,sender_id,enabled,permission_confirmed,allowed_kind').eq('organization_id',org):Promise.resolve({data:[]}),
  org?db.from('sender_identities').select('id,from_email,from_name,is_active,domain_id').eq('organization_id',org):Promise.resolve({data:[]}),
  org?db.from('sending_domains').select('id,provider,verification_status').eq('organization_id',org):Promise.resolve({data:[]}),
  org?db.from('charis_email_monthly_budget').select('monthly_limit').eq('organization_id',org).maybeSingle():Promise.resolve({data:null})
 ]);
 const senderChoices=(provider:string)=>{
  const ids=new Set((domains||[]).filter(d=>d.provider===provider&&d.verification_status==='verified').map(d=>d.id));
  return (senders||[]).filter(s=>s.is_active&&ids.has(s.domain_id)).map(s=>({id:s.id,email:s.from_email,name:s.from_name}));
 };
 return <WorkspaceShell admin title="Email service health">
  <div className="charis-guide-card">API keys stay in Vercel. This page checks API connectivity and stores conservative dispatch limits. A successful connection is not approval to send marketing email or proof of a verified sender. Live campaign delivery remains gated separately.</div>
  <div className="panel"><h2>SendGrid</h2><p className="muted">Verify your new SendGrid domain and API in sandbox mode. This does not enable customer delivery or promotional campaigns.</p><Link href="/admin/sendgrid">Open SendGrid setup →</Link></div>
  {error||!data?<p role="alert" className="feedback-error">Email provider settings are unavailable. Confirm the installed migrations.</p>:<div className="admin-columns">{data.map(p=><section className="panel" key={p.provider}>
   <div className="workspace-heading"><h2>{p.provider==='resend'?'Resend':p.provider==='brevo'?'Brevo':'Mailjet'}</h2><span className={`status-chip ${p.enabled?'status-granted':''}`}>{p.enabled?'Enabled':'Disabled'}</span></div>
   <p className="muted">Connection: {p.health_status}. {p.checked_at?`Last checked ${new Date(p.checked_at).toLocaleString('en-NG')}`:'Not checked yet.'}</p>
   <p className="muted">{p.provider==='resend'?'Uses RESEND_API_KEY in Vercel.':p.provider==='brevo'?'Uses BREVO_API_KEY in Vercel. Use the API key, not the SMTP key shown on the SMTP tab.':'Uses MAILJET_API_KEY and MAILJET_SECRET_KEY in Vercel. Verify the sender inside Mailjet before testing.'}</p><ProviderForm provider={p.provider} enabled={p.enabled} org={org||''} charis/>
   <ProviderLimitsForm provider={p.provider} daily={p.daily_limit} interval={p.minimum_interval_seconds} org={org||''}/>
   {charisAdmin&&<ProviderRouteForm provider={p.provider as 'resend'|'brevo'|'mailjet'} senders={senderChoices(p.provider)} route={(routes||[]).find(r=>r.provider===p.provider)}/>}
   {charisAdmin&&p.provider==='mailjet'&&<MailjetSenderConnect/>}
   {charisAdmin&&p.provider==='brevo'&&<BrevoSenderConnect/>}
  </section>)}</div>}
 {charisAdmin&&<section className="panel"><MonthlyEmailBudgetForm value={budget?.monthly_limit||10000}/></section>}
 {data&&<ProviderCapacityPlanner providers={data.map(p=>({provider:p.provider,enabled:p.enabled,health_status:p.health_status,daily_limit:p.daily_limit}))}/>}
 </WorkspaceShell>;
}
