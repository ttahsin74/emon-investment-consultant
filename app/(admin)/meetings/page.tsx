import ActionForm from '@/components/ActionForm';
import PageHead from '@/components/PageHead';
import StatusBadge from '@/components/StatusBadge';
import db from '@/lib/db';
import { today, shortDate } from '@/lib/utils';
import { addMeeting, deleteMeeting, updateMeetingStatus } from '@/app/actions';

export default async function Meetings() {
  const clients = (await db.prepare('SELECT id,name,phone FROM clients ORDER BY name').all()) as any[];
  const rows = (await db.prepare(`SELECT m.*,c.name client_name FROM meetings m LEFT JOIN clients c ON c.id=m.client_id ORDER BY date(m.meeting_date) DESC, m.meeting_time DESC, m.id DESC`).all()) as any[];
  const upcoming = rows.filter((row) => row.status === 'Scheduled' && row.meeting_date >= today());
  const previous = rows.filter((row) => row.status !== 'Scheduled' || row.meeting_date < today());
  return <>
    <PageHead title="Meetings" subtitle="Schedule client meetings and keep a complete previous-meeting history." />
    <section className="card card-pad form-card"><h3 className="section-title">Add Meeting</h3><ActionForm action={addMeeting} style={{marginTop:16}}><div className="form-grid">
      <div className="field"><label>Client</label><select className="select" name="client_id"><option value="">General meeting</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></div>
      <div className="field"><label>Subject *</label><input className="input" name="subject" required /></div>
      <div className="field"><label>Date *</label><input className="input" name="meeting_date" type="date" defaultValue={today()} required /></div>
      <div className="field"><label>Time</label><input className="input" name="meeting_time" type="time" /></div>
      <div className="field"><label>Meeting Type</label><select className="select" name="meeting_type"><option>Client Meeting</option><option>Site Meeting</option><option>Online Meeting</option><option>Internal Meeting</option></select></div>
      <div className="field"><label>Location / Link</label><input className="input" name="location" /></div>
      <div className="field span2"><label>Notes</label><textarea className="textarea" name="notes" /></div>
    </div><div className="form-actions"><button className="btn btn-primary">Schedule Meeting</button></div></ActionForm></section>
    <section className="card" style={{marginTop:18}}><div className="section-head"><h3 className="section-title">Upcoming Meetings ({upcoming.length})</h3></div><MeetingTable rows={upcoming} /></section>
    <section className="card" style={{marginTop:18}}><div className="section-head"><h3 className="section-title">Previous Meetings ({previous.length})</h3></div><MeetingTable rows={previous} /></section>
  </>;
}

function MeetingTable({rows}:{rows:any[]}) {
  return <div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Client</th><th>Meeting</th><th>Location</th><th>Status</th><th>Result / Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>
    <td>{shortDate(row.meeting_date)}<div className="small muted">{row.meeting_time || 'No time'}</div></td><td>{row.client_name || 'General'}</td><td><b>{row.subject}</b><div className="small muted">{row.meeting_type}</div></td><td>{row.location || '—'}</td><td><StatusBadge value={row.status}/></td><td><ActionForm action={updateMeetingStatus.bind(null,row.id)}><div className="actions"><input className="input" style={{minWidth:150}} name="result" defaultValue={row.result || ''} placeholder="Meeting result"/><select className="select" style={{width:130}} name="status" defaultValue={row.status}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select><button className="btn btn-sm btn-success">Save</button></div></ActionForm><ActionForm confirmMessage="Delete this meeting?" action={deleteMeeting.bind(null,row.id)}><button className="btn btn-sm btn-danger" style={{marginTop:6}}>Delete</button></ActionForm></td>
  </tr>)}{!rows.length&&<tr><td colSpan={6}><div className="empty">No meetings found.</div></td></tr>}</tbody></table></div>;
}
