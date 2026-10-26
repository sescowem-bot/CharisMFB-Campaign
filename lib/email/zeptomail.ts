import 'server-only';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import {mailbox,escapeHtml} from './validation.ts';

export type ZeptoConfig={from:string;password:string;port:465|587;username:string};
export function zeptoConfig(env:Record<string,string|undefined>):ZeptoConfig{
 const from=mailbox(env.ZEPTOMAIL_FROM_EMAIL||'');
 if(from.split('@')[1]!=='charismfb.com')throw Error('Configure an approved sender at charismfb.com.');
 const password=env.ZEPTOMAIL_SMTP_PASSWORD||'';
 if(password.length<10||password.length>2048)throw Error('Configure the private SMTP password from the ZeptoMail Mail Agent.');
 const port=Number(env.ZEPTOMAIL_SMTP_PORT||465);
 if(port!==465&&port!==587)throw Error('ZeptoMail SMTP port must be 465 or 587.');
 const username=(env.ZEPTOMAIL_SMTP_USERNAME||'emailapikey').trim();
 if(username!=='emailapikey'&&username.toLowerCase()!==from)throw Error('Use the SMTP username shown under the ZeptoMail Mail Agent.');
 return {from,password,port:port as 465|587,username};
}
export function zeptoTransport(cfg:ZeptoConfig){
 return nodemailer.createTransport({
  host:'smtp.zeptomail.com',port:cfg.port,secure:cfg.port===465,requireTLS:cfg.port===587,
  auth:{user:cfg.username,pass:cfg.password},
  tls:{minVersion:'TLSv1.2',servername:'smtp.zeptomail.com'},
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
 } satisfies SMTPTransport.Options);
}
export function zeptoSafeError(err:unknown){
 const v=err as {code?:string;responseCode?:number};
 if(v?.code==='EAUTH'||[530,534,535].includes(v?.responseCode||0))return 'ZeptoMail rejected this SMTP login. Check the Mail Agent token, sender verification and account permissions.';
 if(['ETIMEDOUT','ECONNECTION','ESOCKET'].includes(v?.code||''))return 'The secure ZeptoMail SMTP connection could not be established. Check your Mail Agent setup.';
 return 'ZeptoMail could not confirm the message. Check your ZeptoMail Mail Agent logs before trying again.';
}
import {zeptoPurposes} from './zeptomail-options.ts';
export type ZeptoPurpose=typeof zeptoPurposes[number]['value'];
export function zeptoLetter(subject:string,body:string,purpose:ZeptoPurpose){
 if(!zeptoPurposes.some(v=>v.value===purpose))throw Error('Choose an eligible customer-specific notification type.');
 const sub=subject.trim(),txt=body.trim().replace(/\r\n?/g,'\n');
 if(sub.length<5||sub.length>160||txt.length<20||txt.length>4000)throw Error('Enter a subject (5–160 characters) and message (20–4,000 characters).');
 const paras=txt.split(/\n\n+/).map(p=>'<p style="margin:0 0 15px;line-height:1.65">'+escapeHtml(p).replace(/\n/g,'<br>')+'</p>').join('');
 return {subject:sub,text:txt,html:'<!doctype html><html><body style="background:#f6f4fb;padding:24px;font-family:Arial,sans-serif;color:#241a35"><main style="max-width:620px;background:white;margin:auto;padding:27px;border-top:4px solid #40239a"><h2 style="font-size:17px;color:#40239a">Charis Microfinance Bank</h2>'+paras+'<p style="font-size:12px;color:#655b78;margin-top:26px">A service message relating to your banking relationship. For help, reply to this email.</p></main></body></html>'};
}
