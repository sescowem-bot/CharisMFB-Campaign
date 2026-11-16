import {redirect} from 'next/navigation';
/** Sender identities are now managed centrally for SendByte, Resend and Brevo. */
export default function Senders(){
 redirect('/admin/providers');
}
