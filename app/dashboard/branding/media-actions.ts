'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath,revalidateTag} from 'next/cache';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {emailServiceDb} from '@/lib/email/server';

export type MediaResult={error?:string;success?:string};
const bucket='charis-brand-assets';
const orgSchema=z.string().uuid();
const maxSize=2*1024*1024;
type Kind='logo'|'favicon'|'media';
function mediaType(bytes:Uint8Array):{mime:string;ext:string}|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return {mime:'image/png',ext:'png'};
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return {mime:'image/webp',ext:'webp'};
 return null;
}
async function allowedEditor(org:string){
 if(org!==process.env.SINGLE_COMPANY_ORG_ID)throw new Error('This action is restricted to the Charis workspace.');
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();if(!user?.email_confirmed_at)throw new Error('Verified staff sign-in required.');
 const [{data:canEdit,error},{data:workspace}]=await Promise.all([
  db.rpc('can_edit_company_design',{p_org:org}),
  db.from('organizations').select('status').eq('id',org).maybeSingle()
 ]);
 if(error||!canEdit||workspace?.status!=='active')throw new Error('Company Administrator or authorised Brand Editor access to an active Charis workspace is required.');
 return user;
}
export async function uploadCharisMedia(_:MediaResult,form:FormData):Promise<MediaResult>{
 try{
  const org=orgSchema.parse(form.get('organization_id'));
  const kind=z.enum(['logo','favicon','media']).parse(form.get('kind')) as Kind;
  const user=await allowedEditor(org);
  const file=form.get('asset');
  if(!(file instanceof File)||file.size<1||file.size>maxSize)throw new Error('Select a PNG, JPG or WebP image smaller than 2 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const type=mediaType(bytes);
  if(!type||type.mime!==file.type)throw new Error('Invalid image format. Use a genuine PNG, JPG or WebP image.');
  if(kind==='favicon'&&file.size>512*1024)throw new Error('Favicon must be smaller than 512 KB.');
  const name=(file.name||'image').replace(/[^\w. ()-]/g,'_').slice(0,160)||'image';
  const path=`${org}/${kind}/${randomUUID()}.${type.ext}`;
  const service=emailServiceDb();
  const {error:upload}=await service.storage.from(bucket).upload(path,bytes,{contentType:type.mime,upsert:false,cacheControl:'3600'});
  if(upload)throw new Error(`Image upload failed. Confirm Migration 018 and Storage bucket exist. ${upload.message}`);
  const {data:{publicUrl}}=service.storage.from(bucket).getPublicUrl(path);
  try{
   const {error}=await service.from('charis_media_assets').insert({organization_id:org,file_name:name,object_path:path,public_url:publicUrl,mime_type:type.mime,bytes:file.size,created_by:user.id});
   if(error)throw new Error(error.message);
   if(kind!=='media'){
    const column=kind==='logo'?'logo_path':'favicon_url';
    const {data,error:updateError}=await service.from('organization_branding').update({[column]:publicUrl,updated_at:new Date().toISOString()}).eq('organization_id',org).select('organization_id').maybeSingle();
    if(updateError||!data)throw new Error('Brand identity record not found. Save company branding first.');
   }
   const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:`brand.${kind}.uploaded`,entity_type:'charis_media_asset',entity_id:path});
   if(audit)throw new Error('Upload saved but audit logging failed. Check the audit log.');
  }catch(e){
   // The image may already be referenced by the branding record; do not delete it blindly.
   const {data:brand}=await service.from('organization_branding').select('logo_path,favicon_url').eq('organization_id',org).maybeSingle();
   if(brand?.logo_path!==publicUrl&&brand?.favicon_url!==publicUrl){await service.storage.from(bucket).remove([path]);await service.from('charis_media_assets').delete().eq('object_path',path).eq('organization_id',org);}
   throw e;
  }
  revalidateTag('charis-brand-assets');
  revalidatePath('/dashboard/branding');revalidatePath('/dashboard');revalidatePath('/');
  return {success:`${kind==='media'?'Media image':kind==='favicon'?'Browser icon':'Logo'} uploaded successfully.`};
 }catch(e){return {error:e instanceof Error?e.message:'Upload failed.'};}
}
export async function removeCharisMedia(_:MediaResult,form:FormData):Promise<MediaResult>{
 try{
  const org=orgSchema.parse(form.get('organization_id'));
  const id=orgSchema.parse(form.get('asset_id'));
  const user=await allowedEditor(org);
  const service=emailServiceDb();
  const {data:asset,error}=await service.from('charis_media_assets').select('object_path,public_url').eq('id',id).eq('organization_id',org).maybeSingle();
  if(error||!asset)throw new Error('Image not found in Charis media.');
  const {data:branding}=await service.from('organization_branding').select('logo_path,favicon_url').eq('organization_id',org).maybeSingle();
  if(branding?.logo_path===asset.public_url||branding?.favicon_url===asset.public_url)throw new Error('This image is your active logo or favicon. Replace it before removing it.');
  const {error:remove}=await service.storage.from(bucket).remove([asset.object_path]);
  if(remove)throw new Error('Cannot remove the stored image. Please retry.');
  const {error:del}=await service.from('charis_media_assets').delete().eq('id',id).eq('organization_id',org);
  if(del)throw new Error('Image removed from Storage but media index could not be updated.');
  const {error:audit}=await service.from('audit_logs').insert({organization_id:org,actor_id:user.id,action:'brand.media.removed',entity_type:'charis_media_asset',entity_id:id});
  if(audit)throw new Error('Image removed, but audit logging failed.');
  revalidatePath('/dashboard/branding');return {success:'Image removed from media library.'};
 }catch(e){return {error:e instanceof Error?e.message:'Unable to remove media.'};}
}
