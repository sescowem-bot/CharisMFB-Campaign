import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {publishedSite} from '@/lib/cms/server';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {contrastInk} from '@/lib/cms/content';
import './globals.css';
import './charis-premium.css';
import './charis-design-v3.css';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const [site,assets]=await Promise.all([publishedSite(),charisBrandAssets()]);const bank=process.env.SINGLE_COMPANY_MODE==='true';const name=bank?'Charis Campaign Centre':site.display_name;return {title:{default:name,template:`%s | ${name}`},description:bank?'Authorised customer communications for Charis Microfinance Bank Ltd.':site.tagline,robots:bank?{index:false,follow:false}:undefined,icons:{icon:assets.favicon||'/favicon.ico',shortcut:assets.favicon||'/favicon.ico',apple:assets.favicon||'/charis-official-mark.png'}};}
export default async function RootLayout({children}:{children:React.ReactNode}){const site=await publishedSite();const fonts={system:'system-ui, sans-serif',arial:'Arial, Helvetica, sans-serif',georgia:'Georgia, serif'};return <html lang="en"><body className={process.env.SINGLE_COMPANY_MODE==='true'?'charis-premium':undefined} style={{'--brand':site.primary_color,'--brand-ink':contrastInk(site.primary_color),'--platform-font':fonts[site.font]} as CSSProperties}>{children}</body></html>;}
