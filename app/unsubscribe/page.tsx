export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
import {z} from 'zod';
import {PublicLayout} from '@/components/public';
export default async function Unsubscribe({searchParams}:{searchParams:Promise<{token?:string}>}) {
 const {token}=await searchParams;const valid=z.string().uuid().safeParse(token).success;
 return <PublicLayout label="EMAIL PREFERENCES" title="Stop promotional emails" subtitle="Choose to stop optional offers and promotions from Charis Microfinance Bank."><section className="shell section"><div className="contact-card">{valid?<form action={`/api/email/unsubscribe?token=${encodeURIComponent(token!)}`} method="post"><p>Stopping promotional messages does not close your Charis account. Important account and security notices may still be sent where legally permitted.</p><p>Opening this page does not change your preferences. Click below to confirm your choice.</p><button className="btn" type="submit">Stop promotional emails</button></form>:<p>Open the unsubscribe link in the email you received.</p>}</div></section></PublicLayout>;
}
