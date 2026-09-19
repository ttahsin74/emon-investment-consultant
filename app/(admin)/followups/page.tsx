import db from '@/lib/db';
import Link from 'next/link';
import PageHead from '@/components/PageHead';
import { activeFollowupSql, closedLeadStatus, closedStatusesSql } from '@/lib/followups';
import { shortDate } from '@/lib/utils';

export default async function Followups({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view = ['today', 'overdue', 'closed'].includes(sp.view || '') ? sp.view! : 'all';
  let condition = '1=1';
  if (view === 'today') condition = `${activeFollowupSql} AND date(COALESCE(NULLIF(f.next_followup_date,''),f.followup_date))=date('now','+6 hours')`;
  if (view === 'overdue') condition = `${activeFollowupSql} AND date(COALESCE(NULLIF(f.next_followup_date,''),f.followup_date))<date('now','+6 hours')`;
  if (view === 'closed') condition = `lower(trim(c.status)) IN ${closedStatusesSql}`;

  const rows = (await db.prepare(`SELECT f.*,c.name client_name,c.phone,c.status client_status
    FROM followups f JOIN clients c ON c.id=f.client_id
    WHERE f.id=(SELECT MAX(latest.id) FROM followups latest WHERE latest.client_id=c.id) AND ${condition}
    ORDER BY CASE WHEN ${activeFollowupSql} THEN 0 ELSE 1 END,
      date(COALESCE(NULLIF(f.next_followup_date,''),f.followup_date)) ASC`).all()) as any[];

  return <>
    <PageHead title="Follow Ups" subtitle="Open a client to read the history and add your next follow-up." />
    <div className="filters">{['all', 'today', 'overdue', 'closed'].map((item) => <Link key={item} className={view === item ? 'btn btn-primary' : 'btn'} aria-current={view === item ? 'page' : undefined} href={`/followups?view=${item}`}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</div>
    <section className="card"><div className="table-wrap"><table className="table">
      <thead><tr><th>Client</th><th>Latest follow-up</th><th>Next date</th><th>Result</th><th></th></tr></thead>
      <tbody>{rows.map((entry) => {
        const closed = closedLeadStatus(entry.client_status);
        return <tr key={entry.client_id}>
          <td><Link className="name" href={`/clients/${entry.client_id}#followup-workspace`}>{entry.client_name}</Link><div className="small muted">{entry.phone}</div></td>
          <td style={{ maxWidth: 360 }}><div className="small muted">{shortDate(entry.followup_date)}</div><div className="followup-summary">{entry.discussion}</div></td>
          <td>{!closed && entry.status === 'Pending' ? shortDate(entry.next_followup_date || entry.followup_date) : '—'}</td>
          <td><span className={`badge ${closed === 'Closed Won' ? 'success' : closed === 'Closed Lost' ? 'danger' : 'gray'}`}>{closed === 'Closed Won' ? 'Deal won' : closed === 'Closed Lost' ? 'Deal lost' : 'Continue follow-up'}</span></td>
          <td><Link className="btn btn-sm" href={`/clients/${entry.client_id}#followup-workspace`}>{closed ? 'View history' : 'Follow up'}</Link></td>
        </tr>;
      })}</tbody>
    </table>{!rows.length && <div className="empty">No follow-ups found.</div>}</div></section>
  </>;
}
