import {redirect} from 'next/navigation';
import {z} from 'zod';
import {WorkspaceShell} from '@/components/workspace-shell';
import {supabaseServer} from '@/lib/supabase/server';
import {SmsComposer,SmsCampaignActions} from '@/components/charis-sms-form';
import {smsTestConfigured} from '@/lib/sms/termii';
export const dynamic='force-dynamic';
export default async function SmsPage({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;
 if(!z.string().uuid().safeParse(org).success)redirect('/dashboard');
 const company=org!;
 if(process.env.SINGLE_COMPANY_MODE==='true'&&company!==process.env.SINGLE_COMPANY_ORG_ID)redirect('/dashboard');
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const [{data:member},{data:admin},{data:canEdit},{data:canApprove}]=await Promise.all([
  db.rpc('is_organization_member',{org:company}),db.rpc('is_platform_super_admin'),db.rpc('can_edit_campaigns',{p_org:company}),db.rpc('can_approve_campaigns',{p_org:company})]);
 if(!member&&!admin)redirect('/dashboard');
 const [{data:groups},{data:campaigns,error},{data:tests}]=await Promise.all([
  db.from('contact_lists').select('id,name').eq('organization_id',company).limit(100),
  db.from('charis_sms_campaigns').select('id,title,message,purpose,audience_type,audience_id,status,edited_by,submitted_by,review_note,updated_at').eq('organization_id',company).order('updated_at',{ascending:false}).limit(50),
  db.from('charis_sms_tests').select('id,status,created_at').eq('organization_id',company).order('created_at',{ascending:false}).limit(12)
 ]);
 return <WorkspaceShell org={company} title="SMS communications">
  <p className="muted">Write bank customer text messages, get independent approval and test safely before live SMS is enabled.</p>
  <div className="notice"><strong>SMS pilot mode.</strong> Customer SMS dispatch is not enabled. An approved campaign is not sent automatically. Staff tests are limited to the authorised test number and may incur provider charges.</div>
  {canEdit&&<SmsComposer org={company} groups={groups||[]}/>}
  {!canEdit&&<p className="notice">You can review SMS campaigns, but you need campaign editing access to create one.</p>}
  <section className="panel"><h2>SMS campaigns</h2>{error&&<p role="alert" className="feedback-error">SMS history is unavailable. Confirm migration 023 has been installed.</p>}
   {(campaigns||[]).map(c=><div key={c.id} className="charis-sms-campaign"><div className="workspace-heading"><div><h3>{c.title}</h3><p className="muted">{c.purpose==='marketing'?'Promotional':'Account/service'} · {c.audience_type==='all'?'All eligible':groups?.find(g=>g.id===c.audience_id)?.name||'Saved group'}</p></div><span className="status-chip">{c.status.replaceAll('_',' ')}</span></div>
    <p>{c.message}</p>{c.review_note&&<p className="muted">Review note: {c.review_note}</p>}
    <SmsCampaignActions org={company} campaign={c} canEdit={canEdit===true} canApprove={canApprove===true} userId={user.id} canTest={smsTestConfigured()}/>
   </div>)}
   {!campaigns?.length&&!error&&<p className="muted">No SMS campaigns yet. Save a draft to begin.</p>}
  </section>
  <section className="panel"><h2>Recent SMS tests</h2>{smsTestConfigured()?<p className="muted">SMS test sending is configured in Vercel.</p>:<p className="notice">To activate staff-only SMS tests, configure TERMII_API_KEY, TERMII_SENDER_ID and CHARIS_SMS_TEST_NUMBER in Vercel.</p>}
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>Time</th><th>Status</th></tr></thead><tbody>{(tests||[]).map(t=><tr key={t.id}><td>{new Date(t.created_at).toLocaleString('en-NG')}</td><td>{t.status==='accepted'?'Provider accepted':t.status}</td></tr>)}</tbody></table></div>
   {!tests?.length&&<p className="muted">No SMS tests recorded.</p>}
  </section>
 </WorkspaceShell>;
}
