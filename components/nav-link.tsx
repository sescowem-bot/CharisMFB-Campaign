'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';

/** Sidebar link that highlights itself for the current route. */
export function NavLink({href, match, exact=false, children}: {href: string; match?: string; exact?:boolean; children: ReactNode}) {
  const pathname = usePathname();
  const base = match ?? href.split('?')[0];
  const active = pathname === base || (!exact && base !== '/dashboard' && pathname.startsWith(base + '/'));
  return (
    <Link prefetch={false} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined} onClick={()=>{const toggle=document.getElementById('nav-toggle');if(toggle instanceof HTMLInputElement)toggle.checked=false;}}>
      {children}
    </Link>
  );
}
