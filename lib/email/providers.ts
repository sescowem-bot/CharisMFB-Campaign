import type {Provider} from './validation.ts';
import {domainName, mailbox, senderName, matchesDomain} from './validation.ts';
export type DnsRecord = {type:string;name:string;value:string;status:string;priority?:number};
export type DomainState = {id:string;domain:string;verified:boolean;records:DnsRecord[]};
type Json = Record<string, unknown>;
const obj = (v:unknown):Json => v && typeof v==='object' && !Array.isArray(v) ? v as Json : {};
export function normalizeDomain(provider:Provider, raw:unknown, expected:string, id?:string):DomainState {
  const data=obj(raw);
  const domain=domainName(String(data.name ?? data.domain ?? data.domain_name ?? ''));
  if(domain!==domainName(expected)) throw new Error('Provider returned a different domain.');
  const providerId=String(data.id ?? id ?? '');
  if(!providerId || providerId.length>200) throw new Error('Provider domain identifier missing.');
  const records:DnsRecord[]=[];
  if(provider==='resend') {
    for(const item of Array.isArray(data.records)?data.records:[]) {
      const r=obj(item); records.push({type:String(r.type??''),name:String(r.name??''),value:String(r.value??''),status:String(r.status??'pending'),...(typeof r.priority==='number'?{priority:r.priority}:{})});
    }
  } else {
    for(const r of Object.values(obj(data.dns_records)).map(obj)) records.push({type:String(r.type??''),name:String(r.host_name??''),value:String(r.value??''),status:r.status===true?'verified':'pending'});
  }
  return {id:providerId,domain,records,verified:provider==='resend'?data.status==='verified' && obj(data.capabilities).sending==='enabled':data.verified===true && data.authenticated===true};
}
/** Fixed endpoints, no arbitrary URLs, no automatic retries of external mutations. */
export function providerAdapter(provider:Provider,key:string,transport:typeof fetch=fetch) {
  if(!key) throw new Error('Provider credentials are not configured.');
  const base=provider==='resend'?'https://api.resend.com':provider==='brevo'?'https://api.brevo.com/v3':'https://api.mailjet.com';
  const mailjetSecret=process.env.MAILJET_SECRET_KEY||'';
  if(provider==='mailjet'&&!mailjetSecret)throw new Error('Mailjet secret key is not configured.');
  async function request(path:string,method='GET',body?:unknown):Promise<Json> {
    let response:Response;
    try { response=await transport(base+path,{method,headers:{'Content-Type':'application/json',...(provider==='resend'?{Authorization:`Bearer ${key}`}:provider==='brevo'?{'api-key':key}:{Authorization:`Basic ${Buffer.from(key+':'+mailjetSecret).toString('base64')}`})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(15000)}); }
    catch { throw new Error('Provider connection failed. The operation may have completed; check its status before retrying.'); }
    if(!response.ok) throw new Error(response.status===429?'Provider rate limit reached. Try again later.':`Provider request failed (${response.status}). Check the provider dashboard.`);
    return obj(await response.json().catch(()=>({})));
  }
  const path=(domain:string,id:string)=>provider==='resend'?`/domains/${encodeURIComponent(id)}`:`/senders/domains/${encodeURIComponent(domainName(domain))}`;
  return {
    /** Brevo sender must be active and its domain independently verified. */
    async findVerifiedBrevoSender(email:string) {
      if(provider!=='brevo')throw new Error('Only Brevo supports this sender check.');
      const value=mailbox(email);
      const list=await request('/senders');
      const rows=Array.isArray(list.senders)?list.senders:[];
      const sender=rows.map(obj).find(item=>String(item.email||'').toLowerCase()===value && item.active===true);
      if(!sender)throw new Error('This address is not an active Brevo sender. Verify it in your Brevo account.');
      const domain=value.split('@')[1];
      const state=normalizeDomain('brevo',await request(`/senders/domains/${encodeURIComponent(domain)}`),domain,domain);
      if(!state.verified)throw new Error('Brevo domain authentication is incomplete.');
      return {email:value,domain:state.domain,id:state.id};
    },
    /** Mailjet must have already validated a sending mailbox. */
    async findVerifiedMailjetSender(email:string) {
      if(provider!=='mailjet')throw new Error('Only Mailjet supports this sender check.');
      const value=mailbox(email);
      const list=await request('/v3/REST/sender?Limit=100');
      const rows=Array.isArray(list.Data)?list.Data:[];
      const sender=rows.map(obj).find(item=>String(item.Email||'').toLowerCase()===value&&String(item.Status||'').toLowerCase()==='active');
      if(!sender||!sender.ID)throw new Error('This email is not an active, verified Mailjet sender. Check Mailjet sender validation.');
      return {id:String(sender.ID),email:value};
    },
    async create(domain:string) { if(provider==='mailjet')throw new Error('Verify this domain in Mailjet first; Charis does not automatically register Mailjet DNS.'); const name=domainName(domain); const data=await request(provider==='resend'?'/domains':'/senders/domains','POST',{name}); return normalizeDomain(provider,data,name); },
    async check(domain:string,id:string,trigger=false) {
      if(!id) throw new Error('Provider domain registration needs administrator reconciliation.');
      if(provider==='mailjet'){
        const details=await request(`/v3/REST/sender/${encodeURIComponent(id)}`);
        const senders=Array.isArray(details.Data)?details.Data:[];
        const sender=obj(senders[0]);
        const email=String(sender.Email||'').toLowerCase();
        const active=String(sender.Status||'').toLowerCase()==='active';
        if(!active||!email.endsWith('@'+domainName(domain)))throw new Error('Mailjet sender is not verified for the expected domain.');
        return {id:String(sender.ID||id),domain:domainName(domain),verified:true,records:[]};
      }
      if(trigger) await request(path(domain,id)+(provider==='resend'?'/verify':'/authenticate'),provider==='resend'?'POST':'PUT');
      return normalizeDomain(provider,await request(path(domain,id)),domain,id);
    },
    async health() { await request(provider==='resend'?'/domains?limit=1':provider==='brevo'?'/account':'/v3/REST/sender?Limit=1'); },
    async registerSender(name:string,email:string) {
      if(provider==='resend'||provider==='mailjet') return;
      await request('/senders','POST',{name:senderName(name),email:mailbox(email)});
    },
    async sendTest(input:{name:string;email:string;replyTo:string;to:string;domain:string;html:string;attempt:string;subject?:string}) {
      if(!matchesDomain(input.email,input.domain)) throw new Error('Sender address must match the verified domain.');
      const name=senderName(input.name),email=mailbox(input.email),to=mailbox(input.to),replyTo=mailbox(input.replyTo);
      const subject=input.subject??'Sender configuration test';
      if(!subject.trim()||subject.length>207||/[\r\n]/.test(subject))throw new Error('Invalid test email subject.');
      const body=provider==='resend'?{from:`${name} <${email}>`,to:[to],reply_to:replyTo,subject,html:input.html}:provider==='brevo'?{sender:{name,email},to:[{email:to}],replyTo:{email:replyTo},subject,htmlContent:input.html,headers:{'X-Charis-Test-ID':input.attempt}}:{Messages:[{From:{Email:email,Name:name},To:[{Email:to}],ReplyTo:{Email:replyTo},Subject:subject,HTMLPart:input.html,CustomID:input.attempt}]};
      const result=await request(provider==='resend'?'/emails':provider==='brevo'?'/smtp/email':'/v3.1/send','POST',body);
      const replies=Array.isArray(result.Messages)?result.Messages as {Status?:string;To?:{MessageID?:number|string}[]}[]:[];
      const id=provider==='mailjet'?String(replies[0]?.Status==='success'?replies[0]?.To?.[0]?.MessageID??'':''):String(result.id??result.messageId??'');
      if(!id) throw new Error('Provider acknowledgement missing. Check its dashboard before retrying.');
      return id;
    }
  };
}
