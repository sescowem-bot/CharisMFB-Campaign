import {escapeHtml} from '../email/validation.ts';
import {renderCampaign} from '../campaigns/render.ts';
import type {EmailDesign} from '../campaign/design.ts';
import {safeCustomerAttribute} from '../campaign/customer-fields.ts';

type Contact={first_name?:string|null;last_name?:string|null;email?:string|null};
export type DirectPreview={html:string;subject:string;error:string;sampleName:string};
/** This pure function only renders safe, illustrative preview HTML; it never sends. */
export function renderDirectEmailPreview(input:{
 design:EmailDesign|null;subject:string;body:string;
 brand:{name:string;color:string;address:string};contact?:Contact;customFields?:string[];
}):DirectPreview{
 const sampleName=[input.contact?.first_name,input.contact?.last_name].filter(Boolean).join(' ')||'Sample customer';
 try{
  if(input.design){
   const rendered=renderCampaign({
    design:input.design,subject:input.subject,company:input.brand.name,address:input.brand.address,color:input.brand.color,
    contact:{first_name:input.contact?.first_name||'Customer',last_name:input.contact?.last_name||'',email:input.contact?.email||undefined,attributes:Object.fromEntries((input.customFields||[]).filter(safeCustomerAttribute).map(key=>[key,key.includes('account')||key.startsWith('acct')?'1234':'Customer detail']))},
    testPreview:true
   });
   return {html:rendered.html,subject:rendered.subject,error:'',sampleName};
  }
  // The simple-message template mirrors direct dispatch; preference URLs are added only when sending.
  const textBody=escapeHtml(input.body).replace(/\r?\n/g,'<br/>');
  const html=['<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
   '<body style="margin:0;background:#f5f6fa;padding:28px;font-family:Arial,sans-serif">',
   '<main style="max-width:640px;margin:auto;background:white;border:1px solid #e4e8f2;padding:28px">',
   '<h2 style="color:#41259a;margin-top:0">Charis Microfinance Bank</h2>',
   '<div style="font-size:15px;line-height:1.7;color:#243047">',textBody,'</div>',
   '<hr style="border:0;border-top:1px solid #e5e7eb;margin-top:30px">',
   '<p style="font-size:12px;color:#64748b">This is an official bank service communication. Do not share your PIN, password or OTP by email.</p>',
   '<p style="font-size:12px;color:#64748b">Your preference link will be included automatically when the email is sent.</p>',
   '</main></body></html>'].join('');
  return {html,subject:input.subject,error:'',sampleName};
 }catch(e){return {html:'',subject:input.subject,error:e instanceof Error?e.message:'Could not render the email.',sampleName};}
}
