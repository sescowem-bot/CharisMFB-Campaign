import Link from 'next/link';
import Image from 'next/image';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CharisInstallControls} from '@/components/charis-pwa';

export default async function InstallCharis(){
 const account=await currentAccount();if(!account)redirect('/login');
 return <WorkspaceShell title="Install Charis" subtitle="Use Charis Campaign Centre like a desktop application on your work computer.">
  <section className="panel charis-install-hero">
   <Image src="/charis-pwa-192.png" width={74} height={74} alt="Charis app icon" unoptimized/>
   <div><strong>Charis Campaign Centre</strong><p>One secure banking workspace, available from your Windows Start menu or desktop.</p></div>
  </section>
  <section className="panel"><CharisInstallControls/></section>
  <p><Link href="/dashboard" className="inline-link">Back to Dashboard</Link></p>
 </WorkspaceShell>;
}
