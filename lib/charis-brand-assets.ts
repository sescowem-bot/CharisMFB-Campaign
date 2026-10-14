import 'server-only';
import {cache} from 'react';
import {unstable_cache} from 'next/cache';
import {createClient} from '@supabase/supabase-js';

/** Public graphic URLs only; this module NEVER returns service credentials or customer data. */
const loadBrandAssets=unstable_cache(async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const org=process.env.SINGLE_COMPANY_ORG_ID;
 if(!url||!key||!org)return {logo:'',favicon:''};
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});
  const {data,error}=await db.from('organization_branding').select('logo_path,favicon_url').eq('organization_id',org).maybeSingle();
  if(error||!data)return {logo:'',favicon:''};
  const safe=(s:unknown)=>typeof s==='string'&&s.startsWith(`${url}/storage/v1/object/public/charis-brand-assets/`)?s:'';
  return {logo:safe(data.logo_path),favicon:safe(data.favicon_url)};
 }catch{return {logo:'',favicon:''};}
},['charis-brand-assets-v1'],{revalidate:300,tags:['charis-brand-assets']});
export const charisBrandAssets=cache(loadBrandAssets);
