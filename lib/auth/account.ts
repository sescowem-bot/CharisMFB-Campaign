import 'server-only';
import {cache} from 'react';
import {supabaseServer} from '@/lib/supabase/server';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {charisOrgId} from '@/lib/bank';
export const currentAccount=cache(async()=>{
 const org=charisOrgId();if(!org||!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return null;
 try{
  const user=await currentVerifiedUser();if(!user)return null;
  const db=await supabaseServer();
  const [{data:owner},{data:workspace},{data:teamAdmin},{data:providerAdmin},{data:accessAdmin},{data:auditAdmin},{data:permissions}]=await Promise.all([
   db.rpc('is_platform_super_admin'),db.from('organizations').select('id,name,status,slug').eq('id',org).eq('slug','charis-mfb').maybeSingle(),
   db.rpc('can_manage_team',{p_org:org}),db.rpc('can_manage_senders',{p_org:org}),
   db.rpc('charis_has_permission',{p_org:org,p_key:'access.manage'}),db.rpc('charis_has_permission',{p_org:org,p_key:'audit.view'}),db.rpc('charis_permission_list',{p_org:org})
  ]);
  if(!workspace||workspace.status!=='active')return null;
  const isOwner=owner===true;
  return {id:user.id,admin:isOwner||teamAdmin===true||accessAdmin===true,owner:isOwner,providerAdmin:isOwner||providerAdmin===true,auditAdmin:isOwner||auditAdmin===true,accessAdmin:isOwner||accessAdmin===true,workspace,ownerWorkspace:null,permissions:Array.isArray(permissions)?permissions as string[]:[]};
 }catch{return null;}
});
