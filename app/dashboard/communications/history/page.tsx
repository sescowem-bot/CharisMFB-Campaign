import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {WorkspaceShell} from '@/components/workspace-shell';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {DirectHistoryActions} from '@/components/direct-history-actions';
import {CancelScheduledCampaign} from '@/components/direct-cancel-scheduled';
import {designSchema} from '@/lib/campaign/design';
import {renderCampaign} from '@/lib/campaigns/render';
import {messageStatusLabel,deliverySummaryText} from '@/lib/direct/delivery-view';
import {DirectRecipientOutcomes} from '@/components/direct-recipient-outcomes';
import {Clock3,Mail,UsersRound,RefreshCcw} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function DirectHistory({searchParams}:{searchParams:Promise<{id?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');const db=await supabaseServer(),org=account.workspace.id,params=await searchParams,id=z.uuid().safeParse(params.id);
 if(!id.success)redirect('/dashboard/communications');
 const [{data:canManage},{data:isAdmin},{data:message}]=await Promise.all([db.rpc('charis_direct_can_manage_history',{p_org:org}),db.rpc('charis_direct_is_admin',{p_org:org}),db.from('charis_direct_messages').select('id,title,subject,body,channel,purpose,product,status,recipient_count,created_at,archived_at,design,scheduled_at,created_by').eq('organization_id',org).eq('id',id.data).maybeSingle()]);
 if(!message)redirect('/dashboard/communications');
 const {data:rows,error}=await db.from('charis_direct_recipients').select('status,provider,error_code,updated_at').eq('organization_id',org).eq('message_id',id.data);
 const {data:branding}=message.design?await db.from('organization_branding').select('display_name,postal_address,primary_color').eq('organization_id',org).maybeSingle():{data:null};
 const storedDesign=designSchema.safeParse(message.design);
 let visualPreview='';
 if(storedDesign.success){try{visualPreview=renderCampaign({design:storedDesign.data,subject:message.subject,company:branding?.display_name||'Charis Microfinance Bank',address:branding?.postal_address||'',color:branding?.primary_color||'#40239a',testPreview:true,contact:{first_name:'Customer',last_name:'Example'}}).html;}catch{visualPreview='';}}
 const totals=(rows||[]).reduce((all,row)=>({...all,[row.status]:(all[row.status]||0)+1}),{} as Record<string,number>);
 const waiting=(totals.pending||0)+(totals.sending||0);
 const attention=['failed','unknown','bounced','complained','blocked'].reduce((n,v)=>n+(totals[v]||0),0);
 return <WorkspaceShell title="Campaign delivery details" actions={<Link href="/dashboard/communications" className="btn secondary">Back to campaigns</Link>}>
 <section className="panel">
  <div className="charis-delivery-top">
   <h2>{message.title}</h2>
   <span className={'charis-history-status charis-history-status-'+(['queued','pending_approval','sending'].includes(message.status)?'pending':message.status==='completed'?'done':'review')}>{messageStatusLabel(message.status,message.scheduled_at)}</span>
   <div className="charis-delivery-meta">
    <span><Mail size={15}/>{message.channel.toUpperCase()}</span>
    <span><UsersRound size={15}/>{message.recipient_count} selected recipients</span>
    <span><Clock3 size={15}/>{new Date(message.created_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</span>
   </div>
   <p className="charis-delivery-subject"><strong>Subject:</strong> {message.subject}</p>
   <p className="muted">Message type: {message.purpose.replaceAll('_',' ')} · Product: {message.product.replaceAll('_',' ')}</p>
   {message.scheduled_at&&<p className="muted">Scheduled for {new Date(message.scheduled_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos',dateStyle:'medium',timeStyle:'short'})} WAT</p>}
   {message.scheduled_at&&new Date(message.scheduled_at).getTime()>Date.now()&&['queued','pending_approval'].includes(message.status)&&(message.created_by===account.id||isAdmin===true)&&<CancelScheduledCampaign id={message.id}/>}
   {canManage===true&&<div className="actions"><DirectHistoryActions id={message.id} status={message.status} archived={Boolean(message.archived_at)}/></div>}
  </div>
  <details className="charis-delivery-preview"><summary>View message content and email preview</summary>
   {visualPreview?<iframe title="Sent email design preview" sandbox="" referrerPolicy="no-referrer" loading="lazy" srcDoc={visualPreview} style={{width:'100%',height:530}}/>:<p style={{whiteSpace:'pre-wrap'}}>{message.body}</p>}
  </details>
 </section>
 <section className="panel">
  <div className="workspace-heading"><h2>Delivery results</h2><Link className="inline-link" href={'/dashboard/communications/history?id='+message.id}><RefreshCcw size={15}/> Refresh results</Link></div>
  <p role="status" className="charis-delivery-summary">{deliverySummaryText(totals)}</p>
  <div className="charis-delivery-kpis">
   <div><span>Delivered</span><strong>{totals.delivered||0}</strong><small>Provider-confirmed delivery</small></div>
   <div><span>Accepted</span><strong>{totals.accepted||0}</strong><small>Accepted for processing; not inbox delivery</small></div>
   <div><span>Waiting or sending</span><strong>{waiting}</strong><small>No confirmed outcome yet</small></div>
   <div><span>Needs attention</span><strong>{attention}</strong><small>Failed, bounced, blocked or unknown</small></div>
   <div><span>Not sent</span><strong>{(totals.skipped||0)+(totals.unsubscribed||0)}</strong><small>Skipped or unsubscribed</small></div>
   <div><span>Recorded outcomes</span><strong>{(rows||[]).length}</strong><small>Individual recipient records</small></div>
  </div>
  <p className="charis-delivery-explain"><strong>How to interpret these figures:</strong> Accepted means the email provider received the request. It does not prove inbox delivery or that the customer read the message. Delivered is shown only when the provider reports it. Not all providers report delivery events.</p>
  {error?<p className="feedback-error" role="alert">Unable to load recipient outcomes. Refresh this page or contact your administrator.</p>:
   <DirectRecipientOutcomes rows={rows||[]}/>}
 </section>
 </WorkspaceShell>;
}
