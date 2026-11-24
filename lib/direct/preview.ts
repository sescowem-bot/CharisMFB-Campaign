import {renderCampaign} from '../campaigns/render.ts';
import type {EmailDesign} from '../campaign/design.ts';
import {safeCustomerAttribute} from '../campaign/customer-fields.ts';

type Contact={first_name?:string|null;last_name?:string|null;email?:string|null};
export type DirectPreview={html:string;subject:string;error:string;sampleName:string};
/** This pure function only renders safe, illustrative preview HTML; it never sends. */
export function renderDirectEmailPreview(input:{
 design:EmailDesign|null;subject:string;body:string;
 brand:{name:string;color:string;address:string;socialLinks?:Record<string,string>;footer?:{company_name?:string;address?:string;contact_email?:string;website_url?:string;disclaimer?:string;social_platforms?:string[]}};contact?:Contact;customFields?:string[];
}):DirectPreview{
 const sampleName=[input.contact?.first_name,input.contact?.last_name].filter(Boolean).join(' ')||'Sample customer';
 try{
  const design=input.design||{version:'1' as const,blocks:[{type:'paragraph' as const,text:input.body}]};
  const rendered=renderCampaign({
   design,subject:input.subject,company:input.brand.name,address:input.brand.address,color:input.brand.color,
   socialLinks:input.brand.socialLinks,footer:input.brand.footer,
   contact:{first_name:input.contact?.first_name||'Customer',last_name:input.contact?.last_name||'',email:input.contact?.email||undefined,attributes:Object.fromEntries((input.customFields||[]).filter(safeCustomerAttribute).map(key=>[key,key.includes('account')||key.startsWith('acct')?'1234':'Customer detail']))},
   testPreview:true
  });
  return {html:rendered.html,subject:rendered.subject,error:'',sampleName};
 }catch(e){return {html:'',subject:input.subject,error:e instanceof Error?e.message:'Could not render the email.',sampleName};}
}
