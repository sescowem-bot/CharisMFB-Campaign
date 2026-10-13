'use client';

import {usePathname} from 'next/navigation';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, UsersRound, UploadCloud, ListChecks, MailPlus,
  Mail, ClipboardCheck, Send, BarChart3, Palette, Images,
  ContactRound, ShieldCheck, Menu, X, Settings2, FileText
} from 'lucide-react';
import {SignOutForm} from '@/components/signout-form';

type NavigationItem = {label:string;href:string;icon:typeof LayoutDashboard};
export function CharisNavigation({org,admin,logo}:{org?:string;admin:boolean;logo:string}) {
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  useEffect(()=>setOpen(false),[pathname]);
  const href=(path:string)=>org?`${path}?org=${encodeURIComponent(org)}`:'/dashboard';
  const groups:{name:string;items:NavigationItem[]}[]=[
    {name:'WORKSPACE',items:[
      {label:'Overview',href:'/dashboard',icon:LayoutDashboard},
      {label:'Customers',href:'/dashboard/contacts',icon:UsersRound},
      {label:'Import customers',href:'/dashboard/imports',icon:UploadCloud},
      {label:'Saved groups',href:'/dashboard/lists',icon:ListChecks}
    ]},
    {name:'CAMPAIGNS',items:[
      {label:'Create campaign',href:'/dashboard/campaigns',icon:MailPlus},
      {label:'Approvals',href:'/dashboard/approvals',icon:ClipboardCheck},
      {label:'Send & delivery',href:'/dashboard/delivery',icon:Send},
      {label:'Reports',href:'/dashboard/reports',icon:BarChart3}
    ]},
    {name:'CONFIGURATION',items:[
      {label:'Email templates',href:'/dashboard/templates',icon:FileText},
      {label:'Sender settings',href:'/dashboard/senders',icon:Mail},
      {label:'Brand & media',href:'/dashboard/branding',icon:Images},
      {label:'Team access',href:'/dashboard/team',icon:ContactRound},
      {label:'Email footers',href:'/dashboard/footers',icon:Palette}
    ]}
  ];
  if(admin)groups.push({name:'SECURITY',items:[
    {label:'Provider health',href:'/admin/providers',icon:Settings2},
    {label:'Audit log',href:'/admin/audit',icon:ShieldCheck}
  ]});
  return <>
    <div className="charis-mobile-bar">
      <Link href="/dashboard" aria-label="Charis Campaign Centre dashboard"><Image src="/charis-official-mark.png" alt="" width={42} height={42}/><strong>Charis Campaign Centre</strong></Link>
      <button type="button" className="charis-menu-toggle" aria-expanded={open} aria-controls="charis-side-panel" aria-label={open?'Close navigation':'Open navigation'} onClick={()=>setOpen(v=>!v)}>{open?<X size={22}/>:<Menu size={22}/>}</button>
    </div>
    {open&&<button className="charis-mobile-backdrop" type="button" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
    <aside id="charis-side-panel" className={`side charis-premium-side ${open?'charis-side-open':''}`} aria-label="Main navigation">
      <Link href="/dashboard" className="charis-sidebar-brand"><span className="charis-logo-tile"><Image unoptimized src={logo} alt="Charis Microfinance Bank Ltd" width={211} height={47} priority/></span><span className="charis-app-descriptor">CAMPAIGN CENTRE</span></Link>
      <div className="charis-workspace-identity"><span className="charis-live-dot"/><span>Charis Microfinance Bank</span></div>
      <nav aria-label="Charis workspace navigation">
        {groups.map(group=><section className="charis-nav-group" key={group.name} aria-label={group.name}>
          <div className="sidebar-label">{group.name}</div>
          {group.items.map(item=>{
            const active=item.href==='/dashboard'?pathname==='/dashboard':pathname===item.href;
            const target=item.label==='Create campaign'?`${href(item.href)}${org?'&':'?'}create=1`:href(item.href);
            const Icon=item.icon;
            return <Link key={item.label} href={target} aria-current={active?'page':undefined} className={`charis-nav-link ${active?'is-active':''}`}><Icon size={18} strokeWidth={1.9}/><span>{item.label}</span>{active&&<span className="charis-nav-accent" aria-hidden="true"/>}</Link>;
          })}
        </section>)}
      </nav>
      <div className="charis-side-bottom"><div className="charis-side-security"><ShieldCheck size={16}/> Authorised staff workspace</div><SignOutForm/></div>
    </aside>
  </>;
}
