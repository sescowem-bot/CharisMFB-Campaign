import {NextResponse} from 'next/server';
import {boundedText,bodyErrorResponse} from '@/lib/security/request';
import {sendbyteEvent} from '@/lib/delivery/events';
import {recordProviderEvent} from '@/lib/delivery/record-events';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.SENDBYTE_WEBHOOK_SECRET||'';
 if(secret.length<32)return NextResponse.json({error:'Webhook unavailable'},{status:503});
 try{
  const raw=await boundedText(request,64000);
  const event=sendbyteEvent(raw,request.headers,secret);
  if(!event)return NextResponse.json({received:true});
  await recordProviderEvent('sendbyte',event);
  return NextResponse.json({received:true});
 }catch(error){
  const rejected=bodyErrorResponse(error);if(rejected)return rejected;
  return NextResponse.json({error:'Webhook authentication or event processing failed'},{status:400});
 }
}
