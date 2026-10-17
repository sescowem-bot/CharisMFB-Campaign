import 'server-only';
import {cache} from 'react';
import {supabaseServer} from '@/lib/supabase/server';
/** Request-scoped permission result. Never cache across different users or requests. */
export const canSendDirect=cache(async(org:string):Promise<boolean>=>{
 try{const db=await supabaseServer();const {data,error}=await db.rpc('charis_direct_can_send',{p_org:org});return !error&&data===true;}catch{return false;}
});
