import 'server-only';
import {emailServiceDb} from '@/lib/email/server';
import type {Provider} from '@/lib/email/validation';

const supported=['resend','brevo','mailjet'] as const;
type SenderPreference={provider:Provider;sender_id:string;priority:number};
export type DirectReadiness={ready:boolean;reason:'ready'|'schema_missing'|'sender_missing'|'provider_disabled'|'configuration_unavailable';providers:SenderPreference[]};

/** Server-only preflight; never grant staff SELECT access to protected provider routes. */
export async function directEmailReadiness(org:string):Promise<DirectReadiness>{
 let db:ReturnType<typeof emailServiceDb>;
 try{db=emailServiceDb();}catch{return {ready:false,reason:'configuration_unavailable',providers:[]};}
 const [prefs,settings,eventStore]=await Promise.all([
  db.from('charis_direct_provider_prefs').select('provider,sender_id,priority').eq('organization_id',org).eq('enabled',true).order('priority',{ascending:true}),
  db.from('email_provider_settings').select('provider,enabled,daily_limit'),
  db.from('charis_direct_delivery_events_060').select('id',{head:true,count:'exact'}).limit(1)
 ]);
 if(eventStore.error)return {ready:false,reason:'schema_missing',providers:[]};
 if(prefs.error||settings.error)return {ready:false,reason:'configuration_unavailable',providers:[]};
 if(!prefs.data?.length)return {ready:false,reason:'sender_missing',providers:[]};
 const enabled=new Set((settings.data||[]).filter(p=>p.enabled&&p.daily_limit>0).map(p=>p.provider));
 const choices:SenderPreference[]=[];
 for(const pref of prefs.data){
  if(!supported.includes(pref.provider as typeof supported[number])||!enabled.has(pref.provider))continue;
  if(!process.env[pref.provider==='resend'?'RESEND_API_KEY':pref.provider==='brevo'?'BREVO_API_KEY':'MAILJET_API_KEY'])continue;
  if(pref.provider==='mailjet'&&!process.env.MAILJET_SECRET_KEY)continue;
  const {data:sender,error:senderError}=await db.from('sender_identities')
   .select('id,domain_id,is_active').eq('organization_id',org).eq('id',pref.sender_id).maybeSingle();
  if(senderError||!sender?.is_active)continue;
  const {data:domain,error:domainError}=await db.from('sending_domains')
   .select('provider,verification_status,charis_connected').eq('organization_id',org).eq('id',sender.domain_id).maybeSingle();
  if(domainError||!domain||domain.provider!==pref.provider||domain.verification_status!=='verified'||domain.charis_connected!==true)continue;
  choices.push({provider:pref.provider as Provider,sender_id:sender.id,priority:pref.priority});
 }
 return choices.length?{ready:true,reason:'ready',providers:choices}:{ready:false,reason:'provider_disabled',providers:[]};
}

/** A scheduler is useful only when its worker has successfully checked in recently. */
export async function directWorkerIsHealthy():Promise<boolean>{
 try{
  const {data,error}=await emailServiceDb().from('charis_worker_health_060').select('last_success_at').eq('id',true).maybeSingle();
  return !error&&!!data?.last_success_at&&Date.now()-new Date(data.last_success_at).getTime()<15*60_000;
 }catch{return false;}
}
