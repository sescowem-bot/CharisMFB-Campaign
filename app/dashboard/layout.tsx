import {supabaseServer} from '@/lib/supabase/server';
export default async function ProtectedLayout({children}:{children:React.ReactNode}){
 // The function checks auth.uid, confirmed email, expiry and matching invitation.
 // This also covers users who sign in after accepting their invite on another device.
 try {const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(user?.email_confirmed_at)await db.rpc('team_invitation_accept');}catch{/* Preserve normal sign-in and let workspace show its access message. */}
 return children;
}
