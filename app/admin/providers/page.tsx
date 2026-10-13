import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ProviderForm,ProviderLimitsForm} from '@/components/provider-form';

/** Provider health and limits. No DNS, Domain ID or old company-registration flows in Charis. */
export default async function Providers() {
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:admin}=await db.rpc('is_platform_super_admin');if(!admin)redirect('/dashboard');
 const {data,error}=await db.from('email_provider_settings').select('*').order('provider');
 return <WorkspaceShell admin title="Email service health">
  <div className="charis-guide-card">Provider API keys stay in Vercel. Charis administrators can monitor the connection and safe sending limits here. Sender names and verified domains are managed in Sender Settings.</div>
  {error||!data?<p role="alert" className="feedback-error">Email provider settings are unavailable. Confirm the installed migrations.</p>:<div className="admin-columns">{data.map(p=><section className="panel" key={p.provider}>
   <div className="workspace-heading"><h2>{p.provider==='resend'?'Resend':'Brevo'}</h2><span className={`status-chip ${p.enabled?'status-granted':''}`}>{p.enabled?'Enabled':'Disabled'}</span></div>
   <p className="muted">Connection: {p.health_status}. {p.checked_at?`Last checked ${new Date(p.checked_at).toLocaleString('en-NG')}`:'Not checked yet.'}</p>
   <ProviderForm provider={p.provider} enabled={p.enabled} charis/>
   <ProviderLimitsForm provider={p.provider} daily={p.daily_limit} interval={p.minimum_interval_seconds}/>
  </section>)}</div>}
 </WorkspaceShell>;
}
