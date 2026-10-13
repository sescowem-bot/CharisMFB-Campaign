import {supabaseServer} from '@/lib/supabase/server';
import {z} from 'zod';
export const organizationIdSchema = z.string().uuid();
/** Contact PII is restricted to company admins, managers, and platform super admins. */
export async function contactsAccess(organizationId: string) {
 const org = organizationIdSchema.safeParse(organizationId);
 const db = await supabaseServer();
 const {data:{user}} = await db.auth.getUser();
 if (!user || !org.success) return {db,user,authorized:false};
 const {data:authorized,error}=await db.rpc('can_manage_contacts',{p_org:org.data});
 if(error)return {db,user,authorized:false};
 return {db,user,authorized:authorized===true};
}
