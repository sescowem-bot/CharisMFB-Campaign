'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';

/** Sidebar link that highlights itself for the current route. */
export function NavLink({href, match, children}: {href: string; match?: string; children: ReactNode}) {
  const pathname = usePathname();
  const base = match ?? href.split('?')[0];
  const active = pathname === base || (base !== '/dashboard' && pathname.startsWith(base + '/'));
  return (
    <Link href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}
