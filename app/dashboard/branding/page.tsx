import {redirect} from 'next/navigation';
import {companyAccess} from '@/lib/campaign/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CompanyBrandEditor} from '@/components/company-brand-editor';
import {CharisMediaLibrary} from '@/components/charis-media-library';
import {CompanyFooterEditor} from '@/components/company-footer-editor';
import {Callout,EmptyState} from '@/components/ui';
import {FileText} from 'lucide-react';
export default async function Branding({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;if(!org)redirect('/dashboard');
 const {db,user,canView,canEdit}=await companyAccess(org);
 if(!user)redirect('/login');if(!canView)redirect('/dashboard');
 const [branding,media,footers]=await Promise.all([
  db.from('organization_branding').select('*').eq('organization_id',org).maybeSingle(),
  db.from('charis_media_assets').select('id,file_name,public_url,bytes,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(40),
  db.from('email_footers').select('id,name,is_default,design').eq('organization_id',org).order('created_at',{ascending:false})
 ]);
 return <WorkspaceShell org={org} title="Brand & footer" subtitle="Colours, logo, browser icon and the email footer used on every campaign. No code changes needed.">
  {canEdit?<CompanyBrandEditor org={org} brand={branding.data}/>:<Callout tone="info">You have view-only access to brand settings.</Callout>}
  {media.error?<Callout tone="warning" alert>The media library is unavailable. Apply database migration 018 to enable approved image uploads.</Callout>:
   <CharisMediaLibrary org={org} logo={String(branding.data?.logo_path||'')} favicon={String(branding.data?.favicon_url||'')} assets={media.data||[]} canEdit={canEdit}/>}
  <div className="page-head" style={{marginTop:34,marginBottom:6}}><div><h2>Email footers</h2><p>Reusable footer details appended to campaign emails.</p></div></div>
  {footers.data?.length?<div className="feature-grid">{footers.data.map(f=><article className="feature-card" key={f.id}><h3>{f.name}</h3><p>{f.is_default?'Default footer':'Additional footer'}</p><p>{String((f.design as Record<string,unknown>|null)?.company_name||'')}</p></article>)}</div>:<EmptyState icon={FileText} title="No footers yet" text="Create a footer below."/>}
  {canEdit&&<CompanyFooterEditor org={org}/>}
 </WorkspaceShell>;
}
