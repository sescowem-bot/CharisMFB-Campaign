import Image from 'next/image';import Link from 'next/link';
import {publicBankWebsite} from '@/lib/preferences/brand';
export const dynamic='force-dynamic';
export const metadata={title:'Email preferences | Charis Microfinance Bank',robots:{index:false,follow:false}};
export default async function SubscribeComplete({searchParams}:{searchParams:Promise<{status?:string;request?:string}>}){
 const {status,request}=await searchParams;const website=await publicBankWebsite().catch(()=>null);
 const message=request==='1'?'If the email address is eligible, a confirmation link will arrive shortly. Please check your inbox.':status==='confirmed'?'Your request is verified. Optional email updates are now enabled in Charis. Provider synchronisation may take a short time.':status==='blocked'?'The subscription cannot be changed online. Please contact the bank.':status==='unavailable'?'We could not complete your request. Please try again later.':'This link is invalid or expired. Request a new confirmation email.';
 return <main style={{minHeight:'100vh',background:'#f6f4fb',padding:'52px 16px',fontFamily:'Arial,sans-serif'}}>
 <section style={{maxWidth:510,margin:'auto',background:'white',padding:32,borderRadius:16}}>
 <Image alt="Charis Microfinance Bank" src="/charis-official-logo.png" width={175} height={65} style={{objectFit:'contain'}}/>
 <h1 style={{color:'#30206d'}}>{status==='confirmed'?'Subscription confirmed':'Email preferences'}</h1>
 <p style={{color:'#475569',lineHeight:1.6}}>{message}</p>
 {(status!=='confirmed'&&request!=='1')&&<p><Link href="/subscribe">Request another link</Link></p>}
 {website&&<p><Link href={website} style={{color:'#40239a'}}>Return to Charis website →</Link></p>}
 </section></main>;
}
