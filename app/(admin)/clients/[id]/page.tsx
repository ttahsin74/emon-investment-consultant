import { today } from '@/lib/utils';
import FollowupWorkspace from '@/components/FollowupWorkspace';
import ActionForm from '@/components/ActionForm';
import db from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHead from '@/components/PageHead';
import StatusBadge from '@/components/StatusBadge';
import { addSale, deleteClient, deleteSale } from '@/app/actions';
import { money, shortDate } from '@/lib/utils';
import { Pencil, Trash2, BadgeDollarSign } from 'lucide-react';

export default async function ClientDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = (await db.prepare('SELECT * FROM clients WHERE id=?').get(Number(id))) as any;
  if (!client) notFound();

  const followups = (await db.prepare('SELECT * FROM followups WHERE client_id=? ORDER BY followup_date DESC, id DESC').all(client.id)).map((row) => ({ ...row })) as any[];
  const sales = (await db.prepare('SELECT * FROM sales WHERE client_id=? ORDER BY id DESC').all(client.id)) as any[];
  const activities = (await db.prepare('SELECT * FROM activities WHERE client_id=? ORDER BY id DESC LIMIT 12').all(client.id)) as any[];
  const saleTotal = sales.reduce((total, sale) => total + Number(sale.final_amount || 0), 0);
  const paid = sales.reduce((total, sale) => total + Number(sale.paid_amount || 0), 0);
  const initial = client.name.split(' ').map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <PageHead title={client.name} subtitle={client.company || 'Client profile'} action={<div className="actions"><Link className="btn" href="/clients">Back to clients</Link><a className="btn btn-success" href={`tel:${client.phone}`}>Call client</a>{client.email && <a className="btn" href={`mailto:${client.email}`}>Email</a>}<Link className="btn" href={`/clients/${client.id}/edit`}><Pencil size={15} /> Edit</Link><ActionForm confirmMessage="Delete this record? This cannot be undone. Deleting a client also removes their follow-ups and sales." action={deleteClient.bind(null, client.id)}><button className="btn btn-danger"><Trash2 size={15} /> Delete</button></ActionForm></div>} />
      <section className="card">
        <div className="profile-hero"><div className="profile-main"><div className="avatar">{initial}</div><div><h2>{client.name}</h2><div className="muted small">{client.company || 'No company'} · {client.phone}</div><div style={{ marginTop: 8 }}><StatusBadge value={client.status} /></div></div></div><div className="small right"><div><b>{client.email || '—'}</b></div><div className="muted">{client.address || 'No address added'}</div></div></div>
        <div className="stats-inline"><div><span className="small muted">Total Sales</span><b>{money(saleTotal)}</b></div><div><span className="small muted">Paid</span><b>{money(paid)}</b></div><div><span className="small muted">Follow Ups</span><b>{followups.length}</b></div></div>
      </section>

      <div className="split" style={{ marginTop: 18 }}><section className="card card-pad"><h3 className="section-title">Client Information</h3><div className="form-grid" style={{ marginTop: 15 }}><div><div className="small muted">Profession</div><b>{client.profession || '—'}</b></div><div><div className="small muted">Source</div><b>{client.source}</b></div><div><div className="small muted">Interested Property</div><b>{client.interested_service || '—'}</b></div><div><div className="small muted">Budget</div><b>{money(client.budget)}</b></div><div><div className="small muted">Alternative Phone</div><b>{client.alt_phone || '—'}</b></div><div><div className="small muted">Preferred Location</div><b>{client.preferred_location || '—'}</b></div><div><div className="small muted">Deal type / Property</div><b>{client.deal_type} / {client.property_type || "Not specified"}</b></div><div><div className="small muted">Expected closing</div><b>{shortDate(client.closing_date)}</b></div><div className="span2"><div className="small muted">Current progress</div><div>{client.progress_note || "No progress note yet."}</div></div><div className="span2"><div className="small muted">Notes</div><div>{client.notes || '—'}</div></div></div></section><section className="card card-pad"><h3 className="section-title">Activity Timeline</h3><div className="timeline">{activities.map((activity) => <div className="timeline-item" key={activity.id}><div className="small muted">{shortDate(activity.created_at)}</div><div><b>{activity.type}</b><div className="small muted">{activity.description}</div></div></div>)}{!activities.length && <div className="empty">No activity yet.</div>}</div></section></div>

      <FollowupWorkspace client={{ ...client }} followups={followups} currentDate={today()} />
      <div style={{ marginTop: 18 }}>
        <section className="card"><div className="section-head"><h3 className="section-title">Sales</h3><BadgeDollarSign size={18} /></div><div className="card-pad"><ActionForm action={addSale}><input type="hidden" name="client_id" value={client.id} /><div className="form-grid"><div className="field"><label htmlFor="service">Service</label><input className="input" id="service" name="service" required /></div><div className="field"><label htmlFor="invoice_number">Invoice No.</label><input className="input" id="invoice_number" name="invoice_number" placeholder="INV-1002" /></div><div className="field"><label htmlFor="amount">Amount</label><input className="input" type="number" step="0.01" id="amount" name="amount" min="0" required /></div><div className="field"><label htmlFor="discount">Discount</label><input className="input" type="number" step="0.01" id="discount" name="discount" min="0" defaultValue="0" /></div><div className="field"><label htmlFor="paid_amount">Paid Amount</label><input className="input" type="number" step="0.01" id="paid_amount" name="paid_amount" min="0" defaultValue="0" /></div><div className="field"><label htmlFor="payment_method">Payment Method</label><select className="select" id="payment_method" name="payment_method"><option>Bank</option><option>Cash</option><option>Bkash</option><option>Nagad</option><option>Card</option><option>Other</option></select></div><div className="field span2"><label htmlFor="sale_date">Sale Date</label><input className="input" type="date" id="sale_date" name="sale_date" defaultValue={today()} required /></div></div><button className="btn btn-primary" style={{ marginTop: 12 }}>Add Sale</button></ActionForm></div>{sales.map((sale) => <div className="list-item" key={sale.id}><div><div className="name">{sale.service}</div><div className="small muted">{sale.invoice_number || 'No invoice'} · {shortDate(sale.sale_date)}</div><div className="small">{money(sale.final_amount)} · Paid {money(sale.paid_amount)}</div></div><div className="actions"><StatusBadge value={sale.payment_status} /><ActionForm confirmMessage="Delete this record? This cannot be undone. Deleting a client also removes their follow-ups and sales." action={deleteSale.bind(null, sale.id, client.id)}><button className="btn btn-sm btn-danger">Delete</button></ActionForm></div></div>)}{!sales.length && <div className="empty">No sales added.</div>}</section></div>
    </>
  );
}
