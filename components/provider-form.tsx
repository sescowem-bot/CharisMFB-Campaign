'use client';
import {useActionState} from 'react';
import {providerAction} from '@/app/admin/providers/actions';
export function ProviderForm({provider,enabled,charis=false,org=''}:{provider:string;enabled:boolean;charis?:boolean;org?:string}) {
 const [state,action,pending]=useActionState(providerAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="provider" value={provider}/><input type="hidden" name="organization_id" value={org}/><label><input type="checkbox" name="enabled" defaultChecked={enabled}/> {charis?'Enable provider for Charis':'Allow companies to use this provider'}</label><div className="actions"><button className="btn" name="action" value="save" disabled={pending}>Save access</button><button className="btn secondary" name="action" value="health" disabled={pending}>Check connection</button></div><div aria-live="polite">{state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div></form>;
}
export function ProviderLimitsForm({provider,daily,interval,org=''}:{provider:string;daily:number;interval:number;org?:string}) {
 const [state,action,pending]=useActionState(providerAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="action" value="limits"/><input type="hidden" name="provider" value={provider}/><input type="hidden" name="organization_id" value={org}/><label>Daily provider budget<input type="number" name="daily_limit" min={1} max={100000} defaultValue={daily} required/></label><label>Seconds between requests<input type="number" name="minimum_interval_seconds" min={1} max={3600} defaultValue={interval} required/></label><button className="btn secondary" disabled={pending}>Save delivery limits</button><div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div></form>;
}
