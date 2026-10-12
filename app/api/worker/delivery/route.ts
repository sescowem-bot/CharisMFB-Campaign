import {NextResponse} from 'next/server';
import {bearerMatches} from '@/lib/delivery/events';
import {processDelivery} from '@/lib/delivery/worker';
import {runBatch,batchOptionsFromEnv} from '@/lib/delivery/batch';
export const runtime='nodejs';
export const maxDuration=120;
async function handle(request:Request) {
 if(!bearerMatches(request.headers.get('authorization'),process.env.EMAIL_WORKER_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401});
 try {return NextResponse.json(await runBatch(()=>processDelivery(),batchOptionsFromEnv(process.env)));}catch{return NextResponse.json({error:'Delivery worker requires operational review'},{status:500});}
}
export const POST=handle;
/** Schedulers that can only issue GET (for example Vercel Cron) use the same bearer secret. */
export const GET=handle;
