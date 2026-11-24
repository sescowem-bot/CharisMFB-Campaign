import {redirect} from 'next/navigation';
import {companyAccess} from '@/lib/campaign/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CompanyFooterEditor} from '@/components/company-footer-editor';
type FooterDesign={company_name?:string;address?:string;contact_email?:string;website_url?:string;disclaimer?:string;social_platforms?:string[]};
type FooterRow={id:string;name:string;is_default:boolean;design:FooterDesign};
export default async function Footers({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;if(!org)redirect('/dashboard');
 const {db,user,canView,canEdit}=await companyAccess(org);
 if(!user)redirect('/login');if(!canView)redirect('/dashboard');
 const {data}=await db.from('email_footers').select('id,name,is_default,design').eq('organization_id',org).order('created_at',{ascending:false});
 const footers=(data||[]) as unknown as FooterRow[];
 return <WorkspaceShell org={org} title="Email Footers">
  <p className="muted">Create reusable footer profiles and choose the right one for each campaign. Social URLs are managed under Charis Brand Settings.</p>
  <div className="feature-grid">{footers.map(f=><article className="feature-card" key={f.id}>
   <h3>{f.name}</h3><p>{f.is_default?'Default footer':'Additional footer'}</p>
   <p>{String(f.design?.company_name||'')}</p>
   <p className="muted">Social channels: {Array.isArray(f.design?.social_platforms)?(f.design.social_platforms.length?f.design.social_platforms.map(x=>x==='x'?'X':x[0].toUpperCase()+x.slice(1)).join(', '):'No social channels selected'):'All configured channels'}</p>
   {canEdit&&<details><summary>Edit footer</summary><CompanyFooterEditor org={org} initial={f}/></details>}
  </article>)}</div>
  {!footers.length&&<p className="muted">No footers created yet.</p>}
  {canEdit&&<CompanyFooterEditor org={org}/>}
 </WorkspaceShell>;
}
