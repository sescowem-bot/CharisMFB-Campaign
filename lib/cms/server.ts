import 'server-only';
import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {publicContent,pageDefault,type PageContent,type SiteContent} from './content';
export const publishedContent=cache(async(slug:string)=>{
 const single=process.env.SINGLE_COMPANY_MODE==='true';
 // Charis is a dedicated staff application. Ignore old multi-tenant public marketing content.
 if(single&&slug!=='site')return pageDefault(slug);
 let value:unknown=null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(url&&key)try{const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});const {data,error}=await db.rpc('cms_public',{p_slug:slug});if(!error)value=data;}catch{/* Published source defaults keep routes available during setup/outages. */}
 const result=publicContent(slug,value);
 if(single&&slug==='site'){const base=result as SiteContent;const logo=process.env.CHARIS_LOGO_URL||'';const logoUrl=logo.startsWith('https://')&&!logo.includes('@')?logo:'';return {...base,display_name:'Charis Campaign Centre',tagline:'Secure customer communications for Charis Microfinance Bank',operator_name:'Charis Microfinance Bank',footer_text:'For authorised Charis Microfinance Bank staff only.',nav:[{label:'Home',href:'/'},{label:'Help',href:'/faq'}],primary_color:'#12345A',logo_url:logoUrl} as SiteContent;}
 return result;
});
export async function publishedSite(){return await publishedContent('site') as SiteContent;}
export async function publishedPage(slug:string){return await publishedContent(slug) as PageContent;}
