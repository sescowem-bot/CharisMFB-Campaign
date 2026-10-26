import {escapeHtml,mailbox} from './validation.ts';

/** Human-written single-client business correspondence, not bulk email. */
export function formatZohoManualLetter(subject:string,body:string){
 const safeSubject=subject.trim();
 const safeBody=body.trim().replace(/\r\n?/g,'\n');
 if(safeSubject.length<3||safeSubject.length>160)throw Error('Enter an email subject between 3 and 160 characters.');
 if(safeBody.length<10||safeBody.length>4000)throw Error('Write a message between 10 and 4,000 characters.');
 const paragraphs=safeBody.split(/\n\n+/).map(p=>'<p style="margin:0 0 16px;line-height:1.65">'+escapeHtml(p).replace(/\n/g,'<br>')+'</p>').join('');
 return {subject:safeSubject,text:safeBody,
  html:'<!doctype html><html><body style="margin:0;padding:24px;background:#f6f4fa;font-family:Arial,sans-serif;color:#211938"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e7e1f0;border-radius:12px;padding:30px"><div style="border-bottom:3px solid #40239a;padding-bottom:14px;margin-bottom:24px;font-size:18px;font-weight:bold;color:#40239a">Charis Microfinance Bank</div>'+paragraphs+'<p style="margin-top:26px;font-size:12px;color:#675e7b">Sent personally by an authorised Charis staff member. Please reply to this email if you need further assistance.</p></div></body></html>'};
}
export function validateZohoManualRecipient(value:string,sender:string){
 const to=mailbox(value);const from=mailbox(sender);
 if(to===from)throw Error('For a self-test use the Test my mailbox button instead.');
 return to;
}
