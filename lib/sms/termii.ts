import 'server-only';

/** Pilot sending is restricted to one bank-approved Vercel-configured test number. */
const nigerianPhone=/^234[789]\d{9}$/;
export function smsTestConfigured(){
 const phone=String(process.env.CHARIS_SMS_TEST_NUMBER||'').replace(/^\+/,'');
 return Boolean(process.env.TERMII_API_KEY&&process.env.TERMII_SENDER_ID&&nigerianPhone.test(phone));
}
export async function sendTermiiStaffTest(text:string):Promise<{status:'accepted'|'failed'|'unknown';id?:string;message:string}>{
 const apiKey=process.env.TERMII_API_KEY;
 const sender=process.env.TERMII_SENDER_ID;
 const phone=String(process.env.CHARIS_SMS_TEST_NUMBER||'').replace(/^\+/,'');
 if(!apiKey||!sender||!nigerianPhone.test(phone))throw new Error('SMS is not configured. Ask the administrator to set Termii credentials and a test number in Vercel.');
 if(!/^[A-Za-z0-9 ]{3,11}$/.test(sender))throw new Error('The SMS sender ID must be 3–11 approved letters or digits.');
 if(text.trim().length<1||text.length>480)throw new Error('SMS text must be 1–480 characters.');
 const url=process.env.TERMII_API_BASE_URL||'https://api.ng.termii.com';
 if(!/^https:\/\/[a-z0-9.-]+$/.test(url))throw new Error('Invalid SMS provider base URL');
 const body={to:phone,from:sender,sms:text,type:'plain',channel:'dnd',api_key:apiKey};
 let response:Response;
 try{response=await fetch(`${url}/api/sms/send`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000),cache:'no-store'});}
 catch{return {status:'unknown',message:'Provider request timed out or the connection failed. Check Termii before retrying to avoid duplicate charges.'};}
 const result=await response.json().catch(()=>({})) as {message_id?:string;message?:string;code?:string};
 if(!response.ok)return {status:'failed',message:`Termii declined the test (HTTP ${response.status}). Review sender ID, balance and API permissions.`};
 if(!result.message_id)return {status:'unknown',message:'Termii response did not contain a message ID; review provider activity before retrying.'};
 return {status:'accepted',id:String(result.message_id),message:'Accepted by Termii. This is not proof that the recipient received the SMS.'};
}
