import Image from 'next/image';
import Link from 'next/link';
import {publicBankWebsite} from '@/lib/preferences/brand';
export const dynamic='force-dynamic';
export const metadata={title:'Preferences saved | Charis Microfinance Bank',robots:{index:false,follow:false}};
export default async function Complete(){
 const website=await publicBankWebsite().catch(()=>null);
 return <main style={{minHeight:'100vh',padding:'60px 16px',background:'#f5f4fb',fontFamily:'Arial,sans-serif'}}>
 <section style={{maxWidth:540,margin:'auto',background:'white',padding:36,borderRadius:18}}>
 <Image alt="Charis Microfinance Bank" src="/charis-official-logo.png" width={170} height={65} style={{objectFit:'contain'}}/>
 <h1 style={{color:'#2c1a61'}}>Preferences updated</h1>
 <p style={{lineHeight:1.7,color:'#475569'}}>You have unsubscribed from optional updates and promotions. Essential service, account and security notifications may continue.</p>
 <p><Link href="/subscribe" style={{color:'#40239a'}}>Subscribe again</Link></p>
 {website&&<Link href={website} style={{display:'inline-block',background:'#40239a',borderRadius:10,color:'white',padding:'13px 20px',textDecoration:'none'}}>Return to Charis website</Link>}
 </section></main>;
}
