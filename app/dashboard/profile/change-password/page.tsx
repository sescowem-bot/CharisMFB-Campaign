import {redirect} from 'next/navigation';
import Link from 'next/link';
import {WorkspaceShell} from '@/components/workspace-shell';
import {StaffChangePassword} from '@/components/staff-change-password';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
export default async function PasswordSettings(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!user||!account)redirect('/login');
 return <WorkspaceShell title="Password & account security" subtitle="Change your password securely.">
  <p><Link href="/dashboard/profile" className="inline-link">Back to profile</Link></p>
  <StaffChangePassword email={user.email||''}/>
 </WorkspaceShell>;
}