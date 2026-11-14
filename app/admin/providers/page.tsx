import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {charisOrgId} from '@/lib/bank';
import {ProviderForm} from '@/components/provider-form';
import {DirectProviderForm} from '@/components/direct-admin-forms';
import {SendByteSenderConnect,BrevoSenderConnect} from '@/components/provider-route-form';
import {isCharisSenderEmail} from '@/lib/email/charis-sender';
export const dynamic='force-dynamic';
type Provider='sendbyte'|'resend'|'brevo';
const order:Provider[]=['sendbyte','resend','brevo'];
const info:Record<Provider,{title:string;description:string}>={
 sendbyte:{title:'SendByte',description:'Primary service for customer campaigns and updates'},
 resend:{title:'Resend',description:'Alternative campaign email provider'},
 brevo:{title:'Brevo',description:'Alternative email provider'}
};
export default async function Providers(){
 const db=await supabaseServer(),{data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const org=charisOrgId();if(!org)redirect('/setup-required');
 const {data:canManage,error:accessError}=await db.rpc('can_manage_senders',{p_org:org});
 if(accessError||canManage!==true)redirect('/dashboard');
 const [settings,senders,domains,prefs,directAccess]=await Promise.all([
  db.from('email_provider_settings').select('*'),
  db.from('sender_identities').select('id,from_email,from_name,is_active,domain_id').eq('organization_id',org),
  db.from('sending_domains').select('id,provider,verification_status,charis_connected').eq('organization_id',org),
  db.from('charis_direct_provider_prefs').select('provider,sender_id,enabled,priority').eq('organization_id',org),
  db.rpc('charis_direct_is_admin',{p_org:org})
 ]);
 const rows=settings.data||[],domainMap=new Map((domains.data||[]).map(d=>[d.id,d]));
 const available=(provider:Provider)=>(senders.data||[]).filter(s=>{
  const d=domainMap.get(s.domain_id);
  return s.is_active&&isCharisSenderEmail(s.from_email)&&d?.provider===provider&&d.verification_status==='verified'&&d.charis_connected===true;
 }).map(s=>({id:s.id,name:s.from_name,email:s.from_email}));
 const deliveryEnabled=process.env.EMAIL_DELIVERY_ENABLED==='true';
 const apiReady=(provider:Provider)=>Boolean(process.env[provider==='sendbyte'?'SENDBYTE_API_KEY':provider==='resend'?'RESEND_API_KEY':'BREVO_API_KEY']);
 return <WorkspaceShell admin title="Email providers" subtitle="Choose the service used for each customer campaign.">
  <main className="charis-provider-page charis-provider-hub">
   <section className="charis-provider-intro"><div><span className="charis-provider-eyebrow">CAMPAIGN EMAIL</span><h2>Manage your sending services</h2><p>SendByte is the primary provider. Resend and Brevo remain available as alternatives when connected.</p></div><div className="charis-provider-intro-actions"><Link className="btn secondary" href={"/dashboard/senders?org="+org}>Resend sender settings</Link><Link className="btn secondary" href="/admin/communications">Staff access</Link></div></section>
   {(settings.error||senders.error||domains.error||prefs.error)&&<p className="feedback-error" role="alert">Email settings could not be loaded.</p>}
   <section className="charis-provider-main-grid" aria-label="Email providers">
    {order.map(provider=>{
     const row=rows.find(x=>x.provider===provider),sendersFor=available(provider),current=(prefs.data||[]).find(x=>x.provider===provider);
     const selected=sendersFor.find(x=>x.id===current?.sender_id);
     const configured=Boolean(row?.enabled&&current?.enabled&&selected&&apiReady(provider)&&deliveryEnabled);
     return <article key={provider} id={'provider-'+provider} className="charis-provider-main-card">
      <header><div><h2>{info[provider].title}{provider==='sendbyte'?' · Primary':''}</h2><p>{info[provider].description}</p></div><span className={'charis-provider-status'+(configured?' is-ready':'')}>{configured?'Ready':'Not connected'}</span></header>
      {selected&&<p className="charis-provider-active-sender">Sending address: <strong>{selected.email}</strong></p>}
      {sendersFor.length>0&&directAccess.data===true&&<DirectProviderForm key={provider+'-'+current?.sender_id} provider={provider} senders={sendersFor} current={current}/>}
      {sendersFor.length===0&&<div className="charis-provider-guidance">
       {provider==='sendbyte'?<><p>Connect a domain already verified in SendByte.</p><SendByteSenderConnect/></>:provider==='brevo'?<><p>Connect an active Brevo sender.</p><BrevoSenderConnect/></>:<p><Link className="btn secondary" href={"/dashboard/senders?org="+org}>Manage Resend sender</Link></p>}
      </div>}
      {row&&<details className="charis-provider-advanced"><summary>Provider access</summary><ProviderForm provider={provider} enabled={row.enabled} org={org} charis/></details>}
      {!apiReady(provider)&&<p className="muted">This provider has not been connected yet.</p>}
     </article>;
    })}
   </section>
   <p className="charis-provider-footer-note">Choose the sending provider on each campaign. The system will not switch providers automatically.</p>
   <p><Link href={"/dashboard/communications?org="+org}>View campaign delivery history</Link></p>
  </main>
 </WorkspaceShell>;
}
