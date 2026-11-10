'use server';
import {revalidatePath} from 'next/cache';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
import {emailServiceDb} from '@/lib/email/server';
import {fetchZohoContactSnapshot} from '@/lib/zoho/contact-sync';
import {z} from 'zod';

async function admin(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 const org=charisOrgId();
 if(!account||!user||!org||account.workspace.id!==org||!account.providerAdmin)
  throw new Error('Only an authorised Charis communications administrator can manage the Zoho contact connection.');
 return {account,user,org,db:emailServiceDb()};
}

export async function syncZohoContacts(){
 let runId:string|undefined;
 let db:ReturnType<typeof emailServiceDb>|undefined,org:string|undefined;
 try{
  const access=await admin();db=access.db;org=access.org;
  const snapshot=await fetchZohoContactSnapshot();
  const {data:run,error:runError}=await db.from('charis_zoho_contact_sync_runs').insert({
   organization_id:org,started_by:access.user.id,status:'running',
   zoho_list_count:snapshot.lists.length,zoho_contact_count:snapshot.contacts.length
  }).select('id').single();
  if(runError||!run)throw new Error('Could not start the contact synchronisation record. Apply migration 086 first.');
  runId=run.id;
  let inserted=0,matched=0,suppressed=0,membershipCount=0;
  const contactIds=new Map<string,string>();
  // Read the existing directory in pages and match case-insensitively.
  // This avoids creating a second record when a legacy address uses different casing.
  for(let offset=0;offset<50000;offset+=1000){
   const {data:rows,error:readError}=await db.from('contacts').select('id,email').eq('organization_id',org).range(offset,offset+999);
   if(readError)throw new Error('Could not read the existing Charis contact directory.');
   for(const row of rows||[])if(row.email)contactIds.set(String(row.email).trim().toLowerCase(),row.id);
   if((rows||[]).length<1000)break;
  }
  for(let i=0;i<snapshot.contacts.length;i+=100){
   const batch=snapshot.contacts.slice(i,i+100);
   const newRows=batch.filter(x=>!contactIds.has(x.email)).map(x=>({
    organization_id:org,first_name:x.first_name,last_name:x.last_name,email:x.email,
    phone:x.phone||null,source:'import',consent_status:'unknown',attributes:{zoho_campaigns_import:true}
   }));
   if(newRows.length){
    const {data:created,error:createError}=await db.from('contacts').insert(newRows).select('id,email');
    if(createError)throw new Error('Could not import Zoho contacts into the Charis directory. Check duplicate emails and database constraints.');
    for(const c of created||[])contactIds.set(c.email,c.id);
    inserted+=(created||[]).length;
   }
   matched+=batch.length-newRows.length;
   for(const x of batch){
    const id=contactIds.get(x.email);if(!id)continue;
    if(x.status==='unsubscribe'||x.status==='bounce'||x.status==='complaint'){
     const reason=x.status==='unsubscribe'?'unsubscribe':x.status==='complaint'?'complaint':'bounce';
     const {data:prior}=await db.from('email_suppressions').select('reason').eq('organization_id',org).eq('email',x.email).maybeSingle();
     const priority:Record<string,number>={unsubscribe:1,bounce:2,complaint:3,admin:4};
     const finalReason=(prior?.reason&&priority[prior.reason]>=priority[reason])?prior.reason:reason;
     const {error:supError}=await db.from('email_suppressions').upsert({organization_id:org,email:x.email,reason:finalReason},{onConflict:'organization_id,email'});
     if(supError)throw new Error('Could not apply a Zoho suppression to the Charis delivery blocklist.');
     if(x.status==='unsubscribe'||x.status==='complaint'){
      const {error:contactError}=await db.from('contacts').update({
       unsubscribed_at:new Date().toISOString(),consent_status:'denied',
       consent_evidence:x.status==='complaint'?'Spam complaint reported in Zoho Campaigns; imported during administrator sync.':'Unsubscribed in Zoho Campaigns; imported during administrator sync.',
       consent_recorded_at:new Date().toISOString()
      }).eq('organization_id',org).eq('id',id);
      if(contactError)throw new Error('Could not apply the Zoho unsubscribe to the Charis contact record.');
     }
     const {error:zohoSuppressionError}=await db.from('charis_zoho_email_suppressions').upsert({
      organization_id:org,email:x.email,reason:finalReason,source:'zoho_contact_sync',
      zoho_list_key:x.list_key,suppressed_at:new Date().toISOString()
     },{onConflict:'organization_id,email'});
     if(zohoSuppressionError)throw new Error('Could not save the Zoho suppression audit record.');
     suppressed++;
    }
   }
   const memberships=batch.flatMap(x=>{
    const id=contactIds.get(x.email);
    return id?x.list_keys.map(zoho_list_key=>({
     organization_id:org,contact_id:id,email:x.email,zoho_list_key,
     zoho_status:x.status,zoho_contact_id:x.zoho_contact_id||null,last_synced_at:new Date().toISOString()
    })):[];
   });
   if(memberships.length){
    const {error:memberError}=await db.from('charis_zoho_contact_memberships').upsert(memberships,{onConflict:'organization_id,zoho_list_key,email'});
    if(memberError)throw new Error('Could not save Zoho mailing-list membership records.');
    membershipCount+=memberships.length;
   }
  }
  for(const l of snapshot.lists){
   const {error}=await db.from('charis_zoho_contact_lists').upsert({
    organization_id:org,zoho_list_key:l.list_key,name:l.name,contact_count:l.contact_count,
    lock_status:l.lock_status,is_public:l.is_public,last_synced_at:new Date().toISOString()
   },{onConflict:'organization_id,zoho_list_key'});
   if(error)throw new Error('Could not save Zoho mailing-list details.');
  }
  await db.from('charis_zoho_contact_sync_runs').update({
   status:'completed',finished_at:new Date().toISOString(),inserted_count:inserted,
   matched_count:matched,suppressed_count:suppressed,membership_count:membershipCount
  }).eq('id',runId).eq('organization_id',org);
  revalidatePath('/admin/zoho-contacts');revalidatePath('/dashboard/contacts');
  return {success:true,message:`Sync complete. ${snapshot.contacts.length} unique Zoho contacts reviewed, ${inserted} new contacts imported, ${matched} matched to existing Charis records, and ${suppressed} opt-outs, bounces or complaints blocked.`};
 }catch(e){
  if(db&&org&&runId)await db.from('charis_zoho_contact_sync_runs').update({status:'failed',finished_at:new Date().toISOString(),error_summary:'Zoho contact synchronisation failed. Review server logs.'}).eq('id',runId).eq('organization_id',org);
  return {success:false,message:e instanceof Error?e.message:'Zoho contact synchronisation failed.'};
 }
}

