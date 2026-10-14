import {redirect} from 'next/navigation';
import {z} from 'zod';
import Link from 'next/link';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {SenderForm} from '@/components/sender-form';
import {CharisResendForm,DisableCharisSender,CharisDomainConnectForm,CharisDomainCheckForm,CharisDomainUnlinkForm,RemoveUnusedCharisSender} from '@/components/charis-resend-form';
import {CheckCircle2,MailCheck,ShieldCheck} from 'lucide-react';

/** Charis-only interface. Resend is contacted on admin actions, never on routine page loads. */
export default async function Senders({searchParams}:{searchParams:Promise<{org?:string}>}) {
 const {org}=await searchParams;
 if(!org||!z.string().uuid().safeParse(org).success)redirect('/dashboard');
 if(org!==process.env.SINGLE_COMPANY_ORG_ID)redirect('/dashboard');
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const {data:allowed,error:permissionError}=await db.rpc('can_manage_senders',{p_org:org});
 if(permissionError||!allowed)return <WorkspaceShell org={org} title="Email sender settings"><section className="panel"><h2>Sender access required</h2><p className="muted">Only authorised Charis administrators can change sending identities. Ask your administrator to update your role.</p></section></WorkspaceShell>;
 const [domains,senders,history]=await Promise.all([
  db.from('sending_domains').select('id,domain,provider,verification_status,charis_connected,provider_domain_id').eq('organization_id',org).eq('provider','resend').order('created_at',{ascending:false}),
  db.from('sender_identities').select('id,from_name,from_email,reply_to,is_active,domain_id').eq('organization_id',org).order('created_at',{ascending:false}),
  db.from('email_test_attempts').select('id,status,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(5)
 ]);
 if(domains.error||senders.error||history.error)return <WorkspaceShell org={org} title="Email sender settings"><p role="alert" className="feedback-error">Sender settings could not be loaded. Confirm Charis migration 018 is installed.</p></WorkspaceShell>;
 const activeDomains=(domains.data||[]).filter(d=>d.verification_status==='verified'&&d.charis_connected===true&&Boolean(d.provider_domain_id));
 const connected=activeDomains.map(d=>d.domain);
 const resendDomainIds=new Set(activeDomains.map(d=>d.id));
 const current=(senders.data||[]).find(s=>s.is_active&&resendDomainIds.has(s.domain_id));
 const email=current?.from_email||'';
 const selected=connected.includes(email.split('@')[1])?email.split('@')[1]:connected[0]||'';
 const pending=(domains.data||[]).filter(d=>d.verification_status!=='verified'&&d.verification_status!=='revoked'&&d.charis_connected===true);
 return <WorkspaceShell org={org} title="Email sender settings">
  <div className="charis-guide-card"><ShieldCheck size={17}/> Your Resend API key stays securely in Vercel. Sender names and addresses are managed here. Domains already verified in the same Resend account can be connected without repeating DNS setup.</div>
  <section className="panel" style={{marginBottom:20}}><div className="workspace-heading"><div><h2>1. Connect your verified domain</h2><p className="muted">Choose an existing verified domain from your Resend account. No provider IDs or new domain registrations.</p></div><span className="status-chip">{connected.length?'Connected':'Needs setup'}</span></div>
   <CharisDomainConnectForm org={org}/>
   {connected.length>0&&<div className="charis-guide-card"><CheckCircle2 size={18}/> Verified for Charis: <strong>{connected.join(', ')}</strong></div>}
   {pending.map(d=><div className="sender-domain" key={d.id}><p><strong>{d.domain}</strong> <span className="status-chip">Pending local verification</span></p><p className="muted">If Resend already verified this domain, click Recheck. No new domain registration is initiated.</p><div className="actions"><CharisDomainCheckForm org={org} id={d.id}/><CharisDomainUnlinkForm org={org} id={d.id}/></div></div>)}
  </section>
  <section className="panel" style={{marginBottom:20}}><h2>2. Set your sender identity</h2><p className="muted">Choose the display name, sender mailbox and reply-to email. Nothing is hardcoded.</p>
   {connected.length?<CharisResendForm org={org} domains={connected} defaultName={String(current?.from_name||'Charis Microfinance Bank')} defaultLocal={email.split('@')[0]||'campaigns'} defaultDomain={selected} defaultReply={String(current?.reply_to||'')}/>:<div className="notice">Connect an existing verified domain above to unlock sender details. <Link className="inline-link" href="https://resend.com/domains">Check your Resend account</Link> if it does not appear.</div>}
  </section>
  <section className="panel"><div className="workspace-heading"><div><h2>3. Send a test</h2><p className="muted">Test delivery to your verified staff email before starting a customer campaign.</p></div><MailCheck size={23}/></div>
   {!senders.data?.length&&<p className="muted">No saved sender yet. Complete steps 1 and 2 first.</p>}
   {(senders.data||[]).map(s=>{const ready=s.is_active&&resendDomainIds.has(s.domain_id);return <div className="sender-domain" key={s.id}><div className="workspace-heading"><div><strong>{s.from_name}</strong><p className="muted">{s.from_email} · Reply-to: {s.reply_to}</p></div><span className={`status-chip ${ready?'status-granted':''}`}>{ready?'Ready to test':s.is_active?'Needs verification':'Disabled'}</span></div>
    {ready&&<SenderForm org={org} action="test" label="Send test to my email"><input type="hidden" name="sender_id" value={s.id}/></SenderForm>}
    {s.is_active?<DisableCharisSender org={org} id={s.id}/>:<RemoveUnusedCharisSender org={org} id={s.id}/>}
   </div>})}
   {!!history.data?.length&&<details><summary>Recent sender tests</summary><ul>{history.data.map(h=><li key={h.id}>{new Date(h.created_at).toLocaleString('en-NG')} · {h.status}</li>)}</ul></details>}
  </section>
 </WorkspaceShell>;
}
