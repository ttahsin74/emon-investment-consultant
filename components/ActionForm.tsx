'use client';
import { useState, startTransition } from 'react';
import type { CSSProperties, ReactNode } from 'react';
export default function ActionForm({ action, children, confirmMessage, ...props }: { action: (data: FormData) => Promise<void>; children: ReactNode; confirmMessage?: string; className?: string; style?: CSSProperties; encType?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  return <form {...props} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true); setError(''); setSaved(false);
    try { await action(data); setSaved(true); }
    catch (e) { if (e && typeof e === 'object' && 'digest' in e && String(e.digest).startsWith('NEXT_REDIRECT')) throw e; setError(e instanceof Error && !('digest' in e) ? e.message : 'Unable to save. Please check your details and try again.'); }
    finally { setPending(false); }
    });
  }} aria-busy={pending}>
    {error && <div className="error" role="alert">{error}</div>}
    <fieldset disabled={pending} className="action-fields">{children}</fieldset>
    <div className="form-status" role="status">{pending ? 'Saving changes...' : saved ? 'Changes saved successfully.' : ''}</div>
  </form>;
}
