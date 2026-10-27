import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {charisOrgId} from '@/lib/bank';
import {ProviderForm,ProviderLimitsForm} from '@/components/provider-form';
import {ProviderRouteForm,MailjetSenderConnect,BrevoSenderConnect,MonthlyEmailBudgetForm} from '@/components/provider-route-form';
import {ProviderCapacityPlanner} from '@/components/provider-capacity-planner';
import {DirectProviderForm} from '@/components/direct-admin-forms';
import {BrevoStaffCheck} from '@/components/brevo-staff-check';
import {providerHubState} from '@/lib/email/provider-hub-status';

export const dynamic='force-dynamic';

type Provider='resend'|'brevo'|'mailjet';
const order:Provider[]=['resend','brevo','mailjet'];
const info:Record<Provider,{title:string,description:string}>={
 resend:{title:'Resend',description:'Email delivery and approved promotional campaigns'},
 brevo:{title:'Brevo',description:'Bank service messages and notices'},
 mailjet:{title:'Mailjet',description:'An additional email delivery option'}
};

export default async function Providers(){
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const org=charisOrgId();if(!org)redirect('/setup-required');
 const {data:canManage,error:accessError}=await db.rpc('can_manage_senders',{p_org:org});
 if(accessError||canManage!==true)redirect('/dashboard');

 const [settings,routes,senders,domains,monthly,directPrefs,directAccess]=await Promise.all([
  db.from('email_provider_settings').select('*'),
  db.from('charis_email_routes').select('provider,sender_id,enabled,permission_confirmed,allowed_kind').eq('organization_id',org),
  db.from('sender_identities').select('id,from_email,from_name,is_active,domain_id').eq('organization_id',org),
  db.from('sending_domains').select('id,provider,verification_status,charis_connected').eq('organization_id',org),
  db.from('charis_email_monthly_budget').select('monthly_limit').eq('organization_id',org).maybeSingle(),
  db.from('charis_direct_provider_prefs').select('provider,sender_id,enabled,priority').eq('organization_id',org),
  db.rpc('charis_direct_is_admin',{p_org:org})
 ]);
 const providerRows=settings.data||[];
 const domainMap=new Map((domains.data||[]).map(d=>[d.id,d]));
 const approved=(provider:Provider)=>(senders.data||[]).filter(s=>{
  const d=domainMap.get(s.domain_id);
  return s.is_active&&d?.provider===provider&&d?.verification_status==='verified'&&d?.charis_connected===true;
 }).map(s=>({id:s.id,name:s.from_name,email:s.from_email}));
 const allVerified=(provider:Provider)=>(senders.data||[]).filter(s=>{
  const d=domainMap.get(s.domain_id);return s.is_active&&d?.provider===provider&&d.verification_status==='verified';
 }).map(s=>({id:s.id,name:s.from_name,email:s.from_email}));
 const canSetService=directAccess.error===null&&directAccess.data===true&&!directPrefs.error;
 const deliveryEnabled=process.env.EMAIL_DELIVERY_ENABLED==='true';
 const providerHasApi=(provider:Provider)=>Boolean(process.env[provider==='resend'?'RESEND_API_KEY':provider==='brevo'?'BREVO_API_KEY':'MAILJET_API_KEY']);
 const flaggedSender=(senders.data||[]).filter(s=>s.is_active&&s.from_email.toLowerCase().endsWith('@salemmedicals.com'));
 return <WorkspaceShell admin title="Email providers" subtitle="Manage all four email services in one place.">
  <main className="charis-provider-page charis-provider-hub">
   <section className="charis-provider-intro">
    <div>
     <span className="charis-provider-eyebrow">EMAIL SERVICES</span>
     <h2>Choose a provider. Connect a sender. Start sending.</h2>
     <p>All email services are listed below. A verified sender must be connected to Charis before it can be used for customer campaigns.</p>
    </div>
    <div className="charis-provider-intro-actions">
     <Link className="btn secondary" href={"/dashboard/senders?org="+org}>Manage sending addresses</Link>
     <Link className="btn secondary" href="/dashboard/zoho-smtp">Staff mailbox setup &amp; test</Link>
     <Link className="btn secondary" href="/admin/communications">Staff &amp; sending rules</Link>
    </div>
   </section>
   {flaggedSender.length>0&&<div className="charis-provider-domain-warning" role="note">
    <strong>Check the bank sender address</strong>
    <p>A verified sender currently uses the Salem Medicals domain. Provider verification does not make that address a suitable Charis bank identity. Use an address authorised for Charis communications before sending.</p>
   </div>}
   {(settings.error||senders.error||domains.error||directPrefs.error)&&<div className="feedback-error" role="alert">Some sender settings could not be loaded. The existing sending setup has not been changed.</div>}
   <section className="charis-provider-help" aria-label="How to set up email">
    <div><strong>1. Verify sender</strong><span>Authenticate your email address with the provider.</span></div>
    <div><strong>2. Connect to Charis</strong><span>Select the sender for approved bank service emails.</span></div>
    <div><strong>3. Check status</strong><span>Only verified, enabled services are used for delivery.</span></div>
   </section>
   <section className="charis-provider-main-grid" aria-label="Email services">
    {order.map(provider=>{
     const row=providerRows.find(x=>x.provider===provider);
     const verified=allVerified(provider),available=approved(provider);
     const current=(directPrefs.data||[]).find(x=>x.provider===provider);
     const selected=available.find(x=>x.id===current?.sender_id);
     const {ready,senderSelected,domainNeedsReview,label:status}=providerHubState({
      providerEnabled:Boolean(row?.enabled),directEnabled:Boolean(current?.enabled),
      selectedSenderEmail:selected?.email,approvedSenderCount:available.length,
      externallyVerifiedCount:verified.length,deliveryEnabled,apiConfigured:providerHasApi(provider)
     });
     return <article key={provider} id={'provider-'+provider} className="charis-provider-main-card">
      <header><div><h2>{info[provider].title}</h2><p>{info[provider].description}</p></div>
       <span className={'charis-provider-status'+(ready?' is-ready':'')}>{ready?'Configured':domainNeedsReview?'Review sender':senderSelected?'Sender selected':'Needs setup'}</span>
      </header>
      <p className="charis-provider-main-status">{status}</p>
      {selected&&<p className="charis-provider-active-sender">Selected sender: <strong>{selected.email}</strong></p>}
      {available.length>0&&canSetService&&<div className="charis-provider-primary-action"><DirectProviderForm key={provider+'-'+current?.sender_id} provider={provider} senders={available} current={current}/></div>}
      {available.length===0&&<div className="charis-provider-guidance">
       <p>{verified.length?'A sender is verified with the provider, but it has not been connected to Charis yet.':'Connect a verified sender to use this provider for campaigns.'}</p>
       {provider==='brevo'&&<details><summary>Connect Brevo sender</summary><BrevoSenderConnect/></details>}
       {provider==='mailjet'&&<details><summary>Connect Mailjet sender</summary><MailjetSenderConnect/></details>}
       {provider==='resend'&&<Link className="btn secondary" href={"/dashboard/senders?org="+org}>Manage Resend sender</Link>}
      </div>}
      {available.length>0&&!canSetService&&<p className="muted">Ask a Charis communication administrator to choose the sending address.</p>}
      <details className="charis-provider-advanced">
       <summary>Advanced settings</summary>
       <div className="charis-provider-advanced-body">
        {row?<><ProviderForm provider={provider} enabled={row.enabled} org={org} charis/>
         <ProviderLimitsForm provider={provider} daily={row.daily_limit} interval={row.minimum_interval_seconds} org={org}/></>:<p role="status">Provider access record is unavailable. Contact your administrator.</p>}
        <div>
         <h3>Advanced message routing</h3>
         <p className="muted">For administrators using separately authorised promotional or service workflows. This does not control the normal Create Campaign sender.</p>
         {!routes.error&&!senders.error&&!domains.error?<ProviderRouteForm provider={provider} senders={verified} route={(routes.data||[]).find(r=>r.provider===provider)}/>:<p className="feedback-error">Routing records could not be loaded.</p>}
        </div>
        {provider==='brevo'&&available.length>0&&<details><summary>Connect another Brevo sender</summary><BrevoSenderConnect/></details>}
        {provider==='mailjet'&&available.length>0&&<details><summary>Connect another Mailjet sender</summary><MailjetSenderConnect/></details>}
        {provider==='brevo'&&<details><summary>Optional administrator sender check</summary><BrevoStaffCheck configured={Boolean(process.env.BREVO_STAFF_TEST_EMAIL)}/></details>}
        {provider==='mailjet'&&<details className="charis-webhook-details"><summary>Mailjet delivery webhook details</summary>
         <div className="charis-webhook-content">
          <p>Mailjet uses a secure webhook to report delivery, bounces and opt-outs. Configure this only when enabling Mailjet.</p>
          <div className="charis-webhook-url"><span>Webhook address</span><code>https://charismfbcampaign.vercel.app/api/email/webhooks/mailjet</code></div>
          <p>Authentication: HTTP Basic with username <code>charis</code> and the password stored as <code>MAILJET_WEBHOOK_SECRET</code> in Vercel.</p>
          <p>{(process.env.MAILJET_WEBHOOK_SECRET||'').length>=32?'Webhook secret is configured.':'Webhook secret needs configuration by an administrator.'}</p>
         </div>
        </details>}
       </div>
      </details>
     </article>;
    })}
    <article id="provider-zeptomail" className="charis-provider-main-card">
     <header><div><h2>ZeptoMail</h2><p>Customer-specific transactional notices</p></div>
      <span className="charis-provider-status is-setup">{process.env.ZEPTOMAIL_FROM_EMAIL&&process.env.ZEPTOMAIL_SMTP_PASSWORD?'Credentials present':'Setup required'}</span></header>
     <p className="charis-provider-main-status">Transactional only — not general bulk campaigns</p>
     <p className="charis-provider-guidance">Use ZeptoMail&apos;s separate Mail Agent credentials for account-related notifications, loan repayment reminders and receipts. Test before enabling customer sending.</p>
     <Link href="/dashboard/zeptomail" className="btn secondary">Configure &amp; test ZeptoMail</Link>
    </article>

   </section>
   <details className="charis-provider-finance">
    <summary>Advanced: limits, capacity and delivery controls</summary>
    <div className="charis-provider-finance-grid">
     <div className="charis-provider-setting">{monthly.error?<p role="alert" className="feedback-error">Monthly budget settings are currently unavailable.</p>:<MonthlyEmailBudgetForm value={monthly.data?.monthly_limit||10000}/>}</div>
     {settings.data&&<ProviderCapacityPlanner providers={providerRows.map(p=>({provider:p.provider,enabled:p.enabled,health_status:p.health_status,daily_limit:p.daily_limit}))}/>}
    </div>
   </details>
   <p className="charis-provider-footer-note">“Configured” means Charis has an enabled provider and verified selected sender. It does not guarantee inbox delivery. You can review delivery progress from <Link href={"/dashboard/delivery?org="+org}>Delivery history</Link>.</p>
  </main>
 </WorkspaceShell>;
}
