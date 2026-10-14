import 'server-only';
import {cache} from 'react';
import {publicContent,pageDefault,type PageContent,type SiteContent} from './content';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
/** Historic local policy text is preserved for public legal URLs. */
export const publishedContent=cache(async(slug:string)=>{
 if(slug!=='site')return pageDefault(slug);
 const base=publicContent('site',null) as SiteContent;
 const assets=await charisBrandAssets();
 return {...base,display_name:'Charis Customer Communications Centre',tagline:'Internal bank communications',operator_name:'Charis Microfinance Bank Ltd',footer_text:'Authorised use only.',nav:[{label:'Workspace',href:'/dashboard'},{label:'Help',href:'/dashboard/help'}],primary_color:'#40239A',logo_url:assets.logo} as SiteContent;
});
export async function publishedSite(){return await publishedContent('site') as SiteContent;}
export async function publishedPage(slug:string){return await publishedContent(slug) as PageContent;}
