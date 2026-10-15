import './charis-template-presets.css';
import './charis-departments.css';
import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import './globals.css';
import './charis-premium.css';
import './charis-design-v3.css';
import './charis-claude-faithful.css';
import './charis-providers.css';
import './charis-loan-tasks.css';
export const dynamic='force-dynamic';
export async function generateMetadata():Promise<Metadata>{
 const assets=await charisBrandAssets();
 return {title:{default:'Charis Customer Communications Centre',template:'%s | Charis'},description:'Internal customer communications for authorised Charis Microfinance Bank Ltd staff.',robots:{index:false,follow:false},icons:{icon:assets.favicon||'/favicon.ico',shortcut:assets.favicon||'/favicon.ico'}};
}
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body className="charis-premium" style={{'--brand':'#40239a','--brand-ink':'#fff'} as CSSProperties}>{children}</body></html>;
}
