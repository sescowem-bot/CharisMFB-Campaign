import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {StaffGettingStarted} from '@/components/staff-getting-started';
export default async function Help(){
 const account=await currentAccount();if(!account)redirect('/login');
 const org=account.workspace.id;
 const manageContacts=account.permissions.includes('customers.manage');
 const viewContacts=manageContacts||account.permissions.includes('customers.view');
 const credit=account.permissions.some(x=>['loans.view','credit_reminders.view','credit_reminders.create'].includes(x));
 return <WorkspaceShell title="Help & Guides" subtitle="Quick guides for everyday work.">
  <StaffGettingStarted userId={account.id} contactsPath={manageContacts?`/dashboard/contacts?org=${org}`:"/dashboard/customers"} replay/>
  <section className="panel">
   <h2>Find the right report</h2>
   <p className="muted">Campaign Reports show sending results and provide a CSV export. Operations Reports show available customer and credit activity; they are not official core-banking financial statements.</p>
   <div className="actions">
    {(account.owner||account.permissions.includes('reports.view'))&&<Link className="btn secondary" href="/dashboard/reports">Campaign Reports</Link>}
    {(account.owner||account.permissions.includes('operations.view'))&&<Link className="btn secondary" href="/dashboard/insights">Operations Reports</Link>}
   </div>
  </section>
  <div className="admin-columns">
   <section className="panel"><h2>1. Create a campaign</h2><p>Choose Email or SMS, write your message, then select recipients.</p><Link className="inline-link" href="/dashboard/communications/new">Create Campaign →</Link></section>
   {viewContacts&&<section className="panel"><h2>2. Manage contacts</h2><p>Find customers, review contact details and organise groups.</p><Link className="inline-link" href={manageContacts?`/dashboard/contacts?org=${org}`:'/dashboard/customers'}>Open Contacts →</Link></section>}
   {manageContacts&&<section className="panel"><h2>3. Import contacts</h2><p>Upload Excel or CSV, match fields and review the result. Existing opt-outs remain protected.</p><Link className="inline-link" href={`/dashboard/imports?org=${org}`}>Import Contacts →</Link></section>}
   <section className="panel"><h2>4. Check results</h2><p>Open Campaigns to view sending progress. A provider accepting a message does not guarantee delivery.</p><Link className="inline-link" href="/dashboard/communications">All Campaigns →</Link></section>
   {credit&&<section className="panel"><h2>Loan reminders</h2><p>Open Loan Reminders to manage permitted repayment notices. Check loan details before proceeding.</p><Link className="inline-link" href="/dashboard/credit-reminders">Loan Reminders →</Link></section>}
  </div>
 </WorkspaceShell>;
}
