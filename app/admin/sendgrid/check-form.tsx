'use client';
import {useActionState} from 'react';
import {checkSendgrid,type SendgridCheckState} from './actions';
export function SendgridCheckForm(){
 const [state,submit,pending]=useActionState<SendgridCheckState,FormData>(checkSendgrid,{});
 return <form action={submit} className="panel" style={{display:'grid',gap:'1rem'}}>
  <h2>SendGrid verification</h2>
  <p className="muted">Use the verified Charis sender configured in Vercel. These checks never send customer messages or activate a campaign.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
   <button className="btn btn-primary" type="submit" name="operation" value="domain" disabled={pending}>Verify sender domain</button>
   <button className="btn btn-secondary" type="submit" name="operation" value="sandbox" disabled={pending}>Validate API request (no delivery)</button>
  </div>
  {pending&&<p role="status">Checking SendGrid…</p>}
  {state.error&&<p className="feedback-error" role="alert">{state.error}</p>}
  {state.success&&<p className="feedback-success" role="status">{state.success}</p>}
 </form>;
}
