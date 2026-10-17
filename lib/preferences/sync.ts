import 'server-only';
import {emailServiceDb} from '@/lib/email/server';
/** Latest bank preference is the source of truth, including after a later resubscription. */
export async function syncPendingSubscriptionChanges(limit=5,scope?:{org:string;email:string}){
 const key=process.env.RESEND_API_KEY;
 if(!key)return {processed:0,reason:'resend_unconfigured'};
 const db=emailServiceDb();
 let query=db.from('charis_subscription_sync').select('organization_id,email,revision,desired_unsubscribed')
  .in('status',['pending','error']).order('updated_at',{ascending:true}).limit(Math.min(Math.max(limit,1),10));
 if(scope)query=query.eq('organization_id',scope.org).eq('email',scope.email);
 const {data:rows,error}=await query;
 if(error||!rows)return {processed:0,reason:'sync_unavailable'};
 let processed=0;
 for(const row of rows){
  // Only globally managed Resend contacts are updated. We never alter bounce/complaint suppressions.
  const before=await db.from('charis_subscription_sync').select('revision,desired_unsubscribed')
   .eq('organization_id',row.organization_id).eq('email',row.email).maybeSingle();
  if(!before.data||before.data.revision!==row.revision||before.data.desired_unsubscribed!==row.desired_unsubscribed)continue;
  let status:'synced'|'not_found'|'error'='error';
  try{
   const response=await fetch('https://api.resend.com/contacts/'+encodeURIComponent(row.email),{
    method:'PATCH',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({unsubscribed:row.desired_unsubscribed}),cache:'no-store',signal:AbortSignal.timeout(9000)
   });
   status=response.ok?'synced':response.status===404?'not_found':'error';
  }catch{status='error';}
  // A newer unsubscribe/resubscribe may have arrived while the API call was in flight.
  // Conditional revision update leaves the newer state pending for a subsequent worker run.
  const {data:updated}=await db.from('charis_subscription_sync').update({status,updated_at:new Date().toISOString(),
   ...(status==='synced'?{synced_at:new Date().toISOString()}:{})})
   .eq('organization_id',row.organization_id).eq('email',row.email).eq('revision',row.revision)
   .eq('desired_unsubscribed',row.desired_unsubscribed).select('email');
  if(updated?.length)processed++;
 }
 return {processed};
}
