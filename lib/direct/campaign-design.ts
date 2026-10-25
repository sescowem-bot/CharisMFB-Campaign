import {designSchema,assertNoDemoLinks,verifiedBrandWebsite,type EmailDesign} from '../campaign/design.ts';
import {allowedCustomerToken} from '../campaign/customer-fields.ts';

export function campaignParagraphs(design:EmailDesign):string {
 return design.blocks.filter(block=>block.type==='paragraph').map(block=>block.text.trim()).filter(Boolean).join('\n\n');
}

/** The bank's official domain is the only customer-facing click-through target in the direct composer. */
export function checkDirectDesign(design:EmailDesign,bankWebsite?:string|null,subject=''):void {
 assertNoDemoLinks(design);
 const paragraphs=campaignParagraphs(design);
 const allText=[subject,...design.blocks.filter(b=>b.type!=='divider').map(b=>b.text)];
 for(const text of allText){
  const tokens=[...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(match=>match[1].trim());
  if(tokens.some(token=>!allowedCustomerToken(token))||
    text.replace(/\{\{\s*[^}]+?\s*\}\}/g,'').includes('{{')||
    text.replace(/\{\{\s*[^}]+?\s*\}\}/g,'').includes('}}'))
   throw Error('Choose a customer detail from the available fields. Unsupported details cannot be used.');
 }
 if(paragraphs.length<10||paragraphs.length>2000)throw Error('Write a message between 10 and 2,000 characters.');
 const brand=verifiedBrandWebsite(bankWebsite);
 const hostname=brand?new URL(brand).hostname.toLowerCase():'';
 for(const block of design.blocks){
  if(block.type==='button'){
   const url=new URL(block.url);
   if(!hostname||url.hostname.toLowerCase()!==hostname||url.username||url.password)
    throw Error('Campaign buttons must link to the bank website configured in Brand & Media.');
  }
 }
}

/** Keep the submitted design JSON small; detailed schema validation happens on the server. */
export function readDirectDesign(raw:string):EmailDesign {
 if(raw.length>30000)throw Error('The email design is too large.');
 const parsed=designSchema.safeParse(JSON.parse(raw));
 if(!parsed.success)throw parsed.error;
 return parsed.data;
}
