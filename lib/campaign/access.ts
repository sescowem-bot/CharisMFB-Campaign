import {supabaseServer} from '@/lib/supabase/server';
export async function companyAccess(org:string){
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return {db,user:null,canEdit:false,canView:false};
 const [{data:allowed},{data:member},{data:owner}]=await Promise.all([
  db.rpc('can_edit_company_design',{p_org:org}),
  db.rpc('is_organization_member',{org}),
  db.rpc('is_platform_super_admin')
 ]);
 return {db,user,canEdit:allowed===true,canView:member===true||owner===true};
}