export async function attestSignedAccountOpeningForms(form:FormData){
 try{
  const {user,org,db}=await admin();
  const parsed=z.object({
   reference:z.string().trim().min(8).max(200),
   scope:z.enum(['all_marketing','product_specific']),
   product:z.string().trim().max(80).optional(),
   confirmed:z.literal('yes')
  }).safeParse({
   reference:form.get('reference'),scope:form.get('scope'),
   product:form.get('product'),confirmed:form.get('confirmed')
  });
  if(!parsed.success)return {error:'Provide an evidence register reference and confirm the signed-form permission scope.'};
  if(parsed.data.scope==='product_specific'&&(!parsed.data.product||parsed.data.product.length<2))
   return {error:'Name the product covered by the permission.'};
  const {data:members,error}=await db.from('charis_zoho_contact_memberships')
   .select('contact_id,email,zoho_status').eq('organization_id',org).eq('zoho_status','active');
  if(error)throw new Error('Sync Zoho contacts before recording account-opening consent.');
  const eligible=[...new Map((members||[]).map(x=>[x.contact_id,x])).values()].filter(x=>x.email);
  let updated=0;
  for(let i=0;i<eligible.length;i+=100){
   const batch=eligible.slice(i,i+100),ids=batch.map(x=>x.contact_id);
   const {data:current,error:currentError}=await db.from('contacts')
    .select('id,email,unsubscribed_at').eq('organization_id',org).eq('consent_status','unknown')
    .is('unsubscribed_at',null).in('id',ids);
   if(currentError)throw new Error('Could not verify existing customer opt-out status.');
   const emails=(current||[]).map(x=>x.email).filter(Boolean);
   const {data:blocked,error:blockedError}=emails.length
    ?await db.from('email_suppressions').select('email').eq('organization_id',org).in('email',emails)
    :{data:[],error:null};
   if(blockedError)throw new Error('Could not verify the bank suppression register.');
   const blockedSet=new Set((blocked||[]).map(x=>x.email));
   const allowed=(current||[]).filter(x=>x.email&&!blockedSet.has(x.email)).map(x=>x.id);
   if(!allowed.length)continue;
   const {data,error:upError}=await db.from('contacts').update({
    consent_status:parsed.data.scope==='all_marketing'?'granted':'unknown',
    consent_evidence:`Administrator attestation: signed Charis account-opening form; reference ${parsed.data.reference}; scope ${parsed.data.scope}${parsed.data.product?`; product ${parsed.data.product}`:''}.`,
    consent_recorded_at:new Date().toISOString()
   }).eq('organization_id',org).eq('consent_status','unknown').is('unsubscribed_at',null).in('id',allowed).select('id');
   if(upError)throw new Error('Could not apply the signed-form consent attestation.');
   updated+=(data||[]).length;
  }
  const {error:logError}=await db.from('charis_zoho_consent_attestations').insert({
   organization_id:org,attested_by:user.id,evidence_reference:parsed.data.reference,
   permission_scope:parsed.data.scope,product_name:parsed.data.product||null,contact_count:updated
  });
  if(logError)throw new Error('Consent was applied but the audit record could not be saved. Contact an administrator before sending.');
  revalidatePath('/admin/zoho-contacts');revalidatePath('/dashboard/contacts');
  return {success:`Consent attestation recorded for ${updated} active, previously unconfirmed Zoho contacts. Existing denials and suppressions were not changed.`};
 }catch(e){return {error:e instanceof Error?e.message:'Could not record consent attestation.'};}
}

// Return the structured result to the client form so administrators can see
// whether the sync completed or why it failed.
export type ZohoSyncActionState = {success:boolean;message:string} | null;
export async function syncZohoContactsForm(
 _previousState: ZohoSyncActionState,
 _formData: FormData
): Promise<ZohoSyncActionState> {
 return await syncZohoContacts();
}

export async function attestSignedAccountOpeningFormsForm(formData: FormData): Promise<void> {
 await attestSignedAccountOpeningForms(formData);
}
