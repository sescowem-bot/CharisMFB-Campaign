import {z} from 'zod';
import {designSchema} from '@/lib/campaign/design';

// Session storage is deliberately tab-scoped for bank staff. No recipient names,
// emails, phone numbers or final send authorisations are stored on the device.
const uuid=z.string().uuid();
const values=z.object({
 version:z.literal(1),savedAt:z.number().int().positive(),token:uuid,
 step:z.number().int().min(0).max(3),
 subject:z.string().max(180),body:z.string().max(2000),
 design:designSchema.nullable(),templateId:z.string().max(120),
 simpleStyle:z.enum(['classic','modern','minimal','announcement']),
 simpleGreeting:z.string().max(200),
 purpose:z.enum(['general_notice','service_notice','account_update']),
 product:z.enum(['general','savings','current','fixed_deposit','loans','mobile_app','other']),
 showProduct:z.boolean(),channel:z.enum(['email','sms']),
 audience:z.enum(['selected','list','all']),chosen:z.array(uuid).max(500),
 groupId:z.union([uuid,z.literal('')]),mode:z.enum(['now','later']),
 sendAt:z.string().max(24),emailProvider:z.enum(['auto','resend','brevo','mailjet','zeptomail'])
}).strict();
export type CampaignDraft=z.infer<typeof values>;
export const campaignDraftKey=(org:string,user:string)=>'charis-campaign-draft:v1:'+org+':'+user;
const maxAge=8*60*60*1000;
export function readCampaignDraft(key:string):CampaignDraft|null{
 try{
  const data=sessionStorage.getItem(key);
  if(!data||data.length>90000)return null;
  const parsed=values.safeParse(JSON.parse(data));
  if(!parsed.success)return null;
  if(Date.now()-parsed.data.savedAt>maxAge||parsed.data.savedAt>Date.now()+60000){
   sessionStorage.removeItem(key);return null;
  }
  return parsed.data;
 }catch{return null;}
}
export function storeCampaignDraft(key:string,value:CampaignDraft):boolean{
 try{
  const valid=values.safeParse(value);
  if(!valid.success)return false;
  const serialized=JSON.stringify(valid.data);
  if(serialized.length>90000)return false;
  sessionStorage.setItem(key,serialized);return true;
 }catch{return false;}
}
export function discardCampaignDraft(key:string):void{
 try{sessionStorage.removeItem(key);}catch{}
}
