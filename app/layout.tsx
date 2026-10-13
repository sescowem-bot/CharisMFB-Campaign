import type {Metadata, Viewport} from 'next';
import {brand} from '@/lib/brand';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const assets = await charisBrandAssets();
  const icon = assets.favicon || brand.icon;
  return {
    title: {default: `${brand.name} · ${brand.product}`, template: `%s | ${brand.product}`},
    description: brand.tagline,
    icons: {icon, shortcut: icon},
    robots: {index: false, follow: false}
  };
}

export const viewport: Viewport = {themeColor: brand.colors.primary, width: 'device-width', initialScale: 1};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body style={{'--brand': brand.colors.primary} as React.CSSProperties}>{children}</body>
    </html>
  );
}
