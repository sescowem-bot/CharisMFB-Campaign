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
import {messageStatusLabel,recipientStatusLabel,deliverySummaryText} from '@/lib/direct/delivery-view';
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
 return <WorkspaceShell title="Message delivery" actions={<Link href="/dashboard/communications" className="btn secondary">Back to messages</Link>}>
 <section className="panel"><h2>{message.title}</h2><p><strong>Subject:</strong> {message.subject}</p><p className="muted">{message.channel.toUpperCase()} · {message.purpose.replaceAll('_',' ')} · {message.product.replaceAll('_',' ')} · {message.recipient_count} recipients · {new Date(message.created_at).toLocaleString('en-NG')}</p><p style={{whiteSpace:'pre-wrap'}}>{message.body}</p>{visualPreview&&<details><summary>View email design</summary><iframe title="Sent email design preview" sandbox="" srcDoc={visualPreview} style={{width:'100%',height:470,border:'1px solid #ddd',borderRadius:8}}/></details>}<span className="status-chip">{messageStatusLabel(message.status,message.scheduled_at)}</span>{message.scheduled_at&&<p className="muted">Scheduled: {new Date(message.scheduled_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})} WAT</p>}{message.scheduled_at&&new Date(message.scheduled_at).getTime()>Date.now()&&['queued','pending_approval'].includes(message.status)&&(message.created_by===account.id||isAdmin===true)&&<CancelScheduledCampaign id={message.id}/>}{canManage===true&&<div className="actions"><DirectHistoryActions id={message.id} status={message.status} archived={Boolean(message.archived_at)}/></div>}</section>
 <section className="panel"><h2>Delivery summary</h2><p role="status" className="muted">{deliverySummaryText(totals)}</p><div className="audience-kpis">{Object.entries(totals).map(([status,count])=><div className="audience-kpi" key={status}><span>{recipientStatusLabel(status)}</span><strong>{count}</strong></div>)}</div>
 {error&&<p className="feedback-error" role="alert">Unable to load recipient outcomes.</p>}
 <p className="muted">Provider accepted is not the same as delivered. Delivery confirmation is shown only when received.</p>
 <div className="table-scroll"><table className="admin-table"><thead><tr><th>Status</th><th>Provider</th><th>Reason</th><th>Last update</th></tr></thead><tbody>{(rows||[]).map((r,i)=><tr key={i}><td>{recipientStatusLabel(r.status)}</td><td>{r.provider||'—'}</td><td>{r.status==='failed'||r.status==='unknown'||r.status==='skipped'?r.error_code||'—':'—'}</td><td>{new Date(r.updated_at).toLocaleString('en-NG')}</td></tr>)}</tbody></table></div></section>
 </WorkspaceShell>;
}
