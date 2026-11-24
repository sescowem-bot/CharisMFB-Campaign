'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {contactsAccess,organizationIdSchema} from '@/lib/contacts/access';
export type FormResult = {success?: string; error?: string};
/** Bank-authorised contact management with staff-friendly feedback. */
function contactActionMessage(message?:string, code?:string):string {
 if(code==='23505') return 'A customer with this email address or phone number already exists.';
 if(message?.toLowerCase().includes('delivery history') ||
    message?.toLowerCase().includes('submitted/approved campaign') ||
    message?.toLowerCase().includes('approved campaign'))
  return 'This customer has campaign history and cannot be permanently deleted. Archive the customer instead.';
 if(message?.toLowerCase().includes('not authorised') ||
    message?.toLowerCase().includes('permission'))
  return 'You do not have permission to manage customers. Please contact your administrator.';
 if(message?.toLowerCase().includes('not found'))
  return 'This customer is no longer available. Refresh the page and try again.';
 return 'We could not complete that action. Please try again. If the problem continues, contact your administrator.';
}

export async function manageContact(_:FormResult,form:FormData):Promise<FormResult>{
 try{
  const org=organizationIdSchema.parse(form.get('organization_id'));
  const id=organizationIdSchema.parse(form.get('contact_id'));
  const operation=z.enum(['archive','restore','delete']).parse(form.get('operation'));
  const {db,authorized}=await contactsAccess(org);
  if(!authorized)return {error:'You do not have permission to manage customers. Please contact your administrator.'};
  const {error}=operation==='delete'
   ?await db.rpc('charis_contact_delete',{p_org:org,p_contact:id})
   :await db.rpc('charis_contact_archive',{p_org:org,p_contact:id,p_archive:operation==='archive'});
  if(error)return {error:contactActionMessage(error.message,error.code)};
  revalidatePath('/dashboard/contacts');revalidatePath('/dashboard');
  return {success:operation==='delete'?'Customer deleted.':operation==='restore'?'Customer restored. Marketing remains stopped until permission is recorded again.':'Customer archived and removed from future marketing.'};
 }catch{return {error:'We could not complete that action. Please refresh the page and try again.'};}
}

