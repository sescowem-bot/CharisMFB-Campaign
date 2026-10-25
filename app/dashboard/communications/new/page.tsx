import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {canSendDirect} from '@/lib/auth/direct-send-access';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {DirectCompose} from '@/components/direct-compose';
import {directWorkerIsHealthy} from '@/lib/direct/readiness';
import {designSchema,resolveBrandLinks,assertNoDemoLinks} from '@/lib/campaign/design';
import {charisTemplatePresets} from '@/lib/campaign/template-presets';
export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function NewCommunication(){
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id,db=await supabaseServer();
 const [allowed,{data:settings,error:settingsError},{data:bankWide},{data:contacts,error:contactError},{data:groups},{data:branding},{data:allTemplates},{data:media},schedulingReady]=await Promise.all([
  canSendDirect(org),
  db.from('charis_direct_settings').select('approval_required,email_enabled,sms_enabled,max_recipients').eq('organization_id',org).maybeSingle(),
  db.rpc('charis_is_bankwide',{p_org:org}),
  db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).is('archived_at',null).order('created_at',{ascending:false}).limit(35),
  db.from('contact_lists').select('id,name').eq('organization_id',org).order('name').limit(100),
  db.from('organization_branding').select('display_name,primary_color,postal_address,website_url').eq('organization_id',org).maybeSingle(),
  db.from('email_templates').select('id,name,subject,design,category').or(`organization_id.eq.${org},organization_id.is.null`).in('status',['draft','approved']).order('created_at',{ascending:false}).limit(100),
  db.from('charis_media_assets').select('id,file_name,public_url').eq('organization_id',org).order('created_at',{ascending:false}).limit(80),
  process.env.CHARIS_SCHEDULING_ENABLED==='true'?directWorkerIsHealthy():Promise.resolve(false)
 ]);
 if(!allowed)redirect('/dashboard');
 if(settingsError||!settings)return <WorkspaceShell title="Create Campaign"><p role="alert" className="feedback-error">Communication settings are unavailable.</p></WorkspaceShell>;
 const templates=(allTemplates||[]).flatMap(t=>{
  if(!['general','announcement'].includes(t.category))return [];
  const parsed=designSchema.safeParse(t.design);
  if(!parsed.success||JSON.stringify(parsed.data).length>30000)return [];
  const design=resolveBrandLinks(parsed.data,branding?.website_url);
  try{assertNoDemoLinks(design);}catch{return [];}
  return [{id:t.id,name:t.name,subject:t.subject,design}];
 });
 // Bank notices must not silently become promotional campaigns. These curated
 // starter layouts require the same message validation as saved templates.
 const starters=charisTemplatePresets.filter(p=>['general','announcement'].includes(p.category))
  .flatMap(p=>{
   const design=resolveBrandLinks(p.design,branding?.website_url);
   try{assertNoDemoLinks(design);}catch{return [];}
   return [{id:'starter:'+p.id,name:p.name,subject:p.subject,design,source:'starter' as const}];
  });
 return <WorkspaceShell title="Create Campaign" subtitle="Message · Recipients · Preview · Confirm" actions={<Link href="/dashboard/communications" className="btn secondary">All Campaigns</Link>}>
  {contactError&&<p role="alert" className="feedback-error">Customer directory is temporarily unavailable.</p>}
  {settings.approval_required&&<p className="notice">Campaign approval is enabled.</p>}
  {!settings.email_enabled&&!settings.sms_enabled?<p role="alert" className="feedback-error">Email and SMS are currently disabled.</p>:
   <DirectCompose token={randomUUID()} contacts={contacts||[]} groups={bankWide===true?groups||[]:[]} canBulk={bankWide===true} emailEnabled={settings.email_enabled} smsEnabled={settings.sms_enabled} maxRecipients={settings.max_recipients}
    templates={[...templates.map(t=>({...t,source:'bank' as const})),...starters]} assets={media||[]} templateStudioUrl={`/dashboard/templates?org=${org}`} brand={{name:branding?.display_name||'Charis Microfinance Bank',color:branding?.primary_color||'#40239a',address:branding?.postal_address||'',website:branding?.website_url||''}}
    schedulingEnabled={schedulingReady} approvalRequired={settings.approval_required}/>}
 </WorkspaceShell>;
}
