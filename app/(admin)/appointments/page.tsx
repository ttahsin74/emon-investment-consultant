import ActionForm from '@/components/ActionForm';
import PageHead from '@/components/PageHead';
import StatusBadge from '@/components/StatusBadge';
import db from '@/lib/db';
import { today, shortDate } from '@/lib/utils';
import { addAppointment, deleteAppointment, updateAppointmentStatus } from '@/app/actions';

export default async function Appointments() {
  const clients = (await db.prepare('SELECT id,name,phone FROM clients ORDER BY name').all()) as any[];
  const rows = (await db.prepare(`SELECT a.*,c.name client_name FROM appointments a LEFT JOIN clients c ON c.id=a.client_id ORDER BY date(a.appointment_date) DESC,a.appointment_time DESC,a.id DESC`).all()) as any[];
  return <><PageHead title="Appointments" subtitle="Manage upcoming client appointments and their status." />
    <section className="card card-pad form-card"><h3 className="section-title">Add Appointment</h3><ActionForm action={addAppointment} style={{marginTop:16}}><div className="form-grid">
      <div className="field"><label>Client</label><select className="select" name="client_id"><option value="">General appointment</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></div>
      <div className="field"><label>Title *</label><input className="input" name="title" required /></div><div className="field"><label>Date *</label><input className="input" type="date" name="appointment_date" defaultValue={today()} required /></div><div className="field"><label>Time</label><input className="input" type="time" name="appointment_time" /></div><div className="field"><label>Location</label><input className="input" name="location" /></div><div className="field span2"><label>Notes</label><textarea className="textarea" name="notes" /></div>
    </div><div className="form-actions"><button className="btn btn-primary">Add Appointment</button></div></ActionForm></section>
    <section className="card" style={{marginTop:18}}><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Client</th><th>Appointment</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{shortDate(row.appointment_date)}<div className="small muted">{row.appointment_time||'No time'}</div></td><td>{row.client_name||'General'}</td><td><b>{row.title}</b><div className="small muted">{row.notes||''}</div></td><td>{row.location||'—'}</td><td><StatusBadge value={row.status}/></td><td><ActionForm action={updateAppointmentStatus.bind(null,row.id)}><div className="actions"><select className="select" name="status" defaultValue={row.status}><option>Scheduled</option><option>Completed</option><option>Cancelled</option><option>No Show</option></select><button className="btn btn-sm btn-success">Save</button></div></ActionForm><ActionForm confirmMessage="Delete this appointment?" action={deleteAppointment.bind(null,row.id)}><button className="btn btn-sm btn-danger" style={{marginTop:6}}>Delete</button></ActionForm></td></tr>)}{!rows.length&&<tr><td colSpan={6}><div className="empty">No appointments found.</div></td></tr>}</tbody></table></div></section>
  </>;
}
