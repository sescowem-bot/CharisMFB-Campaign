'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';

/** Native, keyboard-accessible collapsible group; stays open on its active route. */
export function SidebarSection({title,routes,children}:{title:string;routes:string[];children:ReactNode}) {
 const path=usePathname();
 const active=routes.some(route=>path===route||path.startsWith(route+'/'));
 const [open,setOpen]=useState(active);
 useEffect(()=>{if(active)setOpen(true);},[active,path]);
 return <details className="charis-nav-section" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary className="charis-nav-heading"><span>{title}</span><ChevronDown size={15} aria-hidden="true"/></summary>
  <div className="charis-nav-children">{children}</div>
 </details>;
}
