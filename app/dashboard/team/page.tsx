import {redirect} from 'next/navigation';
import {z} from 'zod';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {TeamForm,InviteStaffForm} from '@/components/management-forms';
export default async function Team({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;
 if(!org||!z.string().uuid().safeParse(org).success)redirect('/dashboard');
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const {data:allowed}=await db.rpc('can_manage_team',{p_org:org});
 if(!allowed)redirect('/dashboard');
 const [{data,error},{data:pendingInvitations,error:inviteError}]=await Promise.all([db.rpc('team_members',{p_org:org}),db.rpc('team_invitation_list',{p_org:org})]);
 const parsed=z.array(z.object({id:z.string().uuid(),email:z.string(),role:z.string()})).safeParse(data);
 const invitations=z.array(z.object({id:z.string().uuid(),email:z.string(),role:z.string(),expires_at:z.string(),invited_at:z.string()})).safeParse(pendingInvitations);
 return <WorkspaceShell org={org} title="Charis team access">
  <p className="muted">Manage staff access to Charis Campaign Centre. Select a staff member to see their current role before making a change.</p>
  {inviteError||!invitations.success?<p role="alert" className="feedback-error">Invitation setup is unavailable. Run Charis staff invitation SQL migration 016.</p>:<InviteStaffForm org={org} pendingInvitations={invitations.data}/>}
  {error||!parsed.success?<p role="alert" className="feedback-error">Team membership is unavailable. Check the database migration and try again.</p>:<TeamForm org={org} members={parsed.data} currentUserId={user.id}/>}
 </WorkspaceShell>;
}
