import 'server-only';
import {domainName} from './validation';
/** Only the server reads Resend domain IDs; bank staff enter domain names, not IDs. */
export async function findResendDomain(name:string):Promise<{id:string;name:string}|null>{
 const domain=domainName(name),key=process.env.RESEND_API_KEY;
 if(!key)throw new Error('RESEND_API_KEY is not configured in Vercel.');
 let after:string|undefined;
 for(let page=0;page<5;page++){
  const url=new URL('https://api.resend.com/domains');url.searchParams.set('limit','100');
  if(after)url.searchParams.set('after',after);
  const response=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===403?'Resend cannot list domains with this API key. Use a key with full access from the same Resend team as your verified domain.':`Resend domain lookup failed (${response.status}). Check the API key and connected Resend team.`);
  const result=await response.json() as {data?:{id?:string;name?:string}[];has_more?:boolean};
  const rows=Array.isArray(result.data)?result.data:[];
  for(const row of rows){if(row.id&&row.name){try{if(domainName(row.name)===domain)return {id:row.id,name:domain};}catch{/* disregard bad response row */}}}
  if(!result.has_more)return null;
  const last=rows[rows.length-1]?.id;if(!last)throw new Error('Resend returned incomplete pagination.');after=last;
 }
 throw new Error('Too many Resend domains; contact the technical administrator.');
}
