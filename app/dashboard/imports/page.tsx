import {redirect} from 'next/navigation';
import {Upload} from 'lucide-react';
import {Callout,EmptyState} from '@/components/ui';
import {contactsAccess} from '@/lib/contacts/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ContactImportWizard} from '@/components/contact-import-wizard';
export const dynamic='force-dynamic';
export default async function Imports({searchParams}:{searchParams:Promise<{org?:string}>}){
 const {org}=await searchParams;if(!org)redirect('/dashboard');
 const {db,user,authorized}=await contactsAccess(org);
 if(!user)redirect('/login');if(!authorized)redirect('/dashboard');
 const {data:lists}=await db.from('contact_lists').select('id,name').eq('organization_id',org).order('created_at',{ascending:false}).limit(100);
 const {data:recent,error}=await db.from('contact_import_batches').select('id,inserted_count,skipped_count,rejected_count,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(20);
 return <WorkspaceShell org={org} title="Import contacts" subtitle="Upload a CSV or Excel file. You will map columns, preview the result and skip duplicates before anything is saved.">
  <ol className="stepper" aria-label="Import steps">{[['Upload','Choose your file'],['Map','Match the columns'],['Preview','Check every row'],['Import','Save to a group']].map(([t,d],i)=><li key={t} className={i===0?'current':''}><span className="step-dot">{i+1}</span><strong>{t}</strong><small>{d}</small></li>)}</ol>
  <ContactImportWizard org={org} lists={lists||[]}/>
  <div className="page-head" style={{marginTop:34,marginBottom:6}}><div><h2>Recent imports</h2></div></div>
  {error&&<Callout tone="danger" alert>Could not load import history.</Callout>}
  {recent?.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Added</th><th>Duplicates</th><th>Invalid</th></tr></thead><tbody>{recent.map(b=><tr key={b.id}><td>{new Date(b.created_at).toLocaleDateString('en-NG',{dateStyle:'medium'})}</td><td><span className="badge badge-success">{b.inserted_count}</span></td><td>{b.skipped_count}</td><td>{b.rejected_count}</td></tr>)}</tbody></table></div>:!error&&<EmptyState icon={Upload} title="No imports yet" text="Your import history will appear here."/>}
 </WorkspaceShell>;
}
