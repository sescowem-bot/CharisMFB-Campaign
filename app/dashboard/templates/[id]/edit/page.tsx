import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {companyAccess} from '@/lib/campaign/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {TemplateStudio} from '@/components/template-studio';
import {designSchema} from '@/lib/campaign/design';
import {contactFieldNames} from '@/lib/campaign/customer-fields';

export default async function EditTemplate({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{org?:string}>}){
 const [{id},{org}]=await Promise.all([params,searchParams]);
 if(!org)redirect('/dashboard');
 const {db,user,canEdit}=await companyAccess(org);
 if(!user)redirect('/login');
 if(!canEdit)redirect('/dashboard/templates');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const [{data:template},{data:branding},{data:media},{data:fieldRows}]=await Promise.all([
  db.from('email_templates').select('id,name,subject,description,category,design,organization_id')
   .eq('id',id).eq('organization_id',org).maybeSingle(),
  db.from('organization_branding').select('display_name,primary_color,website_url').eq('organization_id',org).maybeSingle(),
  db.from('charis_media_assets').select('id,file_name,public_url').eq('organization_id',org).order('created_at',{ascending:false}).limit(100),
  db.from('contacts').select('attributes').eq('organization_id',org).is('archived_at',null).limit(300)
 ]);
 if(!template)notFound();
 const parsed=designSchema.safeParse(template.design);
 if(!parsed.success)notFound();
 return <WorkspaceShell org={org} title="Edit Email Template">
  <Link className="inline-link" href="/dashboard/templates">← Back to Template Library</Link>
  <TemplateStudio org={org} initial={{...template,design:parsed.data}}
   brandName={branding?.display_name||'Charis Microfinance Bank'} brandColor={branding?.primary_color||'#40239a'}
   websiteUrl={branding?.website_url||''} assets={media||[]} availableFields={contactFieldNames(fieldRows||[])} mode="edit"/>
 </WorkspaceShell>;
}
