import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {charisOrgId} from '@/lib/bank';
import {ProviderForm,ProviderLimitsForm} from '@/components/provider-form';
import {ProviderRouteForm,MailjetSenderConnect,BrevoSenderConnect,MonthlyEmailBudgetForm} from '@/components/provider-route-form';
import {ProviderCapacityPlanner} from '@/components/provider-capacity-planner';
import {BrevoStaffCheck} from '@/components/brevo-staff-check';

/** Single-bank provider administration. Keep the secure provider actions unchanged. */
export const dynamic='force-dynamic';

const names:Record<string,string>={resend:'Resend',mailjet:'Mailjet',brevo:'Brevo'};
const descriptions:Record<string,string>={
 resend:'Primary service for approved, opted-in marketing broadcasts from Charis.',
 mailjet:'Optional provider. Delivery reporting requires a secured webhook.',
 brevo:'Optional provider for bank-approved service messages.'
};

export default async function Providers(){
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const org=charisOrgId();if(!org)redirect('/setup-required');
 const {data:canManage,error:accessError}=await db.rpc('can_manage_senders',{p_org:org});
 if(accessError||canManage!==true)redirect('/dashboard');
 const [providersResult,routesResult,sendersResult,domainsResult,budgetResult]=await Promise.all([
  db.from('email_provider_settings').select('*').order('provider'),
  db.from('charis_email_routes').select('provider,sender_id,enabled,permission_confirmed,allowed_kind').eq('organization_id',org),
  db.from('sender_identities').select('id,from_email,from_name,is_active,domain_id').eq('organization_id',org),
  db.from('sending_domains').select('id,provider,verification_status').eq('organization_id',org),
  db.from('charis_email_monthly_budget').select('monthly_limit').eq('organization_id',org).maybeSingle()
 ]);
 const {data,error}=providersResult;
 const readErrors=[routesResult,sendersResult,domainsResult,budgetResult].filter(r=>r.error);
 const routes=routesResult.data||[];
 const senders=sendersResult.data||[];
 const domains=domainsResult.data||[];
 const choices=(provider:string)=>{
  const ids=new Set(domains.filter(d=>d.provider===provider&&d.verification_status==='verified').map(d=>d.id));
  return senders.filter(s=>s.is_active&&ids.has(s.domain_id)).map(s=>({id:s.id,email:s.from_email,name:s.from_name}));
 };
 const providers=[...(data||[])].sort((a,b)=>({resend:0,mailjet:1,brevo:2}[a.provider as 'resend'|'mailjet'|'brevo']??3)-({resend:0,mailjet:1,brevo:2}[b.provider as 'resend'|'mailjet'|'brevo']??3));
 const mailjetWebhookReady=(process.env.MAILJET_WEBHOOK_SECRET||'').length>=32;
 const resendBroadcastConfigured=process.env.CHARIS_RESEND_BROADCASTS_ENABLED==='true';
 const deliveryFlagEnabled=process.env.EMAIL_DELIVERY_ENABLED==='true';
 return <WorkspaceShell admin title="Email providers" subtitle="Control approved sender accounts, limits, and delivery settings from one place.">
  <div className="charis-provider-page">
   <section className="charis-provider-intro" aria-label="Email delivery overview">
    <div>
     <span className="charis-provider-eyebrow">CHARIS COMMUNICATIONS</span>
     <h2>One place to manage email delivery</h2>
     <p>Resend is the primary promotional provider. Other services remain optional. Staff continue to create and send approved campaigns inside Charis.</p>
    </div>
    <div className="charis-provider-intro-actions">
     <Link className="btn secondary" href={`/dashboard/senders?org=${org}`}>Manage sending addresses</Link>
     <Link className="btn secondary" href={`/dashboard/delivery?org=${org}`}>Delivery history</Link>
    </div>
   </section>
   <div className="charis-provider-state-grid" aria-label="Sending configuration">
    <div className="charis-provider-state"><span>Delivery feature</span><strong>{deliveryFlagEnabled?'Enabled':'Off'}</strong><small>This is a setting, not proof of receipt.</small></div>
    <div className="charis-provider-state"><span>Resend broadcasts</span><strong>{resendBroadcastConfigured?'Enabled':'Off'}</strong><small>Requires verified sender and approved recipients.</small></div>
    <div className="charis-provider-state"><span>Mailjet webhook secret</span><strong>{mailjetWebhookReady?'Configured':'Not configured'}</strong><small>Only needed when using Mailjet.</small></div>
   </div>
   {error||!data?<section className="panel"><p role="alert" className="feedback-error">Provider settings could not be loaded. Check the email-provider migrations or contact the system administrator.</p></section>:<>
    {readErrors.length>0&&<section className="panel"><p role="alert" className="feedback-error">Some sender or route details could not be loaded. Please refresh before changing delivery routing. Existing settings have not been changed.</p></section>}
    <div className="charis-provider-overview" aria-label="Providers">
     {providers.map(p=><a className="charis-provider-jump" key={p.provider} href={`#provider-${p.provider}`}>
      <span className="charis-provider-jump-name">{names[p.provider]||p.provider}</span>
      <span className={`charis-provider-pill ${p.enabled?'is-on':''}`}>{p.enabled?'Enabled':'Off'}</span>
      <small>{p.provider==='resend'?'Primary marketing':p.provider==='mailjet'?'Optional email':'Optional service email'}</small>
      <span className="charis-provider-jump-link">Manage provider →</span>
     </a>)}
    </div>
    <div className="charis-provider-settings" aria-label="Provider configuration">
     {providers.map(p=><section className="charis-provider-section" id={`provider-${p.provider}`} key={p.provider}>
      <div className="charis-provider-section-head">
       <div className="charis-provider-section-heading"><h2>{names[p.provider]||p.provider}</h2><span className={`charis-provider-pill ${p.enabled?'is-on':''}`}>{p.enabled?'Enabled':'Off'}</span></div>
       <p>{descriptions[p.provider]||'Optional email delivery service.'}</p>
       <small>Last connection check: {p.checked_at?new Date(p.checked_at).toLocaleString('en-NG'):'Not checked'}. Provider status: {p.health_status||'Unknown'}.</small>
      </div>
      <details className="charis-provider-disclosure" open={p.provider==='resend'}>
       <summary>{p.provider==='resend'?'Configure primary email provider':`Configure ${names[p.provider]||p.provider} (optional)`}</summary>
       <div className="charis-provider-disclosure-body">
        <div className="charis-provider-form-grid">
         <section className="charis-provider-setting"><h3>Provider access</h3><p>Turn the account on or check its API connection.</p><ProviderForm provider={p.provider} enabled={p.enabled} org={org} charis/></section>
         <section className="charis-provider-setting"><h3>Delivery limits</h3><p>Restrict the dispatch rate for this service.</p><ProviderLimitsForm provider={p.provider} daily={p.daily_limit} interval={p.minimum_interval_seconds} org={org}/></section>
        </div>
        <div className="charis-provider-setting charis-provider-routing">
         <h3>Sender &amp; message purpose</h3>
         <p>Choose only a sender authenticated for this provider. Promotional campaigns require documented opt-in.</p>
         {readErrors.length===0?<ProviderRouteForm provider={p.provider as 'resend'|'brevo'|'mailjet'} senders={choices(p.provider)} route={routes.find(r=>r.provider===p.provider)}/>:<p className="feedback-error" role="alert">Routing is unavailable until sender data loads successfully.</p>}
        </div>
        {p.provider==='mailjet'&&<>
         <details className="charis-webhook-details"><summary>Mailjet delivery webhook setup</summary>
          <div className="charis-webhook-content">
           <p>Mailjet sends bounce, unsubscribe and delivery events to this endpoint. It does not send campaigns by itself.</p>
           <div className="charis-webhook-url"><span>Endpoint URL</span><code>https://charismfbcampaign.vercel.app/api/email/webhooks/mailjet</code></div>
           <p><strong>Authentication:</strong> HTTP Basic, username <code>charis</code>, password from the private <code>MAILJET_WEBHOOK_SECRET</code> environment variable in Vercel.</p>
           <p><strong>Secret:</strong> {mailjetWebhookReady?'Configured for this deployment.':'Missing or too short. Add a secure secret of at least 32 characters, then redeploy.'}</p>
           <p className="charis-webhook-note">Configure separate event callbacks in Mailjet with grouping disabled. Never expose the authenticated URL or secret in screenshots.</p>
          </div>
         </details>
         <div className="charis-provider-setting"><h3>Connect an existing Mailjet sender</h3><MailjetSenderConnect/></div>
        </>}
        {p.provider==='brevo'&&<><div className="charis-provider-setting"><h3>Connect an existing Brevo sender</h3><BrevoSenderConnect/></div><div className="charis-provider-setting"><BrevoStaffCheck configured={Boolean(process.env.BREVO_STAFF_TEST_EMAIL)}/></div></>}
        {p.provider==='resend'&&<p className="charis-provider-note">Resend marketing uses the approved Broadcast workflow in Campaign Studio. It does not use the legacy transactional email worker.</p>}
       </div>
      </details>
     </section>)}
    </div>
   </>}
   <details className="charis-provider-finance"><summary>SendGrid connection (optional)</summary>
    <div className="charis-provider-finance-grid"><div className="charis-provider-setting"><h3>SendGrid diagnostics</h3><p>Use the existing secured domain and API checks if Charis adds SendGrid delivery later. This page does not activate broadcasts.</p><div className="actions"><Link className="btn secondary" href="/admin/sendgrid">Open SendGrid setup</Link></div></div></div>
   </details>
   <details className="charis-provider-finance"><summary>Limits &amp; capacity planning</summary>
    <div className="charis-provider-finance-grid"><div className="charis-provider-setting"><MonthlyEmailBudgetForm value={budgetResult.data?.monthly_limit||10000}/></div>{data&&<ProviderCapacityPlanner providers={data.map(p=>({provider:p.provider,enabled:p.enabled,health_status:p.health_status,daily_limit:p.daily_limit}))}/>}</div>
   </details>
  </div>
 </WorkspaceShell>;
}
