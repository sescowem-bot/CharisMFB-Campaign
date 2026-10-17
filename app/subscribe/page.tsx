import Image from 'next/image';
import Link from 'next/link';
import {publicBankWebsite} from '@/lib/preferences/brand';
export const dynamic='force-dynamic';
export const metadata={title:'Email subscriptions | Charis Microfinance Bank',robots:{index:false,follow:false}};
export default async function Subscribe(){
 const website=await publicBankWebsite().catch(()=>null);
 return <main style={{minHeight:'100vh',background:'#f6f4fb',padding:'52px 16px',fontFamily:'Arial,sans-serif'}}>
 <section style={{maxWidth:510,margin:'auto',background:'white',padding:32,borderRadius:16}}>
 <Image alt="Charis Microfinance Bank" src="/charis-official-logo.png" width={175} height={65} style={{objectFit:'contain'}}/>
 <h1 style={{color:'#30206d'}}>Subscribe again</h1>
 <p style={{color:'#475569',lineHeight:1.6}}>If you unsubscribed by mistake, enter your email address. We will send a confirmation link if the address is eligible.</p>
 <form method="post" action="/api/preferences/resubscribe/request">
  <label htmlFor="email" style={{display:'block',marginBottom:8,fontWeight:600}}>Email address</label>
  <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" style={{boxSizing:'border-box',width:'100%',border:'1px solid #cbc8da',borderRadius:9,padding:13,marginBottom:16}}/>
  <button type="submit" style={{border:0,background:'#40239a',color:'white',borderRadius:9,padding:'13px 18px',cursor:'pointer'}}>Send confirmation link</button>
 </form>
 <p style={{fontSize:13,color:'#64748b',lineHeight:1.6}}>Your subscription will remain unchanged until you confirm. Banking security and required account notices are handled separately.</p>
 {website&&<Link href={website} style={{color:'#40239a'}}>Return to Charis website →</Link>}
 </section></main>;
}
