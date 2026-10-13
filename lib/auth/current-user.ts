import 'server-only';
import {cache} from 'react';
import {supabaseServer} from '@/lib/supabase/server';

// Cache the verified Supabase user for this React server render only.
// Never cache a user across visitors or requests.
export const currentVerifiedUser=cache(async()=>{
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return null;
 try{const client=await supabaseServer();const {data:{user},error}=await client.auth.getUser();return error?null:user;}
 catch{return null;}
});
