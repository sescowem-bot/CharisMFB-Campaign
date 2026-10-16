import Link from 'next/link';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {WorkspaceShell} from '@/components/workspace-shell';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function DirectHistory({searchParams}:{searchParams:Promise<{id?:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');const db=await supabaseServer(),org=account.workspace.id,params=await searchParams,id=z.uuid().safeParse(params.id);
 if(!id.success)redirect('/dashboard/communications');
 const {data:message}=await db.from('charis_direct_messages').select('id,title,subject,body,channel,purpose,product,status,recipient_count,created_at').eq('organization_id',org).eq('id',id.data).maybeSingle();
 if(!message)redirect('/dashboard/communications');
 const {data:rows,error}=await db.from('charis_direct_recipients').select('status,provider,error_code,updated_at').eq('organization_id',org).eq('message_id',id.data);
 const totals=(rows||[]).reduce((all,row)=>({...all,[row.status]:(all[row.status]||0)+1}),{} as Record<string,number>);
 return <WorkspaceShell title="Message delivery" actions={<Link href="/dashboard/communications" className="btn secondary">Back to messages</Link>}>
 <section className="panel"><h2>{message.title}</h2><p><strong>Subject:</strong> {message.subject}</p><p className="muted">{message.channel.toUpperCase()} · {message.purpose.replaceAll('_',' ')} · {message.product.replaceAll('_',' ')} · {message.recipient_count} recipients · {new Date(message.created_at).toLocaleString('en-NG')}</p><p style={{whiteSpace:'pre-wrap'}}>{message.body}</p><span className="status-chip">{message.status.replaceAll('_',' ')}</span></section>
 <section className="panel"><h2>Provider outcomes</h2><div className="audience-kpis">{Object.entries(totals).map(([status,count])=><div className="audience-kpi" key={status}><span>{status.replaceAll('_',' ')}</span><strong>{count}</strong></div>)}</div>
 {error&&<p className="feedback-error" role="alert">Unable to load recipient outcomes.</p>}
 <p className="muted">Accepted means a provider acknowledged submission, not proof of inbox or handset delivery. An unknown outcome stops further processing to avoid duplicate messages.</p>
 <div className="table-scroll"><table className="admin-table"><thead><tr><th>Status</th><th>Provider</th><th>Reason</th><th>Last update</th></tr></thead><tbody>{(rows||[]).map((r,i)=><tr key={i}><td>{r.status}</td><td>{r.provider||'—'}</td><td>{r.error_code||'—'}</td><td>{new Date(r.updated_at).toLocaleString('en-NG')}</td></tr>)}</tbody></table></div></section>
 </WorkspaceShell>;
}
