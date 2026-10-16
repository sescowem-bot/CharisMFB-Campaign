import {NextResponse} from 'next/server';
import {applyPreferenceOptout} from '@/lib/preferences/tokens';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
export async function POST(request:Request){
 try{
  if(Number(request.headers.get('content-length')||0)>4096)return NextResponse.json({error:'Invalid request'}, {status:413,headers});
  const url=new URL(request.url);
  const oneClick=Boolean(url.searchParams.get('token')); // RFC 8058 URL carries the token, POST body carries List-Unsubscribe=One-Click
  const token=url.searchParams.get('token') || String((await request.formData()).get('token')||'');
  const result=await applyPreferenceOptout(token);
  if(result==='unavailable')return NextResponse.json({error:'Preference service unavailable'}, {status:503,headers});
  if(oneClick)return new Response(result==='done'?'Unsubscribed':'Invalid or expired link',{status:result==='done'?200:410,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  if(result==='done')return NextResponse.redirect(new URL('/unsubscribe/complete',url.origin),{status:303,headers});
  return NextResponse.json({error:'This link is invalid or expired'}, {status:410,headers});
 }catch{return NextResponse.json({error:'Unable to update preferences'},{status:400,headers});}
}
