/**
 * One human-invoked SMTP verification / self-test. No contact lists, no arbitrary
 * recipients, no batch sending, no admin mailbox credentials.
 * Run with env loaded from .env.local (never commit that file).
 */
import nodemailer from 'nodemailer';
const host=(process.env.ZOHO_SMTP_HOST||'').trim().toLowerCase();
const user=(process.env.ZOHO_SMTP_USER||'').trim().toLowerCase();
const password=process.env.ZOHO_SMTP_APP_PASSWORD||'';
const port=Number(process.env.ZOHO_SMTP_PORT||465);
const allowed=new Set(['smtp.zoho.com','smtppro.zoho.com','smtp.zoho.eu','smtppro.zoho.eu','smtp.zoho.in','smtppro.zoho.in','smtp.zoho.com.au','smtppro.zoho.com.au','smtp.zoho.ca','smtppro.zoho.ca','smtp.zoho.jp','smtppro.zoho.jp','smtp.zoho.sa','smtppro.zoho.sa','smtp.zoho.com.cn','smtppro.zoho.com.cn']);
if(!allowed.has(host)||![465,587].includes(port)||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user)||password.length<8) {
 console.error('Configure ZOHO_SMTP_HOST, ZOHO_SMTP_PORT, ZOHO_SMTP_USER and ZOHO_SMTP_APP_PASSWORD in .env.local.');
 process.exit(1);
}
const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,
 tls:{minVersion:'TLSv1.2',servername:host},auth:{user,pass:password},
 connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,pool:false});
try{
 await transport.verify();
 console.log('Zoho accepted the SMTP authentication for your own mailbox. No message sent during verification.');
 if(process.argv.includes('--send-to-self')){
  // Explicit, single staff self-test only; recipient and sender are identical.
  const result=await transport.sendMail({
   from:{name:'Charis Mailbox SMTP Check',address:user},
   to:user,subject:'Zoho SMTP personal mailbox check',
   text:'This is one manually requested test email sent to your own Charis staff mailbox. No customer messages were sent.',
   disableFileAccess:true,disableUrlAccess:true
  });
  console.log(result.accepted?.includes(user)?'Self-test accepted by Zoho. Check your own Inbox or Spam.':'Zoho did not confirm accepting the self-test. Check your mailbox and SMTP account activity.');
 }
}catch(error){
 const e=error||{};
 if(e.code==='EAUTH'||[530,534,535].includes(e.responseCode))console.error('Zoho rejected the login. Use your own app-specific password and check SMTP access.');
 else if(['ETIMEDOUT','ECONNECTION','ESOCKET'].includes(e.code))console.error('Unable to connect securely. Check the Zoho host, port and network.');
 else console.error('Zoho SMTP check failed. Verify the mailbox settings and use the exact Zoho SMTP server.');
 process.exitCode=1;
}finally{transport.close();}
