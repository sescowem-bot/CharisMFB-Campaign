import {retryPendingResendOptouts} from '@/lib/preferences/tokens';
import {NextResponse} from 'next/server';
import {bearerMatches} from '@/lib/delivery/events';
import {sendDirectBatch} from '@/lib/direct/dispatch';
import {emailServiceDb} from '@/lib/email/server';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request) {
 if(!bearerMatches(request.headers.get('authorization'),process.env.EMAIL_WORKER_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401});
 try {
  const preferenceSync=await retryPendingResendOptouts(4).catch(()=>({attempted:0}));
  const direct=await sendDirectBatch(50);
  const service=emailServiceDb();
  const {error:reconcileError}=await service.rpc('charis_direct_reconcile_pending_060',{p_limit:30});
  if(reconcileError)throw Error('Direct event reconciliation unavailable');
  const {error:heartbeatError}=await service.rpc('charis_worker_heartbeat_060',{
   p_processed:direct.processed,p_legacy:0
  });
  if(heartbeatError)throw Error('Worker heartbeat not persisted');
  return NextResponse.json({direct,preferenceSync});
 }catch{
  return NextResponse.json({error:'Delivery worker requires operational review'},{status:500});
 }
}
