import 'server-only';
import {normalizeZohoContacts, normalizeZohoLists, dedupeZohoContacts} from './contact-sync-core.mjs';

type ZohoList = {list_key:string;name:string;contact_count:number;lock_status:string;is_public:boolean};
type ZohoContact = {list_key:string;list_name:string;email:string;first_name:string;last_name:string;phone:string;zoho_contact_id:string;status:string;list_keys:string[];list_names:string[]};
function region(){const r=(process.env.ZOHO_REGION||'com').toLowerCase();if(!/^(com|eu|in|com\.au|ca|jp|sa|com\.cn)$/.test(r))throw new Error('ZOHO_REGION is invalid.');return r;}
function config(){if(process.env.ZOHO_CAMPAIGNS_ENABLED!=='true')throw new Error('Zoho Campaigns integration is disabled.');for(const k of ['ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET','ZOHO_REFRESH_TOKEN'])if(!process.env[k])throw new Error(`Missing ${k}.`);const r=region();return {accounts:`https://accounts.zoho.${r}`,campaigns:`https://campaigns.zoho.${r}`};}
async function accessToken(){
 const c=config();
 const body=new URLSearchParams({
  grant_type:'refresh_token',
  client_id:process.env.ZOHO_CLIENT_ID!,
  client_secret:process.env.ZOHO_CLIENT_SECRET!,
  refresh_token:process.env.ZOHO_REFRESH_TOKEN!
 });
 let res:Response;
 try{
  res=await fetch(`${c.accounts}/oauth/v2/token`,{
   method:'POST',
   headers:{'content-type':'application/x-www-form-urlencoded'},
   body,cache:'no-store',signal:AbortSignal.timeout(15000)
  });
 }catch{
  throw new Error(`Could not reach Zoho OAuth at accounts.zoho.${process.env.ZOHO_REGION||'com'}. Check network access and the configured Zoho region.`);
 }
 const data=await res.json().catch(()=>({})) as {access_token?:unknown;error?:unknown};
 if(!res.ok||!data.access_token){
  const rawCode=typeof data.error==='string'?data.error:'no_access_token';
  const code=/^[a-zA-Z0-9_.-]{1,80}$/.test(rawCode)?rawCode:'unrecognised_oauth_error';
  throw new Error(`Zoho OAuth rejected the refresh-token request (HTTP ${res.status}, code: ${code}). Verify that the client ID, client secret and refresh token belong to the same Zoho Self Client and that its OAuth scopes are valid for the configured region.`);
 }
 return String(data.access_token);
}
async function api(path:string,params:Record<string,string>,token:string){const c=config();const q=new URLSearchParams({...params,resfmt:'JSON'});const res=await fetch(`${c.campaigns}/api/v1.1/${path}?${q}`,{headers:{Authorization:`Zoho-oauthtoken ${token}`},cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await res.json().catch(()=>({}));if(!res.ok||String(data.code??'0')!=='0'||String(data.status??'success').toLowerCase()==='error')throw new Error(`Zoho request failed for ${path}. Verify API access and the requested mailing list.`);return data;}
export async function fetchZohoContactSnapshot(){const token=await accessToken();const raw=await api('getmailinglists',{sort:'asc',fromindex:'1',range:'200'},token);const lists:ZohoList[]=normalizeZohoLists(raw);if(!lists.length)throw new Error('Zoho returned no readable mailing lists. Confirm the contact.READ scope and that the account has lists.');const all:Omit<ZohoContact,'list_keys'|'list_names'>[]=[];for(const list of lists){for(const status of ['active','unsub','bounce']){for(let from=1;from<=10000;from+=200){const data=await api('getlistsubscribers',{listkey:list.list_key,sort:'asc',fromindex:String(from),range:'200',status},token);all.push(...normalizeZohoContacts(data,list,status==='unsub'?'unsubscribe':status));if(normalizeZohoContacts(data,list,status).length<200)break;}}}return {lists,contacts:dedupeZohoContacts(all)};}
