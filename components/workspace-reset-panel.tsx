'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { previewWorkspaceReset, runWorkspaceReset } from '@/app/admin/reset/actions';

type Category = { key: string; label: string; description: string; count: number; blocked?: string[] };
type Preview = { categories?: Category[]; preserved?: string[] };

const confirmationPhrase = 'DELETE SELECTED CHARIS DATA';

export function WorkspaceResetPanel() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, startTransition] = useTransition();

  async function loadPreview() {
    setError('');
    const response = await previewWorkspaceReset();
    if (response.error) setError(response.error);
    else {
      setPreview(response.data as Preview);
      setSelected([]);
      setStep('select');
      setPhrase('');
    }
  }

  useEffect(() => { void loadPreview(); }, []);

  const categories = useMemo(() => preview?.categories ?? [], [preview]);
  const chosen = useMemo(() => categories.filter((item) => selected.includes(item.key)), [categories, selected]);
  const total = chosen.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const blocked = chosen.filter((item) => item.blocked?.length);

  function toggle(key: string, checked: boolean) {
    setSelected((current) => checked ? [...current, key] : current.filter((item) => item !== key));
  }

  function continueToConfirmation() {
    setError('');
    if (!selected.length) { setError('Select at least one data group to continue.'); return; }
    if (blocked.length) { setError('One or more selected groups have dependencies. Review the message beside each group and adjust your selection.'); return; }
    setStep('confirm');
  }

  function deleteSelected() {
    startTransition(async () => {
      setError('');
      setResult('');
      const response = await runWorkspaceReset({
        categories: selected,
        confirmation: phrase,
      });
      if (response.error) setError(response.error);
      else {
        setResult('The selected records have been deleted. Protected workspace settings and staff access remain unchanged.');
        await loadPreview();
      }
    });
  }

  return (
    <section className="charis-reset-card">
      <div className="charis-reset-warning">
        <strong>Careful: selected records are permanently deleted</strong>
        <p>This tool only removes the data groups you choose. It does not reset the entire workspace.</p>
      </div>

      {error && <p role="alert" className="feedback-error">{error}</p>}
      {result && <p role="status" className="feedback-success">{result}</p>}

      <div className="charis-reset-stepper" aria-label="Reset steps">
        <span className={step === 'select' ? 'active' : 'complete'}>1. Select data</span>
        <span className={step === 'confirm' ? 'active' : ''}>2. Confirm deletion</span>
      </div>

      {!preview && !error && <p>Loading workspace records…</p>}

      {preview && step === 'select' && (
        <>
          <div className="charis-reset-heading">
            <div><h2>Choose what to delete</h2><p>Each group is independent. Nothing is deleted on this screen.</p></div>
            <div className="charis-reset-selection"><strong>{selected.length}</strong><span>groups selected</span></div>
          </div>
          <div className="charis-reset-toolbar">
            <button type="button" className="secondary" onClick={() => setSelected(categories.filter(c => c.count > 0 && !c.blocked?.length).map(c => c.key))}>Select all available</button>
            <button type="button" className="secondary" onClick={() => setSelected([])}>Clear selection</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => void loadPreview()}>Refresh counts</button>
          </div>
          <div className="charis-reset-categories">
            {categories.map((item) => (
              <label className={`charis-reset-category ${selected.includes(item.key) ? 'selected' : ''}`} key={item.key}>
                <input type="checkbox" checked={selected.includes(item.key)} disabled={busy || Boolean(item.blocked?.length) || item.count === 0} onChange={(event) => toggle(item.key, event.target.checked)} />
                <span className="charis-reset-category-copy"><strong>{item.label}</strong><small>{item.description}</small>
                  {item.blocked?.map((message) => <em key={message}>{message}</em>)}
                </span>
                <b>{Number(item.count).toLocaleString()}</b>
              </label>
            ))}
          </div>
          <div className="charis-reset-footer">
            <span><strong>{total.toLocaleString()}</strong> records selected for deletion</span>
            <button type="button" disabled={busy || !selected.length || blocked.length > 0} onClick={continueToConfirmation}>Continue to confirmation</button>
          </div>
        </>
      )}

      {preview && step === 'confirm' && (
        <div className="charis-reset-final">
          <div className="charis-reset-final-icon">!</div>
          <h2>Confirm permanent deletion</h2>
          <p>You are about to permanently delete <strong>{total.toLocaleString()} records</strong> from the following groups:</p>
          <ul>{chosen.map((item) => <li key={item.key}><span>{item.label}</span><strong>{item.count.toLocaleString()}</strong></li>)}</ul>
          <div className="charis-reset-protected"><strong>These will remain untouched</strong>
            <ul>{(preview.preserved || []).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <label className="charis-reset-confirm-label" htmlFor="reset-confirmation">Type <b>{confirmationPhrase}</b> to enable the delete button</label>
          <input id="reset-confirmation" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" spellCheck={false} placeholder={confirmationPhrase} />
          <div className="charis-reset-final-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setStep('select'); setPhrase(''); }}>Back to selection</button>
            <button type="button" className="danger" disabled={busy || phrase !== confirmationPhrase} onClick={deleteSelected}>{busy ? 'Deleting selected records…' : 'Permanently delete selected data'}</button>
          </div>
          <p className="charis-reset-final-note">This action cannot be undone. The system will recheck dependencies before deleting anything.</p>
        </div>
      )}
      <div className="charis-reset-preserve-note">Protected at all times: login accounts, organisation, staff memberships, platform roles, provider credentials, sender routing, branding, core settings, permissions and audit history.</div>
    </section>
  );
}
