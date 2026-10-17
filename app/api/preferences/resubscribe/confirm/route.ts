import {NextResponse} from 'next/server';
import {confirmResubscription} from '@/lib/preferences/resubscribe';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
export async function POST(req:Request){
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Invalid request'},{status:413,headers});
  if(!(req.headers.get('content-type')||'').includes('form'))return NextResponse.json({error:'Invalid request'},{status:415,headers});
  const token=String((await req.formData()).get('token')||'');
  const state=await confirmResubscription(token);
  const status=state==='done'?'confirmed':state==='blocked'?'blocked':state==='unavailable'?'unavailable':'expired';
  return NextResponse.redirect(new URL('/subscribe/complete?status='+status,req.url),{status:303,headers});
 }catch{return NextResponse.redirect(new URL('/subscribe/complete?status=unavailable',req.url),{status:303,headers});}
}
