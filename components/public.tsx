import {charisBrandAssets} from '@/lib/charis-brand-assets';
import Link from 'next/link';
import Image from 'next/image';
import {SignOutForm} from '@/components/signout-form';
import {currentAccount} from '@/lib/auth/account';
import {publishedPage} from '@/lib/cms/server';
/** Only the bank's help/legal pages use this shell; no SaaS marketing navigation. */
export async function Header(){const [account,assets]=await Promise.all([currentAccount(),charisBrandAssets()]);return <header className="site-header"><div className="shell site-nav"><Link href="/login" className="logo"><Image unoptimized src={assets.logo||'/charis-official-logo.png'} alt="Charis Microfinance Bank Ltd" width={190} height={48} priority/></Link><nav className="desktop-links" aria-label="Navigation"><Link href="/dashboard">Workspace</Link><Link href="/dashboard/help">Help</Link></nav><div className="account-actions">{account?<><Link href="/dashboard">Dashboard</Link><SignOutForm variant="text"/></>:<Link href="/login">Staff sign in</Link>}</div></div></header>;}
export async function Footer(){return <footer className="site-footer charis-footer"><div className="shell footer-bottom">© {new Date().getFullYear()} Charis Microfinance Bank Ltd · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/cookies">Cookies</Link></div></footer>;}
export async function PublicLayout({label,title,subtitle,slug,children}:{label:string;title:string;subtitle:string;slug?:string;children:React.ReactNode}){const page=slug?await publishedPage(slug):null;return <><Header/><main><section className="shell public-hero"><span className="eyebrow">{page?.label??label}</span><h1>{page?.title??title}</h1><p>{page?.subtitle??subtitle}</p></section>{children}</main><Footer/></>;}
