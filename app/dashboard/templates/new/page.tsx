import Link from 'next/link';
import {redirect} from 'next/navigation';
import {companyAccess} from '@/lib/campaign/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {TemplateStudio} from '@/components/template-studio';
import {charisTemplatePresets} from '@/lib/campaign/template-presets';
import {designSchema,resolveBrandLinks} from '@/lib/campaign/design';
import {contactFieldNames} from '@/lib/campaign/customer-fields';

export default async function NewTemplate({searchParams}:{searchParams:Promise<{org?:string;preset?:string;copy?:string}>}){
 const {org,preset,copy}=await searchParams;
 if(!org)redirect('/dashboard');
 const {db,user,canEdit}=await companyAccess(org);
 if(!user)redirect('/login');
 if(!canEdit)redirect('/dashboard/templates');
 const [{data:branding},{data:media},{data:fieldRows}]=await Promise.all([
  db.from('organization_branding').select('display_name,primary_color,website_url').eq('organization_id',org).maybeSingle(),
  db.from('charis_media_assets').select('id,file_name,public_url').eq('organization_id',org).order('created_at',{ascending:false}).limit(100),
  db.from('contacts').select('attributes').eq('organization_id',org).is('archived_at',null).limit(300),
 ]);
 const blueprint=charisTemplatePresets.find(item=>item.id===preset);
 let seed=blueprint?{name:`${blueprint.name} — custom`,subject:blueprint.subject,description:blueprint.description,category:blueprint.category,design:blueprint.design}:undefined;
 if(copy&&/^[0-9a-f-]{36}$/i.test(copy)){
  const {data:template}=await db.from('email_templates').select('name,subject,description,category,design')
   .eq('id',copy).or(`organization_id.eq.${org},organization_id.is.null`).maybeSingle();
  const parsed=designSchema.safeParse(template?.design);
  if(template&&parsed.success)seed={name:`${template.name} — copy`,subject:template.subject,description:template.description||'',category:template.category,design:parsed.data};
 }
 const blankDesign={version:'1' as const,style:'modern' as const,blocks:[{type:'heading' as const,text:'Your email headline'},{type:'paragraph' as const,text:'Write your message here. Add elements using the design tools.'}]};
 const initialDesign=resolveBrandLinks(seed?.design||blankDesign,branding?.website_url);
 return <WorkspaceShell org={org} title="Create New Template">
  <Link className="inline-link" href="/dashboard/templates">← Back to Template Library</Link>
  <TemplateStudio org={org} initial={seed?{...seed,id:'',design:initialDesign}:undefined} newDesign={initialDesign}
   brandName={branding?.display_name||'Charis Microfinance Bank'} brandColor={branding?.primary_color||'#40239a'}
   websiteUrl={branding?.website_url||''} assets={media||[]} availableFields={contactFieldNames(fieldRows||[])} mode="create"/>
 </WorkspaceShell>;
}
