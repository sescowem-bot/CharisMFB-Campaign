import Link from 'next/link';
import Image from 'next/image';
import {Header,Footer} from '@/components/public';
import {ArrowUpRight,ClipboardCheck,Mail,UsersRound} from 'lucide-react';

/** Private-bank welcome surface. No pricing, tenant signup or generic SaaS advertising. */
export default function Home(){
 return <><Header/><main className="charis-public">
  <section className="shell charis-landing-hero"><div className="charis-landing-copy"><span className="charis-pill">CHARIS MICROFINANCE BANK LTD · STAFF PORTAL</span><h1>Customer communication, <em>made simple.</em></h1><p>Make every message count. Select the right customers, collaborate on approvals and send consistent bank communications from one secure workspace.</p><div className="actions"><Link href="/dashboard" className="btn">Open campaign centre <ArrowUpRight size={17}/></Link><Link href="/login" className="btn secondary">Staff sign in</Link></div><p className="charis-landing-note">Authorised staff · Approved messages · Transparent delivery reporting</p></div>
  <div className="charis-landing-panel"><div className="charis-landing-panel-head"><Image src="/charis-official-mark.png" width={43} height={43} alt=""/><div><strong>Charis Campaign Centre</strong><small>Customer communications</small></div><span className="charis-mini-label">STAFF WORKSPACE</span></div><div className="charis-landing-panel-body"><span className="eyebrow">A SIMPLE BANK WORKFLOW</span><h2>From audience to delivery</h2>{[['01','Choose recipients','One customer, selected contacts or approved groups'],['02','Write and preview','Compose a consistent message and test it'],['03','Review, send and track','Record approval before customer delivery']].map(([number,title,detail])=><div className="charis-process" key={number}><span className="charis-process-num">{number}</span><div><strong>{title}</strong><small>{detail}</small></div></div>)}</div><div className="charis-landing-panel-foot">Designed around responsible customer engagement</div></div></section>
  <section className="shell charis-value-grid"><article><UsersRound size={22}/><h3>Customer-first targeting</h3><p>Find the right contacts and respect communication permissions.</p></article><article><ClipboardCheck size={22}/><h3>Independent approvals</h3><p>Keep messages controlled with clear responsibilities and review history.</p></article><article><Mail size={22}/><h3>Professional email campaigns</h3><p>Use approved sender identities, bank templates and performance reports.</p></article></section>
 </main><Footer/></>;
}
