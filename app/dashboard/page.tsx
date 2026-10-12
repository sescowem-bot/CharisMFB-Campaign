import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
export default async function Dashboard(){
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:owner}=await db.rpc('is_platform_super_admin');
 const {data:memberships,error}=await db.from('organization_members').select('organization_id,role,organizations(name,status)').eq('user_id',user.id);
 if(error)return <WorkspaceShell title="Company workspace"><p role="alert">Workspace could not be loaded. Please retry or contact support.</p></WorkspaceShell>;
 let companies=(memberships||[]).map(m=>({id:m.organization_id,name:(m.organizations as {name?:string}|null)?.name||m.organization_id,status:(m.organizations as {status?:string}|null)?.status||'pending',role:m.role}));
 if(owner){const {data,error}=await db.from('organizations').select('id,name,status').order('name');if(error)return <WorkspaceShell title="Company workspace"><p role="alert">Companies could not be loaded. Please retry.</p></WorkspaceShell>;companies=(data||[]).map(c=>({...c,role:'super_admin'}));}
 if(process.env.SINGLE_COMPANY_MODE==='true'){
  const configured=process.env.SINGLE_COMPANY_ORG_ID;
  const company= configured?companies.find(c=>c.id===configured):companies.find(c=>c.status==='active');
  if(!company)return <WorkspaceShell title="Charis communication dashboard"><div className="notice" role="alert">An active Charis company workspace is required. Ask the administrator to assign your account and configure SINGLE_COMPANY_ORG_ID.</div></WorkspaceShell>;
  const org=company.id;
  const [contacts,campaigns,lists,approved]=await Promise.all([
   db.from('contacts').select('id',{count:'exact',head:true}).eq('organization_id',org),
   db.from('campaign_drafts').select('id',{count:'exact',head:true}).eq('organization_id',org),
   db.from('contact_lists').select('id',{count:'exact',head:true}).eq('organization_id',org),
   db.from('campaign_drafts').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('status','approved')
  ]);
  return <WorkspaceShell title={`${company.name} · Communications`} org={org}>
   <section className="charis-dashboard-hero"><div><span className="charis-eyebrow">COMMUNICATION CENTER</span><h2>Connect with customers, simply.</h2><p>Create a personalized message, choose exactly who gets it, preview, and send using your approved email service.</p><div className="actions"><Link className="btn" href={`/dashboard/campaigns?org=${org}&create=1`}>Create new campaign →</Link><Link className="btn secondary" href={`/dashboard/imports?org=${org}`}>Upload customer list</Link></div></div></section>
   {company.status!=='active'&&<div className="notice" role="alert">This company is currently {company.status}. Contact your administrator before sending.</div>}
   <div className="charis-metrics"><div><small>Customers</small><strong>{contacts.count??'—'}</strong></div><div><small>Contact groups</small><strong>{lists.count??'—'}</strong></div><div><small>Campaigns</small><strong>{campaigns.count??'—'}</strong></div><div><small>Ready to send</small><strong>{approved.count??'—'}</strong></div></div>
   <div className="notice"><strong>Campaign approvals:</strong> After a campaign is submitted, an authorised reviewer can approve or reject it from the <Link className="inline-link" href={`/dashboard/approvals?org=${org}`}>Approval inbox</Link>. Use the Send Test button on a saved campaign to test without emailing customers.</div>
   <h2>What do you want to do?</h2><div className="charis-shortcuts"><Link href={`/dashboard/campaigns?org=${org}&create=1`}><span>✉️</span><strong>Send a campaign</strong><small>One person, selected people, a group or everyone eligible</small></Link><Link href={`/dashboard/contacts?org=${org}`}><span>👥</span><strong>Manage customers</strong><small>Find, add and review customer contact records</small></Link><Link href={`/dashboard/imports?org=${org}`}><span>📥</span><strong>Import customers</strong><small>Upload CSV or Excel and save as a group</small></Link><Link href={`/dashboard/approvals?org=${org}`}><span>✅</span><strong>Review approvals</strong><small>Approve or reject campaigns awaiting an independent reviewer</small></Link><Link href={`/dashboard/delivery?org=${org}`}><span>📤</span><strong>Send & track</strong><small>Queue approved messages and review dispatch status</small></Link></div>
  </WorkspaceShell>;
 }
 return <WorkspaceShell title="Company workspaces"><p className="muted">Choose a company to create campaigns, upload contacts and manage communication.</p>{owner&&<div className="actions"><Link className="btn" href="/admin/companies">Create or manage companies</Link><Link className="btn secondary" href="/admin">Platform administration</Link></div>}
 {companies.length?<div className="workspace-company-grid">{companies.map(c=><section className="panel" key={c.id}><h2>{c.name}</h2><p className="muted">{c.role.replaceAll('_',' ')} · {c.status}</p><div className="actions">{(c.status==='active'&&(owner||['company_admin','manager','designer'].includes(c.role)))&&<Link className="btn" href={`/dashboard/campaigns?org=${c.id}&create=1`}>Create campaign</Link>}{(owner||c.status==='active'&&['company_admin','manager'].includes(c.role))&&<Link className="btn secondary" href={`/dashboard/imports?org=${c.id}`}>Upload contacts</Link>}</div><div className="workspace-links">{[['Campaign studio','campaigns'],['Contacts','contacts'],['Delivery queue','delivery'],['Reports','reports'],['Team & roles','team'],['Senders & domains','senders'],['Lists','lists'],['Segments','segments'],['Brand Studio','branding'],['Email templates','templates'],['Email footers','footers']].map(([label,path])=><Link key={path} href={`/dashboard/${path}?org=${c.id}`}>{label}</Link>)}</div>{c.status!=='active'&&<p>Activate this workspace through company management before creating campaigns.</p>}</section>)}</div>:<section className="panel"><h2>{owner?'Create your first company':'Workspace access needed'}</h2><p>{owner?'Create a company workspace to organize its contacts, templates and campaigns.':'Ask your platform or company administrator to add your verified account to a company workspace.'}</p>{owner&&<Link className="btn" href="/admin/companies">Create company workspace</Link>}</section>}</WorkspaceShell>;
}
