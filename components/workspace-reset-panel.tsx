'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { previewWorkspaceReset, runWorkspaceReset } from '@/app/admin/reset/actions';

type Preview = {
  counts?: Record<string, number>;
  scoped_rows?: number;
  preserved?: string[];
};

const labels: Record<string, string> = {
  sending_domains: 'Sending domains',
  sender_identities: 'Sender email identities',
  email_test_attempts: 'Email test attempts',
  campaign_drafts: 'Campaign drafts',
  campaign_revisions: 'Campaign revisions',
  campaign_runs: 'Campaign runs',
  email_deliveries: 'Campaign delivery records',
  email_delivery_events: 'Provider delivery events',
  delivery_quota_reservations: 'Delivery quota reservations',
  contacts: 'Contacts',
  contact_lists: 'Contact lists',
  contact_list_members: 'Contact list memberships',
  contact_segments: 'Contact segments',
  contact_import_batches: 'Contact import batches',
  contact_import_issues: 'Import issues',
  charis_import_consent_records: 'Imported consent records',
  charis_direct_messages: 'Direct communications',
  charis_direct_recipients: 'Direct communication recipients',
  charis_direct_delivery_events_060: 'Direct delivery events',
  charis_sms_campaigns: 'SMS campaigns',
  charis_sms_tests: 'SMS test records',
  charis_resend_broadcast_jobs: 'Broadcast jobs',
  charis_email_routes: 'Email routes',
  charis_direct_provider_prefs: 'Direct provider sender selections',
  charis_email_preference_tokens: 'Email preference tokens',
  charis_subscription_events: 'Subscription event history',
  charis_resubscribe_requests: 'Resubscription requests',
  charis_subscription_sync: 'Subscription sync records',
  email_suppressions: 'Email suppression records',
  charis_optional_email_optouts: 'Optional email opt-outs',
  charis_zoho_email_events: 'Legacy Zoho email events',
  charis_zoho_email_suppressions: 'Legacy Zoho suppressions',
  charis_zoho_broadcasts: 'Legacy Zoho broadcasts',
  charis_zoho_contact_memberships: 'Legacy Zoho contact memberships',
  charis_zoho_consent_attestations: 'Legacy Zoho consent attestations',
  charis_zoho_contact_sync_runs: 'Legacy Zoho sync runs',
  charis_zoho_contact_lists: 'Legacy Zoho lists',
  charis_zoho_manual_letters: 'Legacy Zoho test correspondence',
  charis_zeptomail_notices: 'ZeptoMail test notices',
};

export function WorkspaceResetPanel() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, startTransition] = useTransition();

  async function loadPreview() {
    setError('');
    const response = await previewWorkspaceReset();
    if (response.error) setError(response.error);
    else setPreview(response.data as Preview);
  }

  useEffect(() => { void loadPreview(); }, []);

  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      setError('');
      setResult('');
      const response = await runWorkspaceReset({}, formData);
      if (response.error) setError(response.error);
      else {
        setResult('Reset completed. The Charis workspace is ready for fresh setup.');
        setPreview(null);
        setPhrase('');
        await loadPreview();
      }
    });
  }

  const counts = preview?.counts || {};
  const rows = Object.entries(counts).filter(([, value]) => Number(value) > 0);
  const total = Number(preview?.scoped_rows || 0);

  return (
    <section className="charis-reset-card">
      <div className="charis-reset-warning">
        <strong>Permanent action</strong>
        <p>This removes the workspace’s test campaigns, sender domains, test emails, contacts, imports and communication history. It cannot be undone.</p>
      </div>

      {error && <p role="alert" className="feedback-error">{error}</p>}
      {result && <p role="status" className="feedback-success">{result}</p>}

      <h2>Reset preview</h2>
      <p>The preview is limited to the Charis organisation. The reset does not remove login accounts or provider credentials.</p>

      {!preview && !error && <p>Loading reset preview…</p>}
      {preview && (
        <>
          <p><strong>{total.toLocaleString()} records</strong> are included in the reset preview.</p>
          {rows.length ? (
            <ul className="charis-reset-counts">
              {rows.map(([key, value]) => (
                <li key={key}><span>{labels[key] || key.replaceAll('_', ' ')}</span><strong>{Number(value).toLocaleString()}</strong></li>
              ))}
            </ul>
          ) : <p>No test records were found in the listed tables.</p>}

          <h3>Items that will remain</h3>
          <ul>
            {(preview.preserved || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}

      <form onSubmit={submitReset} className="charis-reset-form">
        <label htmlFor="reset-confirmation">Type RESET CHARIS TEST DATA to confirm</label>
        <input
          id="reset-confirmation"
          name="confirmation"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="RESET CHARIS TEST DATA"
          required
        />
        <button type="submit" disabled={busy || !preview || phrase !== 'RESET CHARIS TEST DATA'}>
          {busy ? 'Resetting workspace…' : 'Permanently reset test data'}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void loadPreview()}>
          Refresh preview
        </button>
      </form>
    </section>
  );
}
