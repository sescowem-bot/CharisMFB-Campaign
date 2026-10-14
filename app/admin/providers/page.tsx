import {ProviderCapacityPlanner} from '@/components/provider-capacity-planner';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ProviderForm,ProviderLimitsForm} from '@/components/provider-form';

/** Provider health and limits. No DNS, Domain ID or old company-registration flows in Charis. */
export default async function Providers() {
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:admin}=await db.rpc('is_platform_super_admin');const org=process.env.SINGLE_COMPANY_MODE==='true'?process.env.SINGLE_COMPANY_ORG_ID:'';
 const {data:charisAdmin}=org?await db.rpc('can_manage_senders',{p_org:org}):{data:false};
 if(!admin&&!charisAdmin)redirect('/dashboard');
 const {data,error}=await db.from('email_provider_settings').select('*').order('provider');
 return <WorkspaceShell admin title="Email service health">
  <div className="charis-guide-card">API keys stay in Vercel. This page checks API connectivity and stores conservative dispatch limits. A successful connection is not approval to send marketing email or proof of a verified sender. Live campaign delivery remains gated separately.</div>
  {error||!data?<p role="alert" className="feedback-error">Email provider settings are unavailable. Confirm the installed migrations.</p>:<div className="admin-columns">{data.map(p=><section className="panel" key={p.provider}>
   <div className="workspace-heading"><h2>{p.provider==='resend'?'Resend':p.provider==='brevo'?'Brevo':'Mailjet'}</h2><span className={`status-chip ${p.enabled?'status-granted':''}`}>{p.enabled?'Enabled':'Disabled'}</span></div>
   <p className="muted">Connection: {p.health_status}. {p.checked_at?`Last checked ${new Date(p.checked_at).toLocaleString('en-NG')}`:'Not checked yet.'}</p>
   <p className="muted">{p.provider==='resend'?'Uses RESEND_API_KEY in Vercel.':p.provider==='brevo'?'Uses BREVO_API_KEY in Vercel. Use the API key, not the SMTP key shown on the SMTP tab.':'Uses MAILJET_API_KEY and MAILJET_SECRET_KEY in Vercel. Verify the sender inside Mailjet before testing.'}</p><ProviderForm provider={p.provider} enabled={p.enabled} org={org||''} charis/>
   <ProviderLimitsForm provider={p.provider} daily={p.daily_limit} interval={p.minimum_interval_seconds} org={org||''}/>
  </section>)}</div>}
 {data&&<ProviderCapacityPlanner providers={data.map(p=>({provider:p.provider,enabled:p.enabled,health_status:p.health_status,daily_limit:p.daily_limit}))}/>}
 </WorkspaceShell>;
}
