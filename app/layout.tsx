import './charis-template-presets.css';
import './charis-departments.css';
import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {publishedSite} from '@/lib/cms/server';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {contrastInk} from '@/lib/cms/content';
import './globals.css';
import './charis-premium.css';
import './charis-design-v3.css';
import './charis-claude-faithful.css';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{
  if(process.env.SINGLE_COMPANY_MODE==='true'){
    const assets=await charisBrandAssets();
    return {title:{default:'Charis Campaign Centre',template:'%s | Charis Campaign Centre'},description:'Secure customer communications for authorised Charis Microfinance Bank staff.',robots:{index:false,follow:false},icons:{icon:assets.favicon||'/favicon.ico',shortcut:assets.favicon||'/favicon.ico'}};
  }
  const site=await publishedSite();
  return {title:{default:site.display_name,template:`%s | ${site.display_name}`},description:site.tagline};
}
export default async function RootLayout({children}:{children:React.ReactNode}){
  const bank=process.env.SINGLE_COMPANY_MODE==='true';
  if(bank)return <html lang="en"><body className="charis-premium" style={{'--brand':'#40239a','--brand-ink':'#fff'} as CSSProperties}>{children}</body></html>;
  const site=await publishedSite();
  const fonts={system:'system-ui, sans-serif',arial:'Arial, Helvetica, sans-serif',georgia:'Georgia, serif'};
  return <html lang="en"><body style={{'--brand':site.primary_color,'--brand-ink':contrastInk(site.primary_color),'--platform-font':fonts[site.font]} as CSSProperties}>{children}</body></html>;
}
