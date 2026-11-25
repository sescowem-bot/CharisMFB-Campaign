import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {currentAccount} from "@/lib/auth/account";
import {supabaseServer} from "@/lib/supabase/server";
import {emailServiceDb} from "@/lib/email/server";
import {optimizeCampaignMedia} from "@/lib/campaign/media-processing";
export const runtime="nodejs";
export const maxDuration=30;
const bucket="charis-brand-assets";
function validSource(bytes:Uint8Array){return (bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))||(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP");}
export async function POST(request:Request){
 try{
  const account=await currentAccount();if(!account)return NextResponse.json({error:"Sign in to upload campaign images."},{status:401});
  const db=await supabaseServer();const {data:allowed,error:permissionError}=await db.rpc("charis_direct_can_send",{p_org:account.workspace.id});
  if(permissionError||allowed!==true)return NextResponse.json({error:"You do not have permission to create campaigns."},{status:403});
  const form=await request.formData(),file=form.get("asset");
  if(!(file instanceof File)||file.size<1||file.size>2*1024*1024)return NextResponse.json({error:"Choose a PNG, JPG or WebP image smaller than 2 MB."},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());if(!validSource(bytes))return NextResponse.json({error:"This file is not a valid PNG, JPG or WebP image."},{status:400});
  const processed=await optimizeCampaignMedia(bytes,"none");
  const org=account.workspace.id,path=org+"/media/"+randomUUID()+"."+processed.ext,service=emailServiceDb();
  const {error:uploadError}=await service.storage.from(bucket).upload(path,processed.bytes,{contentType:processed.mime,upsert:false,cacheControl:"3600"});
  if(uploadError)return NextResponse.json({error:"Image upload failed. Please try again."},{status:503});
  const {data:{publicUrl}}=service.storage.from(bucket).getPublicUrl(path);
  const fileName=(file.name||"campaign-image").replace(/[^\w. ()-]/g,"_").slice(0,160)||"campaign-image";
  const {data:asset,error:insertError}=await service.from("charis_media_assets").insert({organization_id:org,file_name:fileName,object_path:path,public_url:publicUrl,mime_type:processed.mime,bytes:processed.bytes.length,created_by:account.id}).select("id,file_name,public_url").single();
  if(insertError){await service.storage.from(bucket).remove([path]);return NextResponse.json({error:"Image could not be added to the campaign library."},{status:503});}
  const {error:auditError}=await service.from("audit_logs").insert({organization_id:org,actor_id:account.id,action:"campaign.media.uploaded",entity_type:"charis_media_asset",entity_id:asset.id});
  if(auditError){await service.from("charis_media_assets").delete().eq("organization_id",org).eq("id",asset.id);await service.storage.from(bucket).remove([path]);return NextResponse.json({error:"Image upload could not be audited. Please try again."},{status:503});}
  return NextResponse.json({asset},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to upload image."},{status:400});}
}
