/** Human-readable statuses. Provider acceptance is never presented as inbox delivery. */
export type DirectRecipientStatus = 'pending' | 'sending' | 'accepted' | 'failed' | 'unknown' | 'skipped' | 'delivered' | 'bounced' | 'complained' | 'unsubscribed' | 'blocked';
export function recipientStatusLabel(status:string):string {
 const labels:Record<string,string>={pending:'Waiting',sending:'Sending',accepted:'Accepted by provider',delivered:'Delivered',bounced:'Bounced',complained:'Spam complaint',unsubscribed:'Unsubscribed',blocked:'Blocked',failed:'Failed',unknown:'Needs review',skipped:'Not sent'};
 return labels[status]||'Unknown';
}
export function messageStatusLabel(status:string,scheduledAt:string|null|undefined,now=Date.now()):string {
 if(scheduledAt && new Date(scheduledAt).getTime()>now && ['queued','pending_approval'].includes(status))
  return status==='pending_approval'?'Scheduled · Awaiting approval':'Scheduled';
 const labels:Record<string,string>={queued:'Waiting to send',pending_approval:'Awaiting approval',sending:'Sending',completed:'Processed',paused:'Needs review',cancelled:'Cancelled'};
 return labels[status]||'Unknown';
}
export function deliverySummaryText(totals:Record<string,number>):string {
 const accepted=totals.accepted||0,delivered=totals.delivered||0,failed=totals.failed||0,unknown=totals.unknown||0;
 const pending=(totals.pending||0)+(totals.sending||0),skipped=totals.skipped||0;
 const segments:string[]=[];
 if(delivered)segments.push(`${delivered} delivered`);
 if(accepted)segments.push(`${accepted} accepted by provider`);
 if(pending)segments.push(`${pending} waiting or sending`);
 if(failed)segments.push(`${failed} failed`);
 if(unknown)segments.push(`${unknown} need review`);
 if(skipped)segments.push(`${skipped} not sent`);
 const bounced=(totals.bounced||0)+(totals.complained||0)+(totals.blocked||0)+(totals.unsubscribed||0);
 if(bounced)segments.push(`${bounced} bounced, blocked or unsubscribed`);
 return segments.length?segments.join(' · '):'No recipient outcomes recorded';
}
