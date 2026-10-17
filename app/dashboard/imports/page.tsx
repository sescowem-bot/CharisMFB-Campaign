import {redirect} from 'next/navigation';
import {contactsAccess} from '@/lib/contacts/access';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ContactImportWizard} from '@/components/contact-import-wizard';
import {ImportIssueReview} from '@/components/import-issue-review';
export const dynamic='force-dynamic';
export default async function Imports({searchParams}:{searchParams:Promise<{org?:string;review?:string}>}){
 const {org,review}=await searchParams;if(!org)redirect('/dashboard');
 const {db,user,authorized}=await contactsAccess(org);
 if(!user)redirect('/login');if(!authorized)redirect('/dashboard');
 // The contact groups and recent batches are independent; avoid serial network calls.
 const [{data:lists},{data:recent,error}]=await Promise.all([
  db.from('contact_lists').select('id,name').eq('organization_id',org).order('created_at',{ascending:false}).limit(100),
  db.from('contact_import_batches').select('id,batch_key,inserted_count,skipped_count,rejected_count,created_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(80)
 ]);
 return <WorkspaceShell org={org} title="Import contacts"><p className="muted">Upload Excel or CSV, match columns, and review the result. Recorded consent is required for promotional email. Existing opt-outs stay protected.</p><ContactImportWizard org={org} lists={lists||[]}/><ImportIssueReview org={org} batches={recent||[]} initial={review}/><h2>Recent import batches</h2>{error&&<p role="alert">Could not load import history.</p>}<div className="table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Added</th><th>Duplicate</th><th>Invalid</th></tr></thead><tbody>{(recent||[]).map(b=><tr key={b.id}><td>{new Date(b.created_at).toLocaleDateString('en-NG')}</td><td>{b.inserted_count}</td><td>{b.skipped_count}</td><td>{b.rejected_count}</td></tr>)}</tbody></table></div>{!recent?.length&&<p className="muted">No imports yet.</p>}</WorkspaceShell>;
}
