import '../../profile-styles.css';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {UserRound,ShieldCheck,Mail,Building2} from 'lucide-react';
import {currentAccount} from '@/lib/auth/account';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {WorkspaceShell} from '@/components/workspace-shell';
export const dynamic='force-dynamic';
export default async function Profile(){
 const [account,user]=await Promise.all([currentAccount(),currentVerifiedUser()]);
 if(!user)redirect('/login');
 if(!account)redirect('/dashboard');
 const role=account.owner?'System administrator':account.admin?'Administrator':account.providerAdmin?'Communications administrator':'Bank staff';
 return <WorkspaceShell title="My profile" subtitle="Your bank account and system access details.">
  <section className="panel">
   <h2><UserRound size={20} aria-hidden="true"/> Account details</h2>
   <dl className="charis-profile-details">
    <div><dt>Bank</dt><dd><Building2 size={15} aria-hidden="true"/> {account.workspace.name}</dd></div>
    <div><dt>Email address</dt><dd><Mail size={15} aria-hidden="true"/> {user.email||'Not available'}</dd></div>
    <div><dt>Account role</dt><dd><ShieldCheck size={15} aria-hidden="true"/> {role}</dd></div>
    <div><dt>Email verified</dt><dd>{user.email_confirmed_at?'Verified':'Verification required'}</dd></div>
   </dl>
   <p className="muted">Your administrator manages system access and sending permissions. For security, provider credentials and private API keys are not displayed.</p>
   <p><Link className="btn secondary" href="/dashboard/profile/change-password">Change password</Link> <Link className="inline-link" href="/auth/forgot-password">Forgot password?</Link></p>
   {account.admin&&<p><Link className="btn secondary" href="/admin">Open administration</Link></p>}
  </section>
  <p><Link href="/dashboard" className="inline-link">Return to dashboard</Link></p>
 </WorkspaceShell>;
}
