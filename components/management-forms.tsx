'use client';
import {useActionState,useRef,useState} from 'react';
import {companySettingsAction,teamAction,inviteStaffAction,cancelInviteAction} from '@/app/dashboard/team/actions';

type Member={id:string;email:string;role:string};
const roleOptions=[
 {value:'company_admin',label:'Company administrator',description:'Manage staff, settings and company campaigns.'},
 {value:'manager',label:'Campaign manager',description:'Manage contacts and campaign operations.'},
 {value:'designer',label:'Campaign creator',description:'Design and edit campaigns.'},
 {value:'approver',label:'Campaign approver',description:'Review campaigns independently.'},
 {value:'analyst',label:'Reporting analyst',description:'View reporting and campaign activity.'},
 {value:'viewer',label:'Viewer',description:'Read-only company access.'},
 {value:'remove',label:'Remove access',description:'Revoke company membership.'},
] as const;
type Role=typeof roleOptions[number]['value'];
const isRole=(value:string):value is Role=>roleOptions.some(option=>option.value===value);
const roleLabel=(role:string)=>roleOptions.find(r=>r.value===role)?.label||role.replaceAll('_',' ');

export function TeamForm({org,members,currentUserId}:{org:string;members:Member[];currentUserId:string}){
 const [state,action,pending]=useActionState(teamAction,{});
 const [email,setEmail]=useState('');
 const [role,setRole]=useState<Role>('viewer');
 const emailRef=useRef<HTMLInputElement>(null);
 const selected=members.find(m=>m.email.toLowerCase()===email.trim().toLowerCase());
 const adminCount=members.filter(m=>m.role==='company_admin').length;
 const soleAdminChange=selected?.role==='company_admin'&&adminCount<=1&&role!=='company_admin';
 const unchanged=!!selected&&selected.role===role;
 const selectMember=(member:Member)=>{
  setEmail(member.email);
  setRole(isRole(member.role)?member.role:'viewer');
  emailRef.current?.focus();
 };
 const changeEmail=(next:string)=>{
  setEmail(next);
  const match=members.find(m=>m.email.toLowerCase()===next.trim().toLowerCase());
  setRole(match&&isRole(match.role)?match.role:'viewer');
 };
 return <div className="admin-columns charis-team-columns">
  <form action={action} className="admin-form charis-team-form">
   <input type="hidden" name="org" value={org}/>
   <h2>{selected?'Update staff role':'Manage existing staff'}</h2>
   <p className="muted">Select a current member on the right to edit their role. To add a new staff member, use Invite Staff above.</p>
   <label>Staff email address
    <input ref={emailRef} name="email" type="email" maxLength={254} value={email} onChange={e=>changeEmail(e.target.value)} placeholder="staff@yourbank.com" autoComplete="email" readOnly required/>
   </label>
   {selected&&<div className="charis-team-current">Current role: <strong>{roleLabel(selected.role)}</strong>{selected.id===currentUserId&&<span> · Your account</span>}</div>}
   <label>Assign role
    <select name="role" value={role} onChange={e=>setRole(e.target.value as Role)}>
     {roleOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
   </label>
   <p className="muted charis-team-role-help">{roleOptions.find(option=>option.value===role)?.description}</p>
   {soleAdminChange?<p role="alert" className="notice">This is the only company administrator. Assign another verified staff account as Company administrator first, then you can change this account’s role.</p>:null}
   {!selected&&role==='remove'?<p role="alert" className="notice">This email is not listed as a current company member.</p>:null}
   <button className="btn" disabled={pending||soleAdminChange||unchanged||!selected}>
    {pending?'Saving access…':'Save role change'}
   </button>
   <div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div>
   <p className="muted charis-team-footnote">To add a colleague, use the Charis invitation form. Platform Super Admin access is managed separately and is not granted by company roles.</p>
  </form>
  <section className="panel charis-team-members">
   <div className="workspace-heading"><h2>Current team</h2><span className="status-chip">{members.length} {members.length===1?'member':'members'}</span></div>
   {members.length? <ul className="charis-team-member-list">{members.map(member=><li key={member.id}>
    <div><strong className="charis-team-email">{member.email}</strong><span className="charis-team-role">{roleLabel(member.role)}{member.id===currentUserId?' · You':''}</span></div>
    <button type="button" className="btn secondary" onClick={()=>selectMember(member)} aria-label={`Manage ${member.email}`}>Manage</button>
   </li>)}</ul>:<p className="muted">No staff assigned to this workspace yet.</p>}
   <p className="muted charis-team-footnote">For security, Charis must always have at least one company administrator.</p>
  </section>
 </div>;
}
export function CompanySettingsForm({org,status,monthly}:{org:string;status:string;monthly:number|null}){const [state,action,pending]=useActionState(companySettingsAction,{});return <form action={action} className="admin-form"><input type="hidden" name="org" value={org}/><label>Company status<select name="status" defaultValue={status}><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label><label>Monthly email override<input name="monthly" type="number" min={0} max={10000000} defaultValue={monthly??''} placeholder="Use plan allowance"/></label><p className="muted">Blank uses the active plan allowance. Zero blocks campaign dispatch. Overrides apply to the active subscription only. Suspending pauses queued/running campaigns; requests already in flight may finish.</p><button className="btn secondary" disabled={pending}>Save company controls</button><div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div></form>;}

export type TeamInvitation={id:string;email:string;role:string;expires_at:string;invited_at:string};
export function InviteStaffForm({org,pendingInvitations}:{org:string;pendingInvitations:TeamInvitation[]}){
 const [state,action,busy]=useActionState(inviteStaffAction,{});
 const [cancelState,cancelAction,cancelling]=useActionState(cancelInviteAction,{});
 return <section className="panel charis-invite-panel">
  <div className="workspace-heading"><div><h2>Invite Charis staff</h2><p className="muted">Send a secure invitation. Your colleague will confirm their email, set a password and receive their assigned workspace role.</p></div></div>
  <form action={action} className="admin-form charis-invite-form">
   <input type="hidden" name="org" value={org}/>
   <label>Staff email address<input type="email" name="email" required maxLength={254} placeholder="colleague@charismfb.com" autoComplete="off"/></label>
   <label>Staff role<select name="role" defaultValue="viewer" required>
    {roleOptions.filter(r=>r.value!=='remove').map(r=><option value={r.value} key={r.value}>{r.label}</option>)}
   </select></label>
   <button className="btn" disabled={busy} type="submit">{busy?'Sending invitation…':'Send staff invitation'}</button>
   <div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div>
  </form>
  <h3>Pending invitations ({pendingInvitations.length})</h3>
  {pendingInvitations.length?<div className="table-scroll"><table className="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Expires</th><th>Action</th></tr></thead><tbody>{pendingInvitations.map(i=><tr key={i.id}>
   <td>{i.email}</td><td>{roleLabel(i.role)}</td><td>{new Date(i.expires_at).toLocaleDateString()}</td><td><form action={cancelAction}><input type="hidden" name="org" value={org}/><input type="hidden" name="id" value={i.id}/><button className="btn secondary" disabled={cancelling}>Cancel invite</button></form></td>
  </tr>)}</tbody></table></div>:<p className="muted">No pending staff invitations.</p>}
  <div aria-live="polite">{cancelState.error&&<p role="alert" className="feedback-error">{cancelState.error}</p>}{cancelState.success&&<p className="feedback-success">{cancelState.success}</p>}</div>
 </section>;
}
