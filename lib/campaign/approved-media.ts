import {emailServiceDb} from '@/lib/email/server';
import type {EmailDesign} from '@/lib/campaign/design';
/** Every remote image in a saved design must be in the bank-managed image library. */
export async function assertApprovedEmailImages(org:string,design:EmailDesign):Promise<void>{
 const urls=[...new Set(design.blocks.flatMap(b=>b.type==='image'?[b.url]:[]))];
 if(urls.length===0)return;
 const {data,error}=await emailServiceDb().from('charis_media_assets').select('public_url,mime_type').eq('organization_id',org).in('public_url',urls);
 if(error||!data||urls.some(url=>!data.some(row=>row.public_url===url&&['image/png','image/jpeg','image/webp'].includes(row.mime_type)))){
  throw new Error('Use an approved image from Charis Brand & media. Upload it there before adding it to the email.');
 }
}
