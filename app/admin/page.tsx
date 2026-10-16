import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Building2,ShieldCheck,Mail,Palette,ScrollText,ArrowUpRight,Users,LockKeyhole} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
export const dynamic='force-dynamic';
export default async function Administration(){
 const account=await currentAccount();if(!account)redirect('/login');
 const has=(key:string)=>account.permissions.includes(key);
 const isOwner=account.owner;
 const access=has('access.manage');
 const staff=has('staff.manage');
 const departments=has('departments.manage')||has('branches.manage');
 const providers=has('providers.manage');
 const branding=has('templates.manage')&&(has('settings.manage')||isOwner);
 const audit=has('audit.view');
 if(!isOwner&&!access&&!staff&&!departments&&!providers&&!branding&&!audit)redirect('/dashboard');
 const org=account.workspace.id;
 const sections=[
  {title:'People & access',description:'Invite colleagues, assign responsibilities and control which actions they can perform.',href:access?'/admin/access':`/dashboard/team?org=${org}`,icon:Users,show:access||staff},
  {title:'Departments & branches',description:'Maintain the organisational structure and authorised staff assignments.',href:'/dashboard/departments',icon:Building2,show:departments},
  {title:'Communication settings',description:'Optional approvals, service senders and staff sending access.',href:'/admin/communications',icon:Mail,show:isOwner||has('settings.manage')},
  {title:'Email providers',description:'Manage verified senders, Resend, Brevo, Mailjet and SendGrid from one place.',href:'/admin/providers',icon:Mail,show:providers},
  {title:'Brand & media',description:'Approved logo, styles and images for bank communications.',href:`/dashboard/branding?org=${org}`,icon:Palette,show:branding},
  {title:'Audit history',description:'Review authorised changes, approvals and access decisions.',href:'/admin/audit',icon:ScrollText,show:audit}
 ];
 return <WorkspaceShell title="Administration" org={org} admin subtitle="One secure workspace for Charis bank administration.">
  {isOwner&&<section className="panel charis-owner-banner"><LockKeyhole size={24}/><div><h2>System owner</h2><p className="muted">You retain ownership and can delegate operational permissions without giving staff access to the owner account. Sensitive keys remain server-side.</p></div></section>}
  <div className="charis-admin-cards">{sections.filter(s=>s.show).map(({title,description,href,icon:Icon})=><Link className="charis-admin-card" href={href} key={title}>
   <span className="charis-admin-card-icon"><Icon size={23}/></span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={19}/>
  </Link>)}</div>
  {(staff||access)&&<p className="muted">Role and permission changes are audited. Permissions control both available menus and protected server operations; hiding navigation alone is not access control.</p>}
  {isOwner&&<p className="muted"><ShieldCheck size={15} aria-hidden="true"/> System-owner credentials and billing/provider secrets are not editable by ordinary staff.</p>}
 </WorkspaceShell>;
}
