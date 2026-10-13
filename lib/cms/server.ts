import 'server-only';
import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {publicContent,pageDefault,type PageContent,type SiteContent} from './content';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
export const publishedContent=cache(async(slug:string)=>{
 const single=process.env.SINGLE_COMPANY_MODE==='true';
 // Charis is a dedicated staff application. Ignore old multi-tenant public marketing content.
 if(single&&slug!=='site')return pageDefault(slug);
 // Dedicated bank: don't call the legacy public multi-tenant CMS RPC for every screen.
 if(single&&slug==='site'){
  const base=publicContent('site',null) as SiteContent;
  const assets=await charisBrandAssets();
  return {...base,display_name:'Charis Campaign Centre',tagline:'Customer communications for Charis Microfinance Bank Ltd',operator_name:'Charis Microfinance Bank Ltd',footer_text:'For authorised staff use only.',nav:[{label:'Home',href:'/'},{label:'Help',href:'/faq'}],primary_color:'#40208F',logo_url:assets.logo} as SiteContent;
 }
 let value:unknown=null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(url&&key)try{const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});const {data,error}=await db.rpc('cms_public',{p_slug:slug});if(!error)value=data;}catch{/* Published source defaults keep routes available during setup/outages. */}
 const result=publicContent(slug,value);
 return result;
});
export async function publishedSite(){return await publishedContent('site') as SiteContent;}
export async function publishedPage(slug:string){return await publishedContent(slug) as PageContent;}
