import 'server-only';
import nodemailer from 'nodemailer';
import {zeptoConfig} from '@/lib/email/zeptomail';
export function zeptoNotificationBatchReady():boolean{
 if(process.env.ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED!=='true')return false;
 try{zeptoConfig(process.env);return true;}catch{return false;}
}
type Mail={to:string;subject:string;text:string;html:string;unsubscribe?:string};
// One pooled SMTP connection set is reused by every recipient in a burst (no new TLS handshake per email).
let pooled:{key:string;transport:nodemailer.Transporter}|null=null;
function pooledTransport(cfg:ReturnType<typeof zeptoConfig>){
 const key=[cfg.username,cfg.password,cfg.port].join('|');
 if(pooled?.key===key)return pooled.transport;
 pooled?.transport.close();
 const transport=nodemailer.createTransport({
  host:'smtp.zeptomail.com',port:cfg.port,secure:cfg.port===465,requireTLS:cfg.port===587,
  pool:true,maxConnections:5,maxMessages:200,
  auth:{user:cfg.username,pass:cfg.password},
  tls:{minVersion:'TLSv1.2',servername:'smtp.zeptomail.com'},
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000
 });
 pooled={key,transport};return transport;
}
export async function sendZeptoNotification(mail:Mail):Promise<{status:'accepted'|'unknown';reason:string;providerId:string|null}>{
 if(!zeptoNotificationBatchReady())throw Error('zeptomail_notification_batch_disabled');
 const cfg=zeptoConfig(process.env),transport=pooledTransport(cfg);
 try{
  const result=await transport.sendMail({
   from:{name:'Charis Microfinance Bank',address:cfg.from},to:mail.to,replyTo:cfg.from,
   subject:mail.subject,text:mail.text,html:mail.html,disableFileAccess:true,disableUrlAccess:true,
   ...(mail.unsubscribe&&/^https:\/\//.test(mail.unsubscribe)?{headers:{'List-Unsubscribe':`<${mail.unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})
  });
  if(!result.accepted?.some(value=>(typeof value==='string'?value:value.address).toLowerCase()===mail.to.toLowerCase()))
   return {status:'unknown',reason:'zeptomail_acceptance_unconfirmed',providerId:result.messageId||null};
  return {status:'accepted',reason:'zeptomail_smtp_accepted',providerId:result.messageId||null};
 }catch{
  // SMTP timeouts can occur after acceptance. Never automatically replay an uncertain send.
  return {status:'unknown',reason:'zeptomail_transport_outcome_uncertain',providerId:null};
 }
}
