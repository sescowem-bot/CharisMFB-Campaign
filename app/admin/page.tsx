import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Building2,Mail,Palette,ScrollText,ArrowUpRight,Users,FileText,BarChart3} from 'lucide-react';
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
 const reports=has('reports.view')||isOwner;
 const operations=has('operations.view')||isOwner;
 const audit=has('audit.view');
 if(!isOwner&&!access&&!staff&&!departments&&!providers&&!branding&&!audit&&!reports&&!operations)redirect('/dashboard');
 const org=account.workspace.id;
 const sections=[
  {title:'People & access',description:'Invite colleagues, assign responsibilities and control which actions they can perform.',href:access?'/admin/access':`/dashboard/team?org=${org}`,icon:Users,show:access||staff},
  {title:'Departments & branches',description:'Maintain the organisational structure and authorised staff assignments.',href:'/dashboard/departments',icon:Building2,show:departments},
  {title:'Communication settings',description:'Configure bank sending rules, service messages and staff permissions.',href:'/admin/communications',icon:Mail,show:isOwner||has('settings.manage')},
  {title:'Email delivery settings',description:'Configure verified email addresses, delivery providers and connection tests.',href:'/admin/providers',icon:Mail,show:providers},
  {title:'Campaign reports',description:'Review campaign activity, delivery results and export reports.',href:'/dashboard/reports',icon:FileText,show:reports},
  {title:'Operations reports',description:'Review customer operations and credit activity.',href:'/dashboard/insights',icon:BarChart3,show:operations},
  {title:'Brand & media',description:'Approved logo, styles and images for bank communications.',href:`/dashboard/branding?org=${org}`,icon:Palette,show:branding},
  {title:'Audit history',description:'Review authorised changes, approvals and access decisions.',href:'/admin/audit',icon:ScrollText,show:audit}
 ];
 return <WorkspaceShell title="Administration" org={org} admin subtitle="One secure workspace for Charis bank administration.">
  <div className="charis-admin-cards">{sections.filter(s=>s.show).map(({title,description,href,icon:Icon})=><Link className="charis-admin-card" href={href} key={title}>
   <span className="charis-admin-card-icon"><Icon size={23}/></span><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={19}/>
  </Link>)}</div>
  {(staff||access)&&<p className="muted">Role and permission changes are audited. Permissions control both available menus and protected server operations; hiding navigation alone is not access control.</p>}

 </WorkspaceShell>;
}