const contactSchema=z.object({
 organization_id:organizationIdSchema,
 contact_id:z.union([z.literal(''),z.string().uuid()]),
 first_name:z.string().trim().max(100),
 last_name:z.string().trim().max(100),
 email:z.union([z.literal(''),z.email().max(254)]),
 phone:z.union([z.literal(''),z.string().regex(/^\+[1-9]\d{7,14}$/)]),
 consent_status:z.enum(['unknown','granted','denied']),
 consent_evidence:z.string().max(500)
}).refine(v=>!!v.email||!!v.phone,{message:'Email or phone is required'}).refine(v=>v.consent_status!=='granted'||v.consent_evidence.trim().length>=6,{message:'Provide evidence of opt-in consent'});
export async function saveContact(_:FormResult,form:FormData):Promise<FormResult>{
 const consentStatus=String(form.get('consent_status')||'unknown');
 const consentSource=z.enum(['signed_form','consent_register','digital_form','recorded_call','other']).safeParse(form.get('consent_source'));
 const consentConfirmed=form.get('consent_confirmed')==='yes';
 const consentEvidence=consentStatus==='granted'&&consentConfirmed&&consentSource.success?`Staff confirmed existing permission via ${consentSource.data} on ${new Date().toISOString().slice(0,10)}.`:'';
 const submitted=Object.fromEntries(['organization_id','contact_id','first_name','last_name','email','phone','consent_status'].map(k=>[k,String(form.get(k)||'').trim()]));
 submitted.consent_evidence=consentEvidence;
 const parsed=contactSchema.safeParse(submitted);
 if(!parsed.success)return {error:parsed.error.issues[0]?.message||'Invalid contact'};
 const data=parsed.data;
 const details:Record<string,string>={};
 try{
  const value=JSON.parse(String(form.get('custom_details')||'{}')) as unknown;
  if(!value||typeof value!=='object'||Array.isArray(value))return {error:'Extra customer fields are invalid.'};
  const entries=Object.entries(value);if(entries.length>56)return {error:'Maximum of 56 extra fields.'};
  for(const [key,entry] of entries){if(!/^[a-z][a-z0-9_]{0,39}$/.test(key)||/(password|pin|otp|bvn|nin|cvv|card_number|secret|token)/.test(key)||typeof entry!=='string'||entry.length>200)return {error:'Use a short field name and text value. Do not enter sensitive credentials.'};if(['account_number','account_no','account_reference'].includes(key)&&entry.replace(/\D/g,'').length>4)return {error:'Enter only the last four digits for account references.'};details[key]=entry;}
 }catch{return {error:'Could not read extra customer fields.'};}
 try{
  const {db,authorized}=await contactsAccess(data.organization_id);
  if(!authorized)return {error:'You do not have permission to manage customers. Please contact your administrator.'};
  const {error}=await db.rpc('charis_save_contact_with_details',{p_org:data.organization_id,p_id:data.contact_id||null,p_first:data.first_name,p_last:data.last_name,p_email:data.email,p_phone:data.phone,p_consent:data.consent_status,p_evidence:data.consent_evidence,p_details:details});
  if(error)return {error:contactActionMessage(error.message,error.code)};
  revalidatePath('/dashboard/contacts');return {success:'Contact saved successfully.'};
 }catch{return {error:'Unable to save contact'};}
}
export async function createList(_:FormResult,form:FormData):Promise<FormResult>{
 const parsed=z.object({org:organizationIdSchema,name:z.string().trim().min(2).max(100),description:z.string().max(500)}).safeParse({org:form.get('organization_id'),name:form.get('name'),description:form.get('description')||''});
 if(!parsed.success)return {error:'List name must contain 2–100 characters'};
 try{
  const {db,authorized}=await contactsAccess(parsed.data.org);if(!authorized)return {error:'You do not have permission to manage contact groups. Please contact your administrator.'};
  const {error}=await db.rpc('save_contact_list',{p_org:parsed.data.org,p_name:parsed.data.name,p_description:parsed.data.description});
  if(error)return {error:error.code==='23505'?'This group name already exists. Choose another name.':'We could not create this group. Please try again.'};
  revalidatePath('/dashboard/lists');return {success:'Contact list created.'};
 }catch{return {error:'Unable to create list'};}
}
export async function changeListMembership(_:FormResult,form:FormData):Promise<FormResult>{
 const parsed=z.object({org:organizationIdSchema,list:organizationIdSchema,contact:organizationIdSchema,add:z.enum(['true','false'])}).safeParse({org:form.get('organization_id'),list:form.get('list_id'),contact:form.get('contact_id'),add:form.get('add')});
 if(!parsed.success)return {error:'Invalid membership change'};
 try{
  const {db,authorized}=await contactsAccess(parsed.data.org);if(!authorized)return {error:'You do not have permission to manage contact groups. Please contact your administrator.'};
  const {error}=await db.rpc('add_contact_to_list',{p_org:parsed.data.org,p_list:parsed.data.list,p_contact:parsed.data.contact,p_add:parsed.data.add==='true'});
  if(error)return {error:'We could not update this group membership. Please refresh and try again.'};revalidatePath('/dashboard/lists');return {success:'Group membership updated.'};
 }catch{return {error:'Unable to update list'};}
}
export async function createSegment(_:FormResult,form:FormData):Promise<FormResult>{
 const rules:Record<string,string|boolean>={};
 const consent=String(form.get('consent_status')||'');
 const source=String(form.get('source')||'');
 const hasEmail=String(form.get('has_email')||'');
 if(consent)rules.consent_status=consent;
 if(source)rules.source=source;
 if(hasEmail)rules.has_email=hasEmail==='yes';
 const parsed=z.object({org:organizationIdSchema,name:z.string().trim().min(2).max(100),description:z.string().max(500),rules:z.object({consent_status:z.enum(['unknown','granted','denied']).optional(),source:z.enum(['manual','import']).optional(),has_email:z.boolean().optional()}).refine(r=>Object.keys(r).length>0)}).safeParse({org:form.get('organization_id'),name:form.get('name'),description:form.get('description')||'',rules});
 if(!parsed.success)return {error:'Enter a name and at least one valid filter'};
 try{
  const {db,authorized}=await contactsAccess(parsed.data.org);if(!authorized)return {error:'You do not have permission to manage smart groups. Please contact your administrator.'};
  const {error}=await db.rpc('save_contact_segment',{p_org:parsed.data.org,p_name:parsed.data.name,p_description:parsed.data.description,p_rules:parsed.data.rules});
  if(error)return {error:error.code==='23505'?'This smart group name already exists. Choose another name.':'We could not save this smart group. Please try again.'};
  revalidatePath('/dashboard/segments');return {success:'Dynamic segment created.'};
 }catch{return {error:'Unable to save segment'};}
}

