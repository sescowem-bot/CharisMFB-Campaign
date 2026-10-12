'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {supabaseServer} from '@/lib/supabase/server';
import {processDelivery} from '@/lib/delivery/worker';
import {renderCampaign} from '@/lib/campaigns/render';
export type QueueResult={error?:string;success?:string};
export async function queueAction(_:QueueResult,form:FormData):Promise<QueueResult> {
 try {
  const org=z.string().uuid().parse(form.get('organization_id'));const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw new Error('Verified sign-in required.');
  const {data:allowed}=await db.rpc('can_dispatch_campaigns',{p_org:org});if(!allowed)throw new Error('Company Admin or Manager access required.');
  const action=z.enum(['enqueue','pause','resume','cancel','dispatch_one']).parse(form.get('action'));
  if(action==='dispatch_one'){
   const {data:own,error:ownerError}=await db.rpc('is_owner_workspace',{p_org:org});if(ownerError||!(own===true||(process.env.SINGLE_COMPANY_MODE==='true'&&process.env.SINGLE_COMPANY_ORG_ID===org)))throw new Error('This controlled test action is unavailable for this workspace.');
   const result=await processDelivery({org,run:z.string().uuid().parse(form.get('run_id'))});
   revalidatePath('/dashboard/delivery');revalidatePath('/dashboard/reports');
   return {success:result.result==='accepted'?'One email was accepted by the provider. Check reports for delivery updates.':result.result==='idle'?'No pending recipient is currently due in this run.':`Dispatch result: ${result.result}. Check the run status before continuing.`};
  }
  if(action==='enqueue') {
   if(process.env.EMAIL_DELIVERY_ENABLED!=='true')throw new Error('Campaign dispatch is disabled by the platform operator.');
   const base=process.env.NEXT_PUBLIC_APP_URL||'';const url=new URL(base);if(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw new Error('An HTTPS public application origin must be configured.');
   const id=z.string().uuid().parse(form.get('campaign_id'));
   const {data:row,error:read}=await db.from('campaign_drafts').select('design,subject,preheader,requested_send_at').eq('id',id).eq('organization_id',org).single();if(read||!row)throw new Error('Campaign unavailable.');
   renderCampaign({design:row.design,subject:row.subject,preheader:row.preheader,company:'Your company',address:'Preview address'});
   const {data:run,error}=await db.rpc('campaign_enqueue',{p_org:org,p_campaign:id,p_revision:z.coerce.number().int().positive().parse(form.get('revision'))});if(error)throw new Error(error.message);
   // The same explicit Send action dispatches ONE due recipient immediately in Charis mode.
   // Remaining recipients stay safely queued for the scheduled worker (or controlled dispatch).
   if(process.env.SINGLE_COMPANY_MODE==='true'&&org===process.env.SINGLE_COMPANY_ORG_ID&&!row.requested_send_at&&run){
    try{
     const outcome=await processDelivery({org,run:String(run)});
     revalidatePath('/dashboard/delivery');revalidatePath('/dashboard/campaigns');
     if(outcome.result==='accepted')return {success:'Campaign queued. The first email was accepted by Resend. Open Send & delivery to track remaining recipients.'};
     if(outcome.result==='paused')return {success:'Campaign queued but sending paused during preparation. Check Send & delivery before continuing.'};
     return {success:`Campaign queued. Initial dispatch: ${outcome.result}. Open Send & delivery to check the outcome.`};
    }catch{
     return {success:'Campaign queued. Immediate dispatch could not be confirmed. Check Send & delivery and the provider dashboard before retrying.'};
    }
   }
  }else{const {error}=await db.rpc('campaign_run_control',{p_org:org,p_run:z.string().uuid().parse(form.get('run_id')),p_action:action});if(error)throw new Error(error.message);}
  revalidatePath('/dashboard/delivery');revalidatePath('/dashboard/campaigns');return {success:action==='enqueue'?'Approved campaign queued. The configured worker processes it when due.':'Run control saved. In-flight provider submissions may still finish.'};
 }catch(e){return {error:e instanceof Error?e.message:'Delivery action failed.'};}
}
