import Image from 'next/image';
import {CheckCircle2, ShieldCheck} from 'lucide-react';
import {AuthForm} from '@/components/auth-form';
import {Callout} from '@/components/ui';
import {brand} from '@/lib/brand';

export const metadata = {title: 'Sign in', robots: {index: false, follow: false}};

export default async function LoginPage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const {error} = await searchParams;
  return (
    <div className="auth">
      <section className="auth-aside" aria-label="About Charis Campaign Centre">
        <span className="auth-badge"><ShieldCheck size={15}/> STAFF PORTAL · AUTHORISED ACCESS ONLY</span>
        <div>
          <h1>Customer communication, <em>made simple.</em></h1>
          <p>One secure workspace to reach the right customers with consistent, approved messages from {brand.name}.</p>
          <ul className="auth-points">
            <li><CheckCircle2 size={18}/> Consent-aware audiences, so only eligible customers are ever contacted</li>
            <li><CheckCircle2 size={18}/> Independent approval before any campaign can be sent</li>
            <li><CheckCircle2 size={18}/> Delivery tracking and a full audit trail for compliance</li>
          </ul>
        </div>
        <div className="auth-foot">© {new Date().getFullYear()} {brand.name}. Internal use only.</div>
      </section>
      <section className="auth-main">
        <div className="auth-box">
          <Image unoptimized src={brand.logo} width={150} height={34} alt={brand.name} priority/>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with your Charis staff account to open the Campaign Centre.</p>
          {error === 'setup' && <Callout tone="warning" alert>The system is not fully configured yet. Please contact your administrator.</Callout>}
          <AuthForm/>
          <div className="auth-secure"><ShieldCheck size={15}/> Secured access · Activity is logged for audit</div>
        </div>
      </section>
    </div>
  );
}
