import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {publishedSite} from '@/lib/cms/server';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {contrastInk} from '@/lib/cms/content';
import './globals.css';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{const [site,assets]=await Promise.all([publishedSite(),charisBrandAssets()]);return {title:{default:site.display_name,template:`%s | ${site.display_name}`},description:site.tagline,icons:{icon:assets.favicon||'/charis-icon.svg',shortcut:assets.favicon||'/charis-icon.svg'}};}
export default async function RootLayout({children}:{children:React.ReactNode}){const site=await publishedSite();const fonts={system:'system-ui, sans-serif',arial:'Arial, Helvetica, sans-serif',georgia:'Georgia, serif'};return <html lang="en"><body style={{'--brand':site.primary_color,'--brand-ink':contrastInk(site.primary_color),'--platform-font':fonts[site.font]} as CSSProperties}>{children}</body></html>;}
