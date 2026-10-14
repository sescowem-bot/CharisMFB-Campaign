import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Users,Building2,ShieldCheck,Mail,Palette,ScrollText,ArrowUpRight} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
export default async function Administration(){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.admin&&!account.providerAdmin&&!account.auditAdmin)redirect('/dashboard');
 const links=[
  {name:'Team access',detail:'Invite staff and manage membership',href:'/dashboard/team',show:account.admin,icon:Users},
  {name:'Roles & permissions',detail:'Create roles and delegate capabilities',href:'/admin/access',show:account.accessAdmin,icon:ShieldCheck},
  {name:'Departments',detail:'Create workspaces and assign staff',href:'/dashboard/departments',show:account.admin,icon:Building2},
  {name:'Email providers',detail:'Configure approved sending services',href:'/admin/providers',show:account.providerAdmin,icon:Mail},
  {name:'Brand & media',detail:'Maintain approved bank branding',href:'/dashboard/branding',show:account.admin,icon:Palette},
  {name:'Audit activity',detail:'Review recent change and delivery records',href:'/admin/audit',show:account.auditAdmin,icon:ScrollText}
 ];
 return <WorkspaceShell title="Administration Centre" admin org={account.workspace?.id} subtitle="Manage Charis staff, departmental access and communication operations.">
  <section className="hero-card"><span className="eyebrow">CHARIS ADMINISTRATION</span><h2>One secure place to manage your bank workspace.</h2><p>Access to each area is controlled by your assigned permissions. The system owner can delegate administrative responsibilities without transferring ownership.</p></section>
  <div className="tile-grid">{links.filter(l=>l.show).map(({name,detail,href,icon:Icon})=><Link className="tile" key={href} href={href}><span className="tile-icon"><Icon size={21}/></span><strong>{name}</strong><small>{detail}</small><span className="tile-arrow">Open <ArrowUpRight size={14}/></span></Link>)}</div>
 </WorkspaceShell>;
}
