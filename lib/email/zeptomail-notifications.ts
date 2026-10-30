import 'server-only';
import {zeptoConfig,zeptoTransport} from '@/lib/email/zeptomail';
export function zeptoNotificationBatchReady():boolean{
 if(process.env.ZEPTOMAIL_NOTIFICATION_BATCH_ENABLED!=='true')return false;
 try{zeptoConfig(process.env);return true;}catch{return false;}
}
type Mail={to:string;subject:string;text:string;html:string};
export async function sendZeptoNotification(mail:Mail):Promise<{status:'accepted'|'unknown';reason:string;providerId:string|null}>{
 if(!zeptoNotificationBatchReady())throw Error('zeptomail_notification_batch_disabled');
 const cfg=zeptoConfig(process.env),transport=zeptoTransport(cfg);
 try{
  const result=await transport.sendMail({
   from:{name:'Charis Microfinance Bank',address:cfg.from},to:mail.to,replyTo:cfg.from,
   subject:mail.subject,text:mail.text,html:mail.html,disableFileAccess:true,disableUrlAccess:true
  });
  if(!result.accepted?.some(value=>(typeof value==='string'?value:value.address).toLowerCase()===mail.to.toLowerCase()))
   return {status:'unknown',reason:'zeptomail_acceptance_unconfirmed',providerId:result.messageId||null};
  return {status:'accepted',reason:'zeptomail_smtp_accepted',providerId:result.messageId||null};
 }catch{
  // SMTP timeouts can occur after acceptance. Never automatically replay an uncertain send.
  return {status:'unknown',reason:'zeptomail_transport_outcome_uncertain',providerId:null};
 }finally{transport.close();}
}
