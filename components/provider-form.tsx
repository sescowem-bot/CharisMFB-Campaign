'use client';
import {useActionState} from 'react';
import {providerAction} from '@/app/admin/providers/actions';
export function ProviderForm({provider,enabled}:{provider:string;enabled:boolean}) {
 const [state,action,pending]=useActionState(providerAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="provider" value={provider}/><label><input type="checkbox" name="enabled" defaultChecked={enabled}/> Allow companies to use this provider</label><div className="actions"><button className="btn" name="action" value="save" disabled={pending}>Save access</button><button className="btn secondary" name="action" value="health" disabled={pending}>Check connection</button></div><div aria-live="polite">{state.error&&<p className="feedback-error" role="alert">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div></form>;
}
export function ReconcileForm({id,provider}:{id:string;provider:string}) {
 const [state,action,pending]=useActionState(providerAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="action" value="reconcile"/><input type="hidden" name="domain_id" value={id}/><input type="hidden" name="provider" value={provider}/><label>Provider Domain ID (not the domain name)<input name="provider_domain_id" required maxLength={200} placeholder="Copy the ID from the Resend or Brevo dashboard" autoComplete="off"/></label><p className="muted">Open the selected email provider account and find the registered domain. Copy its provider-assigned ID. Do not enter a domain name, email address or the Charis internal record ID. The system checks this ID with the provider before linking.</p><button className="btn" disabled={pending}>Link checked provider domain</button><div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div></form>;
}

export function ProviderLimitsForm({provider,daily,interval}:{provider:string;daily:number;interval:number}) {
 const [state,action,pending]=useActionState(providerAction,{});
 return <form action={action} className="admin-form"><input type="hidden" name="action" value="limits"/><input type="hidden" name="provider" value={provider}/><label>Daily provider budget<input type="number" name="daily_limit" min={1} max={1000000} defaultValue={daily} required/></label><label>Seconds between requests<input type="number" name="minimum_interval_seconds" min={1} max={3600} defaultValue={interval} required/></label><button className="btn secondary" disabled={pending}>Save delivery limits</button><div aria-live="polite">{state.error&&<p role="alert" className="feedback-error">{state.error}</p>}{state.success&&<p className="feedback-success">{state.success}</p>}</div></form>;
}
