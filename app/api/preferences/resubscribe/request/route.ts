import {NextResponse} from 'next/server';
import {requestResubscription} from '@/lib/preferences/resubscribe';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
export async function POST(req:Request){
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Invalid request'},{status:413,headers});
  const type=req.headers.get('content-type')||'';
  if(!type.includes('application/x-www-form-urlencoded')&&!type.includes('multipart/form-data'))return NextResponse.json({error:'Invalid request'},{status:415,headers});
  const email=String((await req.formData()).get('email')||'');
  // Generic confirmation page prevents email-address enumeration.
  await requestResubscription(email,'customer').catch(()=>{});
  return NextResponse.redirect(new URL('/subscribe/complete?request=1',req.url),{status:303,headers});
 }catch{return NextResponse.redirect(new URL('/subscribe/complete?request=1',req.url),{status:303,headers});}
}
