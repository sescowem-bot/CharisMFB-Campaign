import {escapeHtml} from '../email/validation.ts';
import {designSchema,assertNoDemoLinks,type EmailDesign} from '../campaign/design.ts';
export const campaignDesign=designSchema;
export type Design=EmailDesign;
export type PreviewContact={first_name?:string;last_name?:string;email?:string;attributes?:Record<string,string>};
const expression=/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g;
export function personalize(text:string,contact:PreviewContact,company:string):string {
 const rendered=text.replace(expression,(_,key:string)=>{
  if(key==='company_name')return company;
  if(['first_name','last_name','email'].includes(key))return String(contact[key as 'first_name'|'last_name'|'email']|| (key==='first_name'?'Customer':''));
  if(/^attributes\.[a-z][a-z0-9_]{0,39}$/.test(key) && !['__proto__','constructor','prototype'].includes(key.split('.')[1])){const field=key.split('.')[1]; const value=contact.attributes?.[field]||''; return /^(account_number|account_no|account_reference)$/.test(field) && value.replace(/\D/g,'').length>4 ? `•••• ${value.replace(/\D/g,'').slice(-4)}` : value;}
  throw new Error(`Unsupported personalization variable: ${key}`);
 });
 // Validate only original template syntax, never re-interpret customer-provided values.
 if(text.replace(expression,'').includes('{{')||text.replace(expression,'').includes('}}'))throw new Error('Invalid personalization syntax.');
 return rendered;
}
export function renderCampaign(input:{design:unknown;subject:string;preheader?:string;company:string;address:string;contact?:PreviewContact;color?:string;unsubscribeUrl?:string;testPreview?:boolean;preferenceLabel?:string}) {
 const design=campaignDesign.parse(input.design),contact=input.contact||{};
 assertNoDemoLinks(design);
 const replace=(text:string)=>escapeHtml(personalize(text,contact,input.company));
 const color=/^#[a-f0-9]{6}$/i.test(input.color||'')?input.color:'#40239a';
 const style=design.style||'classic';
 const background=style==='minimal'?'#ffffff':style==='modern'?'#f7f6fc':style==='announcement'?'#f5f2fe':'#f1f5f9';
 const headingColor=style==='minimal'?'#201445':'#13233b';
 const hero=style==='minimal'?`color:${color};background:#ffffff;border-bottom:3px solid ${color};`:style==='modern'?`color:#ffffff;background:${color};padding:32px;border-radius:12px 12px 0 0;`:style==='announcement'?`color:#ffffff;background:#251354;padding:32px;`:`color:#ffffff;background:${color};padding:24px;`;
 const cardStyle=style==='modern'?'border-radius:12px;overflow:hidden;':style==='announcement'?'border:1px solid #e6def8;':' ';

 const unsubscribe=input.unsubscribeUrl||'https://example.invalid/unsubscribe-preview';
 if(!/^https:\/\//.test(unsubscribe))throw new Error('Unsubscribe link must use HTTPS.');
 const content=design.blocks.map(b=>{
  if(b.type==='heading')return `<h1 style="font-size:${style==='announcement'?30:26}px;line-height:1.3;color:${headingColor};margin:0 0 20px">${replace(b.text)}</h1>`;
  if(b.type==='paragraph')return `<p style="line-height:1.7;white-space:pre-wrap">${replace(b.text)}</p>`;
  if(b.type==='button')return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${color}" style="padding:14px 22px"><a href="${escapeHtml(b.url)}" style="color:#ffffff;text-decoration:none">${replace(b.text)}</a></td></tr></table>`;
  if(b.type==='divider')return '<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"/>';
  if(b.type==='image'){
   const width=b.width==='small'?180:b.width==='medium'?360:544;
   return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:12px 0"><img src="${escapeHtml(b.url)}" alt="${replace(b.text)}" width="${width}" style="width:100%;max-width:${width}px;height:auto;display:block;border:0"/></td></tr></table>`;
  }
  if(b.shape==='circle'){
   const diameter=Math.round(104+(b.widthPercent??100)*1.12);
   return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0"><tr><td align="${b.align||'left'}"><table role="presentation" width="${diameter}" cellpadding="0" cellspacing="0" style="width:${diameter}px;max-width:100%"><tr><td width="${diameter}" height="${diameter}" bgcolor="${b.color}" align="center" valign="middle" style="width:${diameter}px;height:${diameter}px;border-radius:50%;background:${b.color};color:${b.textColor||'#ffffff'};font-size:${b.fontSize||16}px;line-height:1.45;font-weight:600;overflow-wrap:anywhere;border:${b.borderWidth||0}px solid ${b.borderColor||b.color}">${replace(b.text)}</td></tr></table></td></tr></table>`;
  }
  if(b.shape==='rule')return `<div style="height:5px;background:${b.color};font-size:0;line-height:5px">&nbsp;</div>`;
  const rounding=b.shape==='pill'?'999px':b.shape==='panel'?'12px':b.shape==='rectangle'?'0':'4px';
  const padding=b.padding!==undefined?`${b.padding}px`:b.shape==='pill'?'10px 22px':'22px 24px';
  const width=b.widthPercent??100;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0"><tr><td align="${b.align||'left'}"><table role="presentation" width="${width}%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${b.color}" align="${b.align||'left'}" style="background:${b.color};padding:${padding};border-radius:${rounding};color:${b.textColor||'#ffffff'};font-size:${b.fontSize||16}px;line-height:1.5;font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere;${b.minHeight?`height:${b.minHeight}px;`:''}border:${b.borderWidth||0}px solid ${b.borderColor||b.color}">${replace(b.text)}</td></tr></table></td></tr></table>`;

 }).join('');
 const subject=personalize(input.subject,contact,input.company);
 if(!subject.trim()||subject.length>200||/[\r\n]/.test(subject))throw new Error('Rendered subject must be 1 to 200 characters without line breaks.');
 return {subject,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${background};font-family:Arial,sans-serif;color:#13233b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;${cardStyle}"><tr><td style="${hero}font-weight:bold">${escapeHtml(input.company)}</td></tr><tr><td style="padding:${style==='modern'?36:28}px"><div style="display:none;max-height:0;overflow:hidden">${replace(input.preheader||'')}</div>${input.testPreview?'<p style="padding:12px;background:#fff7ed;color:#7c2d12">TEST PREVIEW · Sample recipient data. This is not a campaign delivery.</p>':''}${content}</td></tr><tr><td style="padding:24px;background:#f8fafc;font-size:12px;line-height:1.6">${escapeHtml(input.company)}<br>${escapeHtml(input.address)}<br>${input.testPreview?'Unsubscribe is inactive in this test preview.':`<a href="${escapeHtml(unsubscribe)}">${escapeHtml(input.preferenceLabel||'Unsubscribe')}</a>`}</td></tr></table></td></tr></table></body></html>`};
}
