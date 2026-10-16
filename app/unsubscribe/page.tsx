import Image from 'next/image';
import Link from 'next/link';
import {validPreferenceToken} from '@/lib/preferences/tokens';
import {publicBankWebsite} from '@/lib/preferences/brand';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata={title:'Email preferences | Charis Microfinance Bank',robots:{index:false,follow:false}};
export default async function UnsubscribePage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token=''}=await searchParams;
 let valid=false;
 try{valid=await validPreferenceToken(token);}catch{valid=false;}
 const website=await publicBankWebsite().catch(()=>null);
 return <main style={{minHeight:'100vh',padding:'56px 16px',background:'#f5f4fb',fontFamily:'Arial,sans-serif'}}>
 <section style={{maxWidth:540,margin:'0 auto',background:'#fff',padding:36,borderRadius:18,boxShadow:'0 8px 30px #28145b12'}}>
 <Image alt="Charis Microfinance Bank" src="/charis-official-logo.png" width={170} height={65} style={{objectFit:'contain'}}/>
 <h1 style={{color:'#2c1a61',fontSize:26}}>Email preferences</h1>
 {valid?<><p style={{color:'#46536a',lineHeight:1.6}}>You can stop optional bank updates and promotional emails. Important account, security and required service notices may still be sent.</p>
 <form action="/api/preferences/unsubscribe" method="post"><input type="hidden" name="token" value={token}/><button type="submit" style={{border:0,borderRadius:10,background:'#40239a',color:'white',padding:'14px 22px',fontWeight:700,cursor:'pointer'}}>Unsubscribe from optional emails</button></form>
 </>:<p role="status" style={{color:'#46536a'}}>This preference link is invalid or has expired. Please use the link in a more recent email or contact the bank.</p>}
 {website&&<p style={{marginTop:26}}><Link href={website} style={{color:'#40239a'}}>Return to Charis website →</Link></p>}
 </section></main>;
}
