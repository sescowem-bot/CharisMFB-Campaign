import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {WorkspaceShell} from '@/components/workspace-shell';
import {CreditMonthlyImportPreview} from '@/components/credit-monthly-import-preview';
export default async function LoanImport(){
 const account=await currentAccount();if(!account)redirect('/login');
 if(!account.permissions.includes('loans.manage'))redirect('/dashboard');
 return <WorkspaceShell title="Monthly loan file review" subtitle="Validate core-banking exports before reconciliation.">
  <p><Link className="inline-link" href="/dashboard/loans">Back to loan portfolio</Link></p>
  <CreditMonthlyImportPreview/>
 </WorkspaceShell>;
}
