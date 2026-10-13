import {currentAccount} from '@/lib/auth/account';
import {charisBrandAssets} from '@/lib/charis-brand-assets';
import {CharisNavigation} from '@/components/charis-navigation';
import Link from 'next/link';
import {ArrowLeft, Bell, ShieldCheck} from 'lucide-react';

/** Consistent Charis-only application shell. The database remains the source of truth for access permissions. */
export async function WorkspaceShell({title,admin:adminRequested=false,org,children}:{title:string;admin?:boolean;org?:string;children:React.ReactNode}) {
  const [account,assets]=await Promise.all([currentAccount(),charisBrandAssets()]);
  const admin=account?.admin===true;
  const workspace=org||account?.workspace?.id;
  const logo=assets.logo||'/charis-official-logo.png';
  const routeHome=workspace?`/dashboard/campaigns?org=${encodeURIComponent(workspace)}`:'/dashboard';
  return <div className="dash charis-app-shell">
    <CharisNavigation org={workspace} admin={admin} logo={logo}/>
    <main className="content charis-main" id="main-content">
      <header className="charis-topbar">
        <div className="charis-topbar-intro"><span className="charis-overline">CHARIS MICROFINANCE BANK / CAMPAIGN CENTRE</span><h1 className="page-title">{title}</h1></div>
        <div className="charis-topbar-actions"><span className="charis-role-chip"><ShieldCheck size={15}/>{admin?'Administrator':'Staff workspace'}</span><Link href={`/dashboard/approvals${workspace?`?org=${encodeURIComponent(workspace)}`:''}`} className="charis-topbar-icon" aria-label="Go to campaign approvals"><Bell size={19}/></Link></div>
      </header>
      <div className="charis-page-content">
        {adminRequested&&!admin&&<p className="notice">Some administrator features require elevated access.</p>}
        {children}
      </div>
      <footer className="charis-main-footer"><span>© {new Date().getFullYear()} Charis Microfinance Bank Ltd</span><span>Internal customer communications</span><Link href={routeHome}><ArrowLeft size={13}/> Campaigns</Link></footer>
    </main>
  </div>;
}
