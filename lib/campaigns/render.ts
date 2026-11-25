import {escapeHtml} from '../email/validation.ts';
import {designSchema,assertNoDemoLinks,type EmailDesign} from '../campaign/design.ts';
import {safeCustomerAttribute,safeCustomerAttributeValue} from '../campaign/customer-fields.ts';
export const campaignDesign=designSchema;
export type Design=EmailDesign;
export type PreviewContact={first_name?:string;last_name?:string;email?:string;attributes?:Record<string,string>};
const expression=/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g;
function formatStyle(format?:{color?:string;backgroundColor?:string;fontSize?:number;fontFamily?:string;align?:string;lineHeight?:number;paragraphSpacing?:number;letterSpacing?:number;bold?:boolean;italic?:boolean;underline?:boolean}){const color=format?.color&&/^#[a-f0-9]{6}$/i.test(format.color)?format.color:'#243047';const background=format?.backgroundColor&&/^#[a-f0-9]{6}$/i.test(format.backgroundColor)?format.backgroundColor:'transparent';const fonts=['Arial','Georgia','Verdana','Tahoma','Trebuchet MS'];const font=fonts.includes(format?.fontFamily||'')?format!.fontFamily:'Arial';const align=['left','center','right','justify'].includes(format?.align||'')?format!.align:'left';const lineHeight=format?.lineHeight&&format.lineHeight>=1&&format.lineHeight<=3?format.lineHeight:1.7;const letterSpacing=typeof format?.letterSpacing==='number'&&format.letterSpacing>=-1&&format.letterSpacing<=10?format.letterSpacing:0;return `color:${color};background-color:${background};font-size:${format?.fontSize||16}px;font-family:${font},sans-serif;text-align:${align};font-weight:${format?.bold?'700':'400'};font-style:${format?.italic?'italic':'normal'};text-decoration:${format?.underline?'underline':'none'};line-height:${lineHeight};letter-spacing:${letterSpacing}px;white-space:pre-wrap;overflow-wrap:anywhere;`}
export function personalize(text:string,contact:PreviewContact,company:string):string {
 const rendered=text.replace(expression,(_,key:string)=>{
  if(key==='company_name')return company;
  if(['first_name','last_name','email'].includes(key))return String(contact[key as 'first_name'|'last_name'|'email']|| (key==='first_name'?'Customer':''));
  if(key.startsWith('attributes.')&&safeCustomerAttribute(key.slice(11))){const field=key.slice(11);return safeCustomerAttributeValue(field,contact.attributes?.[field]||'');}
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
  if(b.type==='heading')return `<h1 style="font-size:${style==='announcement'?30:26}px;line-height:1.3;color:${headingColor};margin:0 0 20px;${formatStyle(b.format)}">${replace(b.text)}</h1>`;
  if(b.type==='paragraph')return `<p style="${formatStyle(b.format)}margin:0 0 ${Math.max(0,Math.min(64,b.format?.paragraphSpacing??16))}px">${replace(b.text)}</p>`;
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
 const footer=design.footer||{};
 const address=footer.address!==undefined?footer.address:input.address;
 const footerBg=footer.backgroundColor||'#f8fafc',footerColor=footer.textColor||'#64748b',footerAlign=footer.alignment||'left';
 const socialLabel:Record<string,string>={facebook:'f',instagram:'◎',x:'X',linkedin:'in',youtube:'▶',tiktok:'♪'};
 const socials=(footer.social||[]).map(item=>`<a href="${escapeHtml(item.url)}" aria-label="${escapeHtml(item.platform)}" style="display:inline-block;margin:4px 6px 4px 0;padding:7px 10px;border-radius:18px;background:#ffffff;border:1px solid #e2e8f0;color:#334155;text-decoration:none;font-weight:700;font-size:12px">${socialLabel[item.platform]||''} ${escapeHtml(item.platform[0].toUpperCase()+item.platform.slice(1))}</a>`).join('');
 const website=footer.website||'';
 const footerHtml=`<tr><td align="${footerAlign}" style="padding:22px 24px;background:${footerBg};color:${footerColor};font-size:12px;line-height:1.7;text-align:${footerAlign}">${footer.showCompany===false?'':`<strong>${escapeHtml(input.company)}</strong><br>`}${escapeHtml(address||'')}${website?`<br><a href="${escapeHtml(website)}" style="color:${footerColor}">${escapeHtml(website.replace('https://',''))}</a>`:''}${socials?`<div style="padding-top:12px">${socials}</div>`:''}<div style="padding-top:12px">${input.testPreview?'Unsubscribe is inactive in this test preview.':`<a href="${escapeHtml(unsubscribe)}" style="color:${footerColor}">${escapeHtml(input.preferenceLabel||'Unsubscribe')}</a>`}</div></td></tr>`;
 const subject=personalize(input.subject,contact,input.company);
 if(!subject.trim()||subject.length>200||/[\r\n]/.test(subject))throw new Error('Rendered subject must be 1 to 200 characters without line breaks.');
 return {subject,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${background};font-family:Arial,sans-serif;color:#13233b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;${cardStyle}"><tr><td style="${hero}font-weight:bold">${escapeHtml(input.company)}</td></tr><tr><td style="padding:${style==='modern'?36:28}px"><div style="display:none;max-height:0;overflow:hidden">${replace(input.preheader||'')}</div>${input.testPreview?'<p style="padding:12px;background:#fff7ed;color:#7c2d12">TEST PREVIEW · Sample recipient data. This is not a campaign delivery.</p>':''}${content}</td></tr>${footerHtml}</table></td></tr></table></body></html>`};
}
