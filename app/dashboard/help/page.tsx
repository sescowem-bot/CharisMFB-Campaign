import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
export default async function Help(){const account=await currentAccount();if(!account)redirect('/login');
 return <WorkspaceShell title="Help & workflows" org={account.workspace?.id} subtitle="How to complete everyday communication tasks in Charis.">
 <div className="admin-columns"><section className="panel"><h2>Communications overview</h2><p>Open Communications to see email and SMS activity together. You can then go straight to the relevant editor, approval inbox or delivery queue. Staff only see routes for which they have permission.</p></section><section className="panel"><h2>Prepare a communication</h2><p>Choose an authorised sender, select eligible recipients, prepare the message and preview it before saving.</p></section>
 <section className="panel"><h2>Review and send</h2><p>Where approval is required, submit the communication to another authorised reviewer. Approved messages can then be sent by staff with the correct permission.</p></section>
 <section className="panel"><h2>Use email templates</h2><p>Open Email templates, choose a starting design, then select a section on the canvas. Type inside a shape or use its Text field. Adjust colours, width, spacing and alignment in the side panel. Drag sections to reorder them or use the arrow buttons. Undo reverses design changes. Switch to Mobile to check a narrow layout, then save your template for use in communications.</p></section>
 <section className="panel"><h2>Branches & customer data</h2><p>Administrators create branches, assign staff to bank-wide or selected-branch access, then allocate customers. Staff with branch-only access use Customer workspace to view their permitted records. Customer editing and campaign dispatch remain controlled by separate bank-wide permissions.</p></section>
 <section className="panel"><h2>Credit repayment reminders</h2><p>Open Credit reminders, select an assigned borrower, or choose several eligible loan accounts. Confirm repayment figures using authorised bank records, personalise the message, save a draft and submit for review. The bank approval policy determines who may approve. Approved reminders can only be staged as held records; this module does not send email or SMS.</p></section>
 <section className="panel"><h2>Manage staff access</h2><p>Administrators can invite staff, create departments, assign responsibilities and configure roles in the Administration Centre.</p></section></div>
 </WorkspaceShell>;
}
