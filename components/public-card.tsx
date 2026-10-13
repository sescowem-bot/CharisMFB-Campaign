import Image from 'next/image';
import type {ReactNode} from 'react';
import {brand} from '@/lib/brand';

/** Minimal branded wrapper for public pages (e.g. unsubscribe). */
export function PublicCard({title, subtitle, children}: {title: string; subtitle?: string; children: ReactNode}) {
  return (
    <div className="public-simple">
      <div className="public-card">
        <Image unoptimized className="logo" src={brand.logo} width={150} height={34} alt={brand.name}/>
        <h1 style={{fontSize: 24}}>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
