import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {boundedText,bodyErrorResponse} from '@/lib/security/request';
import {bearerMatches,mailjetEvent} from '@/lib/delivery/events';
import {recordProviderEvent} from '@/lib/delivery/record-events';
export const runtime='nodejs';
/** Configure Mailjet webhook with HTTP Basic Auth: username charis, password MAILJET_WEBHOOK_SECRET.
    A bearer header with the same secret is also supported for secured forwarding gateways. */
export async function POST(request:Request) {
 const secret=process.env.MAILJET_WEBHOOK_SECRET;
 if(!secret||secret.length<32)return NextResponse.json({error:'Webhook not configured'},{status:503});
 const header=request.headers.get('authorization');
 const basic='Basic '+Buffer.from('charis:'+secret).toString('base64');
 const provided=Buffer.from(header||'');const expected=Buffer.from(basic);
 const isBasic=provided.length===expected.length&&timingSafeEqual(provided,expected);
 if(!isBasic&&!bearerMatches(header,secret))return NextResponse.json({error:'Unauthorized'},{status:401});
 let event;
 try{const raw=await boundedText(request,64000);event=mailjetEvent(raw);}catch(e){
  const rejected=bodyErrorResponse(e);if(rejected)return rejected;
  return NextResponse.json({error:'Invalid Mailjet event'},{status:400});
 }
 if(!event)return NextResponse.json({received:true});
 try{
  await recordProviderEvent('mailjet',event);
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Event not recorded; retry later'},{status:503});}
}
