import 'server-only';
import {domainName} from './validation';

/**
 * Domain discovery uses the Resend API key on the server only.
 * The returned names are available to authenticated Charis sender administrators;
 * provider IDs and API credentials are never accepted from the browser.
 */
export type VerifiedResendDomain = {domain:string;providerId:string};
export async function listVerifiedResendDomains():Promise<VerifiedResendDomain[]> {
 const key=process.env.RESEND_API_KEY;
 if(!key)throw new Error('Resend is not configured. Set RESEND_API_KEY in Vercel.');
 const domains:VerifiedResendDomain[]=[];
 let after:string|undefined;
 for(let page=0;page<5;page++){
  const url=new URL('https://api.resend.com/domains');url.searchParams.set('limit','100');
  if(after)url.searchParams.set('after',after);
  let response:Response;
  try{response=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(15000)});}
  catch{throw new Error('Could not reach Resend. Please try again later.');}
  if(!response.ok)throw new Error(response.status===403?'Resend key cannot access domains. Check the API key permissions.':`Resend domain lookup failed (${response.status}).`);
  const data=await response.json() as {data?:Array<{id?:string;name?:string;status?:string;capabilities?:{sending?:string}}> ;has_more?:boolean};
  const rows=Array.isArray(data.data)?data.data:[];
  for(const row of rows){
   if(row.status!=='verified'||row.capabilities?.sending!=='enabled'||typeof row.id!=='string'||!row.id||typeof row.name!=='string')continue;
   try{domains.push({domain:domainName(row.name),providerId:row.id});}catch{/* ignore an invalid provider domain */}
  }
  if(!data.has_more)break;
  if(!rows.length||!rows[rows.length-1]?.id)throw new Error('Resend returned an incomplete domain list. Try again later.');
  after=rows[rows.length-1].id;
  if(page===4)throw new Error('Resend has too many domains to display safely. Contact your technical administrator.');
 }
 return domains.sort((a,b)=>a.domain.localeCompare(b.domain));
}
