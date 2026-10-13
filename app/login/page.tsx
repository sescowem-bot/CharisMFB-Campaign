import {redirect} from 'next/navigation';
import {currentVerifiedUser} from '@/lib/auth/current-user';
import {AuthForm} from '@/components/auth-form';
import {Header,Footer,PublicLayout} from '@/components/public';
import {ShieldCheck} from 'lucide-react';
export const metadata={title:'Staff sign in | Charis Campaign Centre',robots:{index:false,follow:false}};
export default async function Page(){
 // Do not display another login form to an already authenticated staff member.
 const user=await currentVerifiedUser();
 if(user)redirect('/dashboard');
 if(process.env.SINGLE_COMPANY_MODE==='true')return <><Header/><main className="charis-login-shell"><section className="charis-login-feature"><span>CHARIS MICROFINANCE BANK LTD</span><h1>A better way to communicate with every customer.</h1><p>Create thoughtful campaigns, collaborate securely and keep communication under control.</p><div className="charis-login-note"><ShieldCheck size={16}/> Staff-only access · Role-based permissions · Campaign approval</div></section><div className="charis-login-card"><AuthForm mode="login"/><p style={{textAlign:'center',fontSize:12}} className="muted">Need access? Contact your Charis administrator.</p></div></main><Footer/></>;
 return <PublicLayout slug="login" label="ACCOUNT ACCESS" title="Welcome back" subtitle="Sign in securely to your workspace."><section className="shell section"><AuthForm mode="login"/></section></PublicLayout>;
}
