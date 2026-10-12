import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {SenderForm} from '@/components/sender-form';
import {CharisResendForm,DisableCharisSender,CharisDomainConnectForm,CharisDomainCheckForm,CharisDomainUnlinkForm,RemoveUnusedCharisSender} from '@/components/charis-resend-form';
import {listVerifiedResendDomains} from '@/lib/email/charis-resend';
import type {DnsRecord} from '@/lib/email/providers';
export default async function Senders({searchParams}:{searchParams:Promise<{org?:string}>}) {
 const {org}=await searchParams;if(!org||!z.string().uuid().safeParse(org).success)redirect('/dashboard');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:allowed}=await db.rpc('can_manage_senders',{p_org:org});
 if(!allowed)return <WorkspaceShell org={org} title="Senders & domains"><div className="notice">Company administrator access to an active workspace is required.</div></WorkspaceShell>;
 const [domains,senders,history]=await Promise.all([
 db.from('sending_domains').select('*').eq('organization_id',org).order('created_at',{ascending:false}),
 db.from('sender_identities').select('*').eq('organization_id',org).order('created_at',{ascending:false}),
 db.from('email_test_attempts').select('id,status,provider_message_id,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(10)
 ]);
 if(domains.error||senders.error||history.error)return <WorkspaceShell org={org} title="Senders & domains"><p role="alert">Sender data could not be loaded. Confirm migration 007 is installed and retry.</p></WorkspaceShell>;
 if(process.env.SINGLE_COMPANY_MODE==='true'&&org===process.env.SINGLE_COMPANY_ORG_ID){
  // Authentication and can_manage_senders were checked before calling the server-only provider API.
  let domainsAvailable:string[]=[];let domainError='';
  try{domainsAvailable=(await listVerifiedResendDomains()).map(d=>d.domain);}
  catch(e){domainError=e instanceof Error?e.message:'Could not load verified domains.';}
  const connected=domains.data.filter(d=>d.provider==='resend'&&d.verification_status==='verified'&&d.charis_connected===true&&Boolean(d.provider_domain_id)).map(d=>d.domain).filter(d=>domainsAvailable.includes(d));
  const current=senders.data.find(s=>s.is_active&&connected.includes(String(s.from_email).split('@')[1]));
  const fromEmail=String(current?.from_email||'');
  const fromDomain=fromEmail.split('@')[1]||'';
  const selected=connected.includes(fromDomain)?fromDomain:connected[0]||'';
  return <WorkspaceShell org={org} title="Email sending settings">
   <section className="panel"><h2>Sender identity and Resend connection</h2>
    <p>Charis administrators can change the sender name, address and reply-to email here. Only the Resend API key is stored in Vercel. No email identity is hardcoded in the deployment.</p>
    {domainError&&<p role="alert" className="feedback-error">{domainError}</p>}
    {!domainError&&!connected.length&&<p role="alert" className="notice">No verified domain has been connected to Charis yet. Enter your testing domain below. Unrelated domains in the same Resend account are never selected automatically.</p>}
    {!!connected.length&&<CharisResendForm org={org} domains={connected} defaultName={String(current?.from_name||'Charis Microfinance Bank')} defaultLocal={fromEmail.split('@')[0]||'campaigns'} defaultDomain={selected} defaultReply={String(current?.reply_to||'')}/>}
   </section>

   <section className="panel"><h2>Connect your testing domain</h2><p className="muted">Enter the domain you control, such as sescoconcept.name.ng. The system uses the Resend API key already in Vercel. No provider Domain ID or hardcoded sender address is needed.</p><CharisDomainConnectForm org={org}/>
   {domains.data.filter(d=>d.provider==='resend'&&d.charis_connected===true&&d.verification_status!=='revoked').map(d=><div className="sender-domain" key={d.id}><h3>{d.domain} · {d.verification_status}</h3>
    {d.verification_status!=='verified'&&<><p className="muted">Add the following DNS records at your DNS hosting provider. Keep existing email records intact.</p><div className="table-scroll"><table className="admin-table"><thead><tr><th>Type</th><th>Host</th><th>Value</th></tr></thead><tbody>{(Array.isArray(d.dns_records)?d.dns_records:[]).map((r:DnsRecord,i:number)=><tr key={i}><td>{r.type}</td><td><code>{r.name}</code></td><td><code>{r.value}</code></td></tr>)}</tbody></table></div></>}
    <div className="actions"><CharisDomainCheckForm org={org} id={d.id}/>{d.verification_status!=='verified'&&<CharisDomainUnlinkForm org={org} id={d.id}/>}</div>
   </div>)}
   </section>
   <section className="panel"><h2>Saved sender identities</h2>
    <p className="muted">The campaign editor lets staff choose an active sender. A test email goes only to your own verified account.</p>
    {!senders.data.length&&<p className="muted">No sender configured yet.</p>}
    {senders.data.map(s=><div key={s.id} className="sender-domain"><strong>{s.from_name}</strong><p>{s.from_email} · Replies: {s.reply_to} · {s.is_active?'Active':'Disabled'}</p>
     {s.is_active&&!connected.includes(String(s.from_email).split('@')[1])&&<p className="notice">This sender is not connected to a verified Charis domain. Disable it before testing.</p>}{s.is_active&&connected.includes(String(s.from_email).split('@')[1])&&<div className="sender-inline"><SenderForm org={org} action="test" label="Send test to my account"><input type="hidden" name="sender_id" value={s.id}/></SenderForm></div>}{s.is_active?<DisableCharisSender org={org} id={s.id}/>:<RemoveUnusedCharisSender org={org} id={s.id}/>}
     </div>)}
   </section>
   </WorkspaceShell>;
 }
 const {data:own}=await db.rpc('is_owner_workspace',{p_org:org});
 const verified=domains.data.filter(d=>d.verification_status==='verified');
 return <WorkspaceShell org={org} title="Senders & domains"><p className="muted">Connect your identity, authenticate your domain and test your email setup.</p>
 <div className="notice">{own?<Link className="btn" href="/admin/workspace">Connect your existing Resend sender</Link>:'Use the steps below to connect your company domain.'}</div>
 {!own&&<div className="sender-steps"><span>01 · Add domain</span><span>02 · Add DNS records</span><span>03 · Verify and create sender</span></div>}
 <div className="admin-columns">{!own&&<SenderForm org={org} action="add_domain" label="Register domain"><h2>Add a sending domain</h2><label>Domain<input name="domain" required maxLength={253} placeholder="mail.yourcompany.com" autoCapitalize="none"/></label><label>Email provider<select name="provider"><option value="resend">Resend</option><option value="brevo">Brevo</option></select></label><p className="muted">Your administrator must enable the email provider first. Use an official Charis sending domain approved by the bank, not a personal or developer domain.</p></SenderForm>}
 <SenderForm org={org} action="save_sender" label="Save sender"><h2>Sender identity</h2><label>Verified domain<select name="domain_id" required><option value="">Select domain</option>{verified.map(d=><option key={d.id} value={d.id}>{d.domain}</option>)}</select></label><label>From name<input name="from_name" maxLength={100} required placeholder="Your company"/></label><label>From address<input name="from_email" type="email" required placeholder="hello@mail.yourcompany.com"/></label><label>Reply-To address<input name="reply_to" type="email" required/></label><p className="muted">The From address must match the selected domain exactly.</p></SenderForm></div>
 <h2>Domain authentication</h2>{domains.data.length===0&&<div className="panel"><h3>No domains yet</h3><p className="muted">Register your first domain to receive the DNS records.</p></div>}
 {domains.data.map(d=><section className="panel sender-domain" key={d.id}><div className="workspace-heading"><div><h3>{d.domain}</h3><span className="muted">{d.provider}</span></div><span className={`status-chip ${d.verification_status==='verified'?'status-granted':''}`}>{d.verification_status}</span></div>
 <p className="muted">{d.ownership_method==='provider_account'?'Connected through your verified Resend account. No additional ownership TXT record is required.':'Add these records through your DNS host. Preserve existing mail records.'}</p>
 <div className="table-scroll"><table className="admin-table dns-table"><caption className="sr-only">DNS records for {d.domain}</caption><thead><tr><th scope="col">Type</th><th scope="col">Host</th><th scope="col">Value</th><th scope="col">Status</th></tr></thead><tbody>{d.ownership_method!=='provider_account'&&<tr><td>TXT</td><td><code>_charis-campaign.{d.domain}</code></td><td><code>charis-verification={d.ownership_token}</code></td><td>Ownership check</td></tr>}{(d.dns_records as DnsRecord[]).map((r,i)=><tr key={i}><td>{r.type}{r.priority!==undefined?` (${r.priority})`:''}</td><td><code>{r.name}</code></td><td><code>{r.value}</code></td><td>{r.status}</td></tr>)}</tbody></table></div>
 {!d.provider_domain_id&&<p className="notice">Email provider registration is incomplete. Charis internal record ID: {d.id}. This is NOT the provider Domain ID. An administrator must check the provider account and reconcile the correct provider ID.</p>}
 {d.verification_status!=='revoked'&&<div className="sender-inline"><SenderForm org={org} action="check_domain" label="Check verification"><input type="hidden" name="domain_id" value={d.id}/></SenderForm><details><summary>Revoke domain access</summary><p>Revocation disables all sender identities using this domain. Provider records are retained for an administrator to review.</p><SenderForm org={org} action="revoke_domain" label="Revoke domain"><input type="hidden" name="domain_id" value={d.id}/></SenderForm></details></div>}</section>)}
 <h2>Saved senders</h2>{senders.data.length===0&&<p className="muted">Verify a domain, then save your first sender.</p>}{senders.data.map(s=><section className="panel sender-domain" key={s.id}><h3>{s.from_name}</h3><p>{s.from_email}</p><p className="muted">Replies go to {s.reply_to}. Status: {s.is_active?'active':'disabled'}.</p>{s.is_active&&<><SenderForm org={org} action="test" label="Send configuration test"><input type="hidden" name="sender_id" value={s.id}/><p className="muted">Send one configuration test to your verified account address, {user.email}. Limit: one per minute and ten per rolling day per company.</p></SenderForm>{domains.data.find(d=>d.id===s.domain_id)?.provider==='brevo'&&<details><summary>Brevo sender registration</summary><p>Use once if the sender is not yet registered in Brevo. Complete any provider approval requirements there.</p><SenderForm org={org} action="register_brevo_sender" label="Register sender with Brevo"><input type="hidden" name="sender_id" value={s.id}/></SenderForm></details>}</>}</section>)}
 <h2>Recent configuration tests</h2><p className="muted">Accepted means the provider acknowledged the request. Delivery and inbox placement are not confirmed here.</p>{history.data.length===0?<p className="muted">No tests submitted.</p>:<div className="table-scroll"><table className="admin-table"><thead><tr><th>Date (UTC)</th><th>Result</th><th>Provider reference</th></tr></thead><tbody>{history.data.map(t=><tr key={t.id}><td>{new Date(t.created_at).toISOString()}</td><td>{t.status}</td><td>{t.provider_message_id||'Not confirmed'}</td></tr>)}</tbody></table></div>}
 </WorkspaceShell>;
}
