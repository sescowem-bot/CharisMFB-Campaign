import 'server-only';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import {mailbox} from './validation.ts';

const zohoHosts=new Set([
 'smtp.zoho.com','smtppro.zoho.com',
 'smtp.zoho.eu','smtppro.zoho.eu',
 'smtp.zoho.in','smtppro.zoho.in',
 'smtp.zoho.com.au','smtppro.zoho.com.au',
 'smtp.zoho.ca','smtppro.zoho.ca',
 'smtp.zoho.jp','smtppro.zoho.jp',
 'smtp.zoho.sa','smtppro.zoho.sa',
 'smtp.zoho.com.cn','smtppro.zoho.com.cn',
]);
export type ZohoStaffConfig={host:string;port:465|587;user:string;password:string};

/** Own-mailbox configuration only; credentials must never be accepted from a browser form. */
export function zohoStaffConfig(env:Record<string,string|undefined>):ZohoStaffConfig {
 const host=(env.ZOHO_SMTP_HOST||'').trim().toLowerCase();
 const port=Number(env.ZOHO_SMTP_PORT||465);
 const user=mailbox(env.ZOHO_SMTP_USER||'');
 const password=env.ZOHO_SMTP_APP_PASSWORD||'';
 if(!zohoHosts.has(host))throw Error('Use the exact Zoho SMTP host shown in your mailbox settings.');
 if(port!==465&&port!==587)throw Error('Zoho SMTP must use port 465 or 587.');
 if(password.length<8||password.length>256)throw Error('Configure a Zoho app-specific password securely.');
 return {host,port:port as 465|587,user,password};
}
export function zohoStaffTransport(config:ZohoStaffConfig){
 return nodemailer.createTransport({
  host:config.host,
  port:config.port,
  secure:config.port===465,
  requireTLS:config.port===587,
  auth:{user:config.user,pass:config.password},
  tls:{minVersion:'TLSv1.2',servername:config.host},
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
 } satisfies SMTPTransport.Options);
}
/** This performs SMTP authentication, but DOES NOT transmit email. */
export async function verifyZohoStaffSmtp(config:ZohoStaffConfig){
 const transport=zohoStaffTransport(config);
 try{await transport.verify();}
 finally{transport.close();}
}
export function safeZohoError(error:unknown):string{
 const err=error as {code?:string;responseCode?:number};
 if(err?.code==='EAUTH'||[534,535,530].includes(err?.responseCode||0))
  return 'Zoho rejected SMTP authentication. Check your exact mailbox address and app-specific password, or ask the mail administrator whether SMTP is allowed.';
 if(err?.code==='ETIMEDOUT'||err?.code==='ECONNECTION')
  return 'Zoho could not be reached. Check the SMTP host, port and network connection.';
 if(err?.code==='ESOCKET')return 'The secure SMTP connection could not be established. Check the Zoho host and SSL/TLS port.';
 return 'Zoho SMTP verification was unsuccessful. Check your mailbox SMTP settings.';
}