/** Bulk contact actions report each result without exposing backend errors. */
export async function bulkContactsAction(_:FormResult,form:FormData):Promise<FormResult>{
 try{
  const org=organizationIdSchema.parse(form.get('organization_id'));
  const ids=z.array(z.string().uuid()).min(1).max(100).parse(JSON.parse(String(form.get('contacts')||'[]')));
  const operation=z.enum(['archive','delete']).parse(form.get('operation'));
  const {db,authorized}=await contactsAccess(org);
  if(!authorized)return {error:'You do not have permission to manage customers. Please contact your administrator.'};
  const {data,error}=await db.rpc('charis_bulk_contacts_safe',{p_org:org,p_contacts:ids,p_action:operation});
  if(error)return {error:'We could not process the selected customers. Please refresh the page and try again.'};
  const summary=data as {requested?:number;succeeded?:number;failed?:number;results?:Array<{success?:boolean;message?:string}>}|null;
  const succeeded=Number(summary?.succeeded||0);
  const failed=Number(summary?.failed||0);
  revalidatePath('/dashboard/contacts');revalidatePath('/dashboard/lists');revalidatePath('/dashboard');
  if(failed===0)return {success:`${succeeded} customers ${operation==='archive'?'archived':'deleted'} successfully.`};
  const protectedCount=summary?.results?.filter(item=>!item.success&&item.message?.includes('campaign history')).length||0;
  if(succeeded===0&&operation==='delete'&&protectedCount===failed)
    return {error:`None of the ${ids.length} selected customers could be permanently deleted because they have campaign history. Archive them instead.`};
  return {success:`${succeeded} of ${ids.length} customers ${operation==='archive'?'archived':'deleted'}. ${failed} could not be processed. ${protectedCount?protectedCount+' with campaign history should be archived.':''}`};
 }catch{
  return {error:'We could not process the selected customers. Please check your selection and try again.'};
 }
}
export async function bulkListAction(_:FormResult,form:FormData):Promise<FormResult>{
 try{
  const org=organizationIdSchema.parse(form.get('organization_id'));
  const list=organizationIdSchema.parse(form.get('list_id'));
  const ids=z.array(z.string().uuid()).min(1).max(200).parse(JSON.parse(String(form.get('contacts')||'[]')));
  const add=z.enum(['add','remove']).parse(form.get('operation'))==='add';
  const {db,authorized}=await contactsAccess(org);
  if(!authorized)return {error:'You do not have permission to manage contact groups. Please contact your administrator.'};
  const {data,error}=await db.rpc('charis_list_batch',{p_org:org,p_list:list,p_contacts:ids,p_add:add});
  if(error)return {error:'We could not update the selected group members. Please refresh and try again.'};
  revalidatePath('/dashboard/lists');
  return {success:`${data||ids.length} customers ${add?'added to':'removed from'} the group.`};
 }catch{return {error:'We could not update the selected group members. Please check your selection and try again.'};}
}
