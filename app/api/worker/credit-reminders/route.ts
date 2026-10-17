import {NextResponse} from 'next/server';
import {z} from 'zod';
import {bearerMatches} from '@/lib/delivery/events';
import {emailServiceDb} from '@/lib/email/server';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request){
 if(!bearerMatches(request.headers.get('authorization'),process.env.EMAIL_WORKER_SECRET))
  return NextResponse.json({error:'Unauthorized'},{status:401});
 // This endpoint discovers review candidates only. Never sends an email or SMS.
 if(process.env.CHARIS_CREDIT_AUTO_SCAN_ENABLED!=='true')return NextResponse.json({enabled:false,generated:0});
 const org=z.uuid().safeParse(process.env.SINGLE_COMPANY_ORG_ID);
 if(!org.success)return NextResponse.json({error:'Bank workspace is not configured'},{status:503});
 try{
  const {data,error}=await emailServiceDb().rpc('charis_credit_auto_generate_056',{p_org:org.data});
  if(error)throw Error(error.message);
  return NextResponse.json({generated:Number(data||0)});
 }catch{return NextResponse.json({error:'Reminder scan requires review'},{status:503});}
}
