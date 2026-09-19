'use client';

import { useState } from 'react';
import { History, LockKeyhole, MessageSquare } from 'lucide-react';
import ActionForm from '@/components/ActionForm';
import { addFollowup } from '@/app/actions';
import { closedLeadStatus, type Followup } from '@/lib/followups';
import { followupTypes, shortDate } from '@/lib/utils';

type Props = {
  client: { id: number; status: string };
  followups: Followup[];
  currentDate: string;
  selectedLeadStatus?: string;
};

export default function FollowupWorkspace({ client, followups, currentDate, selectedLeadStatus }: Props) {
  const closed = closedLeadStatus(client.status);
  const closingInEditor = !!closedLeadStatus(selectedLeadStatus || '');
  const latestId = followups.reduce((id, entry) => Math.max(id, entry.id), 0);

  return <section id="followup-workspace" className="followup-workspace" aria-label="Follow-ups">
    <section className="card followup-history" aria-labelledby="followup-history-heading">
      <div className="section-head followup-card-heading"><div className="followup-card-title"><span className="followup-heading-icon"><History size={20} aria-hidden="true" /></span><div><h2 id="followup-history-heading" className="section-title">Follow-up history <span className="followup-count">{followups.length}</span></h2><p>Previous conversations, latest first</p></div></div></div>
      {followups.length ? <ol className="followup-timeline" tabIndex={0} aria-label="Previous follow-ups">
        {followups.map((entry) => {
          const outcome = closedLeadStatus(entry.status);
          return <li key={entry.id} className="followup-history-entry">
            <div className="followup-entry-head"><div><time dateTime={entry.followup_date}>{shortDate(entry.followup_date)}</time>{entry.type && entry.type !== 'Other' && <span className="small muted">{entry.type}</span>}</div>
              <span className={`badge ${outcome === 'Closed Won' ? 'success' : outcome === 'Closed Lost' ? 'danger' : 'gray'}`}>{outcome === 'Closed Won' ? 'Deal won' : outcome === 'Closed Lost' ? 'Deal lost' : 'Follow-up'}</span>
            </div>
            <p className="followup-discussion">{entry.discussion}</p>
            {entry.result && <p className="followup-result"><b>Result:</b> {entry.result}</p>}
            {entry.next_followup_date && <div className="small muted">{entry.status === 'Pending' && !closed ? 'Next follow-up' : 'Planned follow-up'}: {shortDate(entry.next_followup_date)}</div>}
          </li>;
        })}
      </ol> : <div className="empty">No follow-ups yet.</div>}
    </section>

    {closed || closingInEditor ? <div className="note followup-closed" role="status"><LockKeyhole size={20} aria-hidden="true" /><div>
      <b>{closed ? `Lead closed — ${closed === 'Closed Won' ? 'deal won' : 'deal lost'}` : 'Closing this lead'}</b>
      <p>{closed ? 'Your follow-up history is saved. Reopen the lead in Edit Client to follow up again.' : 'Save Changes to close this lead. Previous follow-ups will stay here.'}</p>
    </div></div> : <section className="card card-pad followup-current" aria-labelledby="current-followup-heading">
      <div className="followup-card-heading"><div className="followup-card-title"><span className="followup-heading-icon"><MessageSquare size={20} aria-hidden="true" /></span><div><h3 id="current-followup-heading" className="section-title">New follow-up</h3><p>Record the conversation and plan your next contact.</p></div></div></div>
      <FollowupEditor key={latestId} clientId={client.id} currentDate={currentDate} />
    </section>}
  </section>;
}

function FollowupEditor({ clientId, currentDate }: { clientId: number; currentDate: string }) {
  const [status, setStatus] = useState('Pending');
  const [date, setDate] = useState(currentDate);
  const closing = !!closedLeadStatus(status);
  return <ActionForm action={addFollowup}>
    <input type="hidden" name="client_id" value={clientId} />
    <div className="form-grid">
      <div className="field"><label htmlFor="current-followup-date">Follow-up date *</label><input className="input" id="current-followup-date" type="date" name="followup_date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      <div className="field"><label htmlFor="current-followup-type">Contact type</label><select className="select" id="current-followup-type" name="type" defaultValue="Call">{followupTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
      <div className="field span2"><label htmlFor="current-followup-discussion">What did you discuss? *</label><textarea className="textarea" rows={4} id="current-followup-discussion" name="discussion" placeholder="Write the conversation details here…" required /></div>
      <div className="field span2"><label htmlFor="current-followup-result">Result / next action details <span className="muted">(optional)</span></label><input className="input" id="current-followup-result" name="result" placeholder="e.g. Send the revised offer before the next call" /></div>
      <div className="field"><label htmlFor="current-followup-status">Follow-up outcome</label><select className="select" id="current-followup-status" name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="Pending">Continue follow-up</option><option value="Closed Won">Deal won</option><option value="Closed Lost">Deal lost</option>
      </select></div>
      {!closing && <div className="field"><label htmlFor="current-followup-next">Next follow-up date *</label><input className="input" id="current-followup-next" type="date" name="next_followup_date" min={date} required /></div>}
    </div>
    {closing && <p className="small muted" role="status">This will close the lead and save your notes in the history.</p>}
    <div className="form-actions"><button className="btn btn-primary">Save Follow-up</button></div>
  </ActionForm>;
}
