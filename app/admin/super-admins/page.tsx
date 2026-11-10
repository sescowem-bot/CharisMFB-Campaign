import {redirect} from 'next/navigation';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
import {WorkspaceShell} from '@/components/workspace-shell';
import {setPlatformSuperAdmin} from './actions';

export const dynamic='force-dynamic';
export default async function PlatformSuperAdmins({searchParams}:{searchParams:Promise<{saved?:string}>}){
 const account=await currentAccount();
 if(!account?.owner)redirect('/admin');
 const db=await supabaseServer();
 const {data,error}=await db.rpc('charis_platform_super_admin_list');
 const {saved=''}=await searchParams;
 return <WorkspaceShell title="Platform administrators" subtitle="Manage trusted super administrator accounts.">
  <section className="panel">
   <h2>Add a super administrator</h2>
   <p className="muted">Enter the email address of an existing, verified Charis Campaign account. That account will receive platform-wide administrator access after confirmation.</p>
   <form action={setPlatformSuperAdmin} className="form-grid">
    <label>Verified account email<input type="email" name="email" required maxLength={254} placeholder="admin@charismfb.com"/></label>
    <input type="hidden" name="enabled" value="yes"/>
    <button className="btn" type="submit">Grant super administrator access</button>
   </form>
   {saved==='1'&&<p role="status">Administrator list updated.</p>}
   {error&&<p className="feedback-error" role="alert">Administrator list could not be loaded. Apply migration 087 and try again.</p>}
  </section>
  <section className="panel">
   <h2>Current super administrators</h2>
   {(data||[]).length===0?<p className="muted">No administrator records were returned.</p>:<div className="table-wrap"><table><thead><tr><th>Email</th><th>Added</th><th>Action</th></tr></thead><tbody>{(data||[]).map((row:{user_id:string,email:string,created_at:string})=><tr key={row.user_id}><td>{row.email}</td><td>{new Date(row.created_at).toLocaleDateString('en-NG')}</td><td><form action={setPlatformSuperAdmin}><input type="hidden" name="email" value={row.email}/><input type="hidden" name="enabled" value="no"/><button className="btn secondary" type="submit" disabled={row.user_id===account.id}>Remove access</button></form></td></tr>)}</tbody></table></div>}
   <p className="muted">The last remaining super administrator cannot be removed. Removing access does not delete the user's account.</p>
  </section>
 </WorkspaceShell>;
}
