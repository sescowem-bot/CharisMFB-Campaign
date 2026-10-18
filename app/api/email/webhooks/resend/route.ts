import {boundedText,bodyErrorResponse} from '@/lib/security/request';
import {NextResponse} from 'next/server';
import {resendEvent} from '@/lib/delivery/events';
import {recordProviderEvent} from '@/lib/delivery/record-events';
export const runtime='nodejs';
export async function POST(request:Request) {
 const secret=process.env.RESEND_WEBHOOK_SECRET;if(!secret)return NextResponse.json({error:'Webhook unavailable'},{status:503});
 let event;
 try {const raw=await boundedText(request,64000);event=resendEvent(raw,request.headers,secret);}catch(e){const rejected=bodyErrorResponse(e);if(rejected)return rejected;return NextResponse.json({error:'Webhook authentication or payload invalid'},{status:400});}
 if(!event)return NextResponse.json({received:true});
 try{await recordProviderEvent('resend',event);return NextResponse.json({received:true});}catch{return NextResponse.json({error:'Event persistence unavailable'},{status:503});}
}
