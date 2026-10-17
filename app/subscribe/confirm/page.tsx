import Image from 'next/image';
import Link from 'next/link';
import {inspectResubscribeToken} from '@/lib/preferences/resubscribe';
export const dynamic='force-dynamic';export const revalidate=0;
export const metadata={title:'Confirm subscription | Charis Microfinance Bank',robots:{index:false,follow:false}};
export default async function Confirm({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token=''}=await searchParams;
 const valid=await inspectResubscribeToken(token).catch(()=>false);
 return <main style={{minHeight:'100vh',background:'#f6f4fb',padding:'52px 16px',fontFamily:'Arial,sans-serif'}}>
 <section style={{maxWidth:510,margin:'auto',background:'white',padding:32,borderRadius:16}}>
 <Image alt="Charis Microfinance Bank" src="/charis-official-logo.png" width={175} height={65} style={{objectFit:'contain'}}/>
 <h1 style={{color:'#30206d'}}>Confirm your email subscription</h1>
 {valid?<><p style={{color:'#475569',lineHeight:1.6}}>Select Confirm to receive optional Charis updates again. You can unsubscribe later at any time.</p>
 <form method="post" action="/api/preferences/resubscribe/confirm"><input type="hidden" name="token" value={token}/>
 <button type="submit" style={{border:0,background:'#40239a',color:'white',borderRadius:9,padding:'13px 18px',cursor:'pointer'}}>Confirm subscription</button></form></>
 :<p style={{color:'#475569'}}>This confirmation link has expired or is invalid. <Link href="/subscribe">Request a new link</Link>.</p>}
 </section></main>;
}
