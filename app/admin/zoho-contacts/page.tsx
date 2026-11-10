import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {charisOrgId} from '@/lib/bank';
import {emailServiceDb} from '@/lib/email/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {syncZohoContacts,attestSignedAccountOpeningForms} from './actions';
export const dynamic='force-dynamic';
export default async function ZohoContactsAdmin(){
 const account=await currentAccount();const org=charisOrgId();
 if(!account||!org||account.workspace.id!==org||!account.providerAdmin)redirect('/dashboard');
 const db=emailServiceDb();
 const [lists,runs,memberships,contacts]=await Promise.all([
  db.from('charis_zoho_contact_lists').select('zoho_list_key,name,contact_count,lock_status,last_synced_at').eq('organization_id',org).order('name'),
  db.from('charis_zoho_contact_sync_runs').select('started_at,finished_at,status,zoho_list_count,zoho_contact_count,inserted_count,matched_count,suppressed_count').eq('organization_id',org).order('started_at',{ascending:false}).limit(5),
  db.from('charis_zoho_contact_memberships').select('id',{count:'exact',head:true}).eq('organization_id',org),
  db.from('contacts').select('id',{count:'exact',head:true}).eq('organization_id',org)
 ]);
 const latest=runs.data?.[0];
 return <WorkspaceShell title="Zoho contact management" subtitle="Administrator-only contact synchronisation and list reconciliation.">
  <section className="panel">
   <h2>One contact directory for Charis</h2>
   <p>Synchronise the existing Zoho Campaigns mailing lists into Charis. Contacts are matched by email, duplicate records are consolidated, and Zoho opt-outs and bounces are added to the bank suppression records. Staff continue to work only in Charis.</p>
   <div className="audience-kpis"><div className="audience-kpi"><span>Charis contacts</span><strong>{(contacts.count||0).toLocaleString()}</strong></div><div className="audience-kpi"><span>Zoho lists found</span><strong>{(lists.data||[]).length.toLocaleString()}</strong></div><div className="audience-kpi"><span>Zoho list memberships</span><strong>{(memberships.count||0).toLocaleString()}</strong></div></div>
   <form action={syncZohoContacts}><button className="btn" type="submit">Synchronise Zoho contacts</button></form>
   {latest&&<p className="muted">Last sync: {new Date(latest.started_at).toLocaleString('en-NG')} · {latest.zoho_contact_count||0} unique Zoho contacts · {latest.inserted_count||0} new · {latest.matched_count||0} already in Charis · {latest.suppressed_count||0} suppressed.</p>}
  </section>
  <section className="panel">
   <h2>Confirm signed account-opening form permission</h2>
   <p>The active status in Zoho confirms the address is active in Zoho; it does not independently prove the permission the customer granted. If the bank's signed account-opening form expressly covers marketing communications, record the bank's evidence-register reference here. Existing opt-outs, denials and bounces are not re-enabled.</p>
   <form action={attestSignedAccountOpeningForms} className="form-grid">
    <label>Evidence register / form reference<input name="reference" minLength={8} maxLength={200} required placeholder="e.g. Account opening form register, batch reference"/></label>
    <label>Permission scope<select name="scope" defaultValue="all_marketing"><option value="all_marketing">General bank marketing communications</option><option value="product_specific">Specific product communications only</option></select></label>
    <label>Product name (only for product-specific permission)<input name="product" maxLength={80}/></label>
    <label className="check-row"><input type="checkbox" name="confirmed" value="yes" required/> I have verified that the signed forms cover the selected permission scope for the imported contacts.</label>
    <button className="btn" type="submit">Record consent evidence</button>
   </form>
  </section>
  <section className="panel">
   <h2>Existing Zoho mailing lists</h2>
   <p className="muted">These are read-only inventory records. No list is deleted or renamed during synchronisation. This protects existing campaign history while duplicate and unused lists are reviewed.</p>
   {(lists.data||[]).length===0?<p className="muted">No Zoho lists have been synchronised yet.</p>:<div className="table-wrap"><table><thead><tr><th>List name</th><th>Zoho contacts</th><th>Access status</th><th>Last synchronised</th></tr></thead><tbody>{(lists.data||[]).map(x=><tr key={x.zoho_list_key}><td>{x.name}</td><td>{x.contact_count}</td><td>{x.lock_status}</td><td>{x.last_synced_at?new Date(x.last_synced_at).toLocaleString('en-NG'):'—'}</td></tr>)}</tbody></table></div>}
  </section>
  <section className="panel"><h2>Recent synchronisations</h2>{(runs.data||[]).length===0?<p className="muted">No synchronisation has run yet.</p>:<div className="table-wrap"><table><thead><tr><th>Started</th><th>Status</th><th>Lists</th><th>Contacts</th><th>New</th><th>Matched</th><th>Suppressed</th></tr></thead><tbody>{(runs.data||[]).map((x,i)=><tr key={i}><td>{new Date(x.started_at).toLocaleString('en-NG')}</td><td>{x.status}</td><td>{x.zoho_list_count}</td><td>{x.zoho_contact_count}</td><td>{x.inserted_count}</td><td>{x.matched_count}</td><td>{x.suppressed_count}</td></tr>)}</tbody></table></div>}</section>
 </WorkspaceShell>;
}
