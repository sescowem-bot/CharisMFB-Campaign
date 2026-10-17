import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {z} from 'zod';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CreditReminderAction} from '@/components/charis-credit-reminder-forms';
import {LoanDispatchForm} from '@/components/charis-loan-dispatch-form';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';

/** Load sensitive recipients only after an authorised staff member opens a batch. */
export const dynamic='force-dynamic';
export default async function ReminderDetail({params}:{params:Promise<{id:string}>}){
 const account=await currentAccount();if(!account)redirect('/login');
 const has=(permission:string)=>account.permissions.includes(permission);
 if(!has('credit_reminders.view'))redirect('/dashboard');
 const {id:input}=await params;
 const parsed=z.uuid().safeParse(input);if(!parsed.success)notFound();
 const id=parsed.data,org=account.workspace.id,db=await supabaseServer();
 const [{data:batch,error:batchError},{data:policy}]=await Promise.all([
  db.from('charis_credit_reminder_batches').select('id,channel,subject,status,created_by,submitted_by,review_note,updated_at').eq('organization_id',org).eq('id',id).maybeSingle(),
  db.from('charis_credit_reminder_policy').select('approval_mode').eq('organization_id',org).maybeSingle()
 ]);
 if(batchError||!batch)notFound();
 const [{data:items,error:itemError},{data:holds,error:holdError}]=await Promise.all([
  db.from('charis_credit_reminder_items').select('id,batch_id,loan_reference,recipient_message').eq('organization_id',org).eq('batch_id',id).limit(100),
  db.from('charis_credit_delivery_holds').select('id,batch_id,item_id,channel').eq('organization_id',org).eq('batch_id',id).limit(100)
 ]);
 const {data:dispatches,error:dispatchError}=!holdError&&holds?.length
  ?await db.from('charis_credit_email_dispatches').select('id,hold_id,status,provider_message_id,requested_at').eq('organization_id',org).in('hold_id',holds.map(h=>h.id)).limit(100)
  :{data:[],error:null};
 const heldByItem=new Map((holds||[]).map(hold=>[hold.item_id,hold]));
 const deliveryByHold=new Map((dispatches||[]).map(row=>[row.hold_id,row]));
 const anyAccepted=(dispatches||[]).some(row=>row.status==='accepted');
 const self=batch.created_by===account.id||batch.submitted_by===account.id;
 const direct=policy?.approval_mode==='authorised_direct'&&has('credit_reminders.direct_approve');
 const canReview=has('credit_reminders.approve')&&batch.status==='submitted'&&(!self||direct);
 const mayDispatch=has('credit_reminders.dispatch')&&has('credit_reminders.queue');
 const sendingEnabled=process.env.CHARIS_LOAN_EMAIL_DELIVERY_ENABLED==='true'&&process.env.CHARIS_LOAN_EMAIL_POLICY_APPROVED==='true';
 return <WorkspaceShell title="Reminder details" actions={<Link href="/dashboard/credit-reminders" className="btn secondary">Back to reminders</Link>}>
  <section className="panel"><div className="charis-loan-batch-header"><div><h2>{batch.subject}</h2><p className="muted">{batch.channel.toUpperCase()} · {new Date(batch.updated_at).toLocaleString('en-NG',{timeZone:'Africa/Lagos'})}</p></div><span className="status-chip">{batch.status==='held'?(anyAccepted?'Submitted to provider':'Approved and held'):batch.status.replaceAll('_',' ')}</span></div>
   {batch.review_note&&<p className="muted">Review note: {batch.review_note}</p>}
   <div className="actions" style={{flexWrap:'wrap',alignItems:'flex-start'}}>
    {has('credit_reminders.create')&&batch.created_by===account.id&&['draft','rejected'].includes(batch.status)&&<CreditReminderAction id={id} decision="submit"/>}
    {canReview&&<><CreditReminderAction id={id} decision="approve"/><CreditReminderAction id={id} decision="reject"/></>}
    {has('credit_reminders.queue')&&batch.status==='approved'&&<CreditReminderAction id={id} decision="hold"/>}
    {has('credit_reminders.create')&&batch.created_by===account.id&&['draft','rejected','submitted'].includes(batch.status)&&<CreditReminderAction id={id} decision="cancel"/>}
   </div>
  </section>
  <section className="panel"><h2>Customer messages</h2>
   {(itemError||holdError||dispatchError)&&<p role="alert" className="feedback-error">Some delivery details are unavailable. Do not resend a message until its status is confirmed.</p>}
   {batch.status==='held'&&<p className="muted">Provider acceptance does not confirm delivery. Check the recorded outcome before taking further action.</p>}
   <div className="charis-loan-batch-list">{(items||[]).map(item=>{
    const hold=heldByItem.get(item.id),delivery=hold?deliveryByHold.get(hold.id):undefined;
    return <article className="charis-loan-dispatch" key={item.id}>
      <strong>{item.loan_reference}</strong>
      <p className="muted">{delivery?`Provider ${delivery.status.replaceAll('_',' ')}${delivery.provider_message_id?' · Reference recorded':''}`:hold?'Approved and held — not sent':'Not sent'}</p>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.recipient_message}</p>
      {hold&&batch.channel==='email'&&mayDispatch&&!delivery&&<LoanDispatchForm holdId={hold.id} enabled={sendingEnabled}/>}
      {delivery?.status==='uncertain'&&<p role="alert" className="feedback-error">Provider outcome uncertain. Reconcile before attempting another message.</p>}
    </article>;
   })}</div>
   {!items?.length&&!itemError&&<p className="muted">No customer messages in this batch.</p>}
  </section>
 </WorkspaceShell>;
}
