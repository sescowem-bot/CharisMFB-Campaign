import 'server-only';
import {emailServiceDb} from '@/lib/email/server';
export async function publicBankWebsite(){
 const org=process.env.SINGLE_COMPANY_ORG_ID;
 if(!org)return null;
 const {data}=await emailServiceDb().from('organization_branding').select('website_url').eq('organization_id',org).maybeSingle();
 if(!data?.website_url)return null;
 try{const url=new URL(data.website_url);return url.protocol==='https:'&& !url.username&&!url.password ? url.href:null;}catch{return null;}
}
