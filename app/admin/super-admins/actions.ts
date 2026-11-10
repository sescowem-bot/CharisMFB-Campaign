'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';

export async function setPlatformSuperAdmin(form:FormData){
 const account=await currentAccount();
 if(!account?.owner)throw new Error('Platform super administrator access required.');
 const email=z.string().trim().email().max(254).parse(form.get('email')).toLowerCase();
 const enabled=form.get('enabled')==='yes';
 const db=await supabaseServer();
 const {error}=await db.rpc('charis_platform_super_admin_set',{p_email:email,p_enabled:enabled});
 if(error)throw new Error(error.message);
 revalidatePath('/admin');revalidatePath('/admin/super-admins');
 redirect('/admin/super-admins?saved=1');
}
