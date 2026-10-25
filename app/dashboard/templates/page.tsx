import {redirect} from 'next/navigation';
import {companyAccess} from '@/lib/campaign/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {TemplateGallery} from '@/components/template-gallery';
import {designSchema} from '@/lib/campaign/design';
import {charisTemplatePresets} from '@/lib/campaign/template-presets';

export default async function Templates({searchParams}:{searchParams:Promise<{org?:string;edit?:string}>}){
 const {org,edit}=await searchParams;
 if(!org)redirect('/dashboard');
 if(edit)redirect(`/dashboard/templates/${edit}/edit`);
 const {db,user,canView,canEdit}=await companyAccess(org);
 if(!user)redirect('/login');
 if(!canView)redirect('/dashboard');
 const {data:rows,error}=await db.from('email_templates')
  .select('id,name,subject,description,category,design,status,updated_at,organization_id')
  .or(`organization_id.eq.${org},organization_id.is.null`)
  .order('updated_at',{ascending:false}).limit(120);
 const templates=(rows||[]).flatMap(t=>{
  const parsed=designSchema.safeParse(t.design);
  return parsed.success?[{id:t.id,name:t.name,description:t.description||'',category:t.category,subject:t.subject,status:t.status,design:parsed.data,owned:t.organization_id===org,updatedAt:t.updated_at}]:[];
 });
 return <WorkspaceShell org={org} title="Email Template Library">
  {error&&<p role="alert" className="feedback-error">The template library could not be loaded. Please try again.</p>}
  <TemplateGallery saved={templates} presets={charisTemplatePresets} canEdit={canEdit}/>
 </WorkspaceShell>;
}
