import Image from 'next/image';
import {redirect} from 'next/navigation';
import {CheckCircle2,ShieldCheck} from 'lucide-react';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {AuthForm} from '@/components/auth-form';
import {PublicLayout} from '@/components/public';
export const metadata={title:'Staff sign in | Charis Campaign Centre',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){
  const user=await currentVerifiedUser();if(user)redirect('/dashboard');
  const {error}=await searchParams;
  if(process.env.SINGLE_COMPANY_MODE==='true')return <main className="auth">
    <section className="auth-aside" aria-label="About Charis Campaign Centre">
      <span className="auth-badge"><ShieldCheck size={15}/> STAFF PORTAL · AUTHORISED ACCESS ONLY</span>
      <div><h1>Customer communication, <em>made simple.</em></h1>
        <p>One secure workspace to reach the right customers with consistent, approved messages from Charis Microfinance Bank.</p>
        <ul className="auth-points"><li><CheckCircle2 size={18}/> Choose one customer, a saved group or an eligible audience</li><li><CheckCircle2 size={18}/> Review and approve communications before they are sent</li><li><CheckCircle2 size={18}/> Track delivery with a clear audit trail</li></ul>
      </div>
      <div className="auth-foot">© {new Date().getFullYear()} Charis Microfinance Bank Ltd · Internal use only</div>
    </section>
    <section className="auth-main"><div className="auth-box">
      <Image unoptimized src="/charis-official-logo.png" width={190} height={52} alt="Charis Microfinance Bank" priority/>
      <h2>Welcome back</h2><p className="muted">Sign in with your authorised Charis staff account.</p>
      {error==='setup'&&<p className="notice" role="alert">Please contact the Charis system administrator to complete the configuration.</p>}
      <AuthForm mode="login"/>
      <div className="auth-secure"><ShieldCheck size={15}/> Secured staff access · Activity is logged</div>
    </div></section>
  </main>;
  return <PublicLayout slug="login" label="ACCOUNT ACCESS" title="Welcome back" subtitle="Sign in securely to your workspace."><section className="shell section"><AuthForm mode="login"/></section></PublicLayout>;
}
