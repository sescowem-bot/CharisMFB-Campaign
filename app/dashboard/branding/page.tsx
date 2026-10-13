import {redirect} from 'next/navigation';
import {companyAccess} from '@/lib/campaign/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CompanyBrandEditor} from '@/components/company-brand-editor';
import {CharisMediaLibrary} from '@/components/charis-media-library';
export default async function Branding({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;if(!org)redirect('/dashboard');
 const {db,user,canView,canEdit}=await companyAccess(org);
 if(!user)redirect('/login');if(!canView)redirect('/dashboard');
 const [branding,media]=await Promise.all([
  db.from('organization_branding').select('*').eq('organization_id',org).maybeSingle(),
  db.from('charis_media_assets').select('id,file_name,public_url,bytes,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(40)
 ]);
 return <WorkspaceShell org={org} title="Charis brand settings">
  <p className="muted">Manage Charis colours, sender branding, bank logo and the browser icon without changing source code or Vercel variables.</p>
  {canEdit?<CompanyBrandEditor org={org} brand={branding.data}/>:<p>You have view-only access to this workspace.</p>}
  {media.error?<p className="notice" role="alert">Media library unavailable. Apply database migration 018 to enable approved image uploads and favicon settings.</p>:
   <CharisMediaLibrary org={org} logo={String(branding.data?.logo_path||'')} favicon={String(branding.data?.favicon_url||'')} assets={media.data||[]} canEdit={canEdit}/>}
 </WorkspaceShell>;
}
