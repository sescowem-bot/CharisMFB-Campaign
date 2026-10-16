import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {DirectCompose} from '@/components/direct-compose';
export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function NewCommunication(){
 const account=await currentAccount();if(!account)redirect('/login');const org=account.workspace.id,db=await supabaseServer();
 const [{data:allowed,error:accessError},{data:settings,error:settingsError},{data:bankWide}]=await Promise.all([
  db.rpc('charis_direct_can_send',{p_org:org}),db.from('charis_direct_settings').select('approval_required,email_enabled,sms_enabled,max_recipients').eq('organization_id',org).maybeSingle(),db.rpc('charis_is_bankwide',{p_org:org})
 ]);
 if(!allowed||accessError)redirect('/dashboard');
 if(settingsError||!settings)return <WorkspaceShell title="New message"><p role="alert" className="feedback-error">Communication settings are unavailable. An administrator should run SQL 047.</p></WorkspaceShell>;
 const [{data:contacts,error:contactError},{data:groups}]=await Promise.all([
  db.from('contacts').select('id,first_name,last_name,email,phone').eq('organization_id',org).is('archived_at',null).order('created_at',{ascending:false}).limit(250),
  bankWide?db.from('contact_lists').select('id,name').eq('organization_id',org).order('name').limit(100):Promise.resolve({data:[]})
 ]);
 return <WorkspaceShell title="New message" subtitle="Compose a bank message, select customers, and send. No separate approval when the bank setting is off." actions={<Link href="/dashboard/communications" className="btn secondary">Communication history</Link>}>
  {contactError&&<p role="alert" className="feedback-error">Customer access could not be loaded. Ask your administrator to check customer viewing permissions.</p>}
  {settings.approval_required&&<p className="notice">Bank approval is currently enabled. Your message will go to the approver rather than send immediately.</p>}
  {!settings.email_enabled&&!settings.sms_enabled?<p role="alert" className="feedback-error">Email and SMS are disabled by the bank administrator.</p>:
   <DirectCompose token={randomUUID()} contacts={contacts||[]} groups={groups||[]} canBulk={bankWide===true} emailEnabled={settings.email_enabled} smsEnabled={settings.sms_enabled} maxRecipients={settings.max_recipients}/>}
 </WorkspaceShell>;
}
