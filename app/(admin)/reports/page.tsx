import db from '@/lib/db';
import PageHead from '@/components/PageHead';
import { money } from '@/lib/utils';

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const from = sp.from || '';
  const to = sp.to || '';
  let where = '1=1';
  const args: string[] = [];
  if (from) { where += ' AND date(s.sale_date)>=date(?)'; args.push(from); }
  if (to) { where += ' AND date(s.sale_date)<=date(?)'; args.push(to); }

  const sales = (await db.prepare(`SELECT COUNT(*) transactions,COALESCE(SUM(s.final_amount),0) total,COALESCE(SUM(s.paid_amount),0) paid,COALESCE(AVG(s.final_amount),0) avg FROM sales s WHERE ${where}`).get(...args)) as any;
  const status = (await db.prepare('SELECT status,COUNT(*) count FROM clients GROUP BY status ORDER BY count DESC').all()) as any[];
  const source = (await db.prepare('SELECT source,COUNT(*) count FROM clients GROUP BY source ORDER BY count DESC').all()) as any[];
  const totalClients = ((await db.prepare('SELECT COUNT(*) c FROM clients').get()) as any).c || 0;
  const converted = ((await db.prepare("SELECT COUNT(*) c FROM clients WHERE status='Closed Won'").get()) as any).c || 0;
  const maxSource = Math.max(1, ...source.map((item) => Number(item.count)));
  const exportUrl = `/api/reports/export${from || to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ''}`;

  return (
    <>
      <PageHead title="Reports" subtitle="Filter sales by date and export your records. Client overview and lead sources show all-time data." action={<a className="btn btn-primary" href={exportUrl} download>Download Excel</a>} />
      <form className="filters"><input className="input" style={{ width: 180 }} type="date" aria-label="Sales from date" name="from" defaultValue={from} /><input className="input" style={{ width: 180 }} type="date" aria-label="Sales to date" name="to" defaultValue={to} /><button className="btn">Apply Date Range</button><a className="btn" href="/reports">Reset</a></form>
      <div className="kpis"><div className="card kpi"><div className="kpi-top"><span>Sales</span></div><div className="kpi-value">{money(sales.total)}</div></div><div className="card kpi"><div className="kpi-top"><span>Paid</span></div><div className="kpi-value">{money(sales.paid)}</div></div><div className="card kpi"><div className="kpi-top"><span>Due</span></div><div className="kpi-value">{money(Number(sales.total) - Number(sales.paid))}</div></div><div className="card kpi"><div className="kpi-top"><span>Average Sale</span></div><div className="kpi-value">{money(sales.avg)}</div></div></div>
      <div className="split" style={{ marginTop: 18 }}><section className="card card-pad"><h3 className="section-title">Client Overview</h3><div className="stats-inline" style={{ marginTop: 16 }}><div><span className="small muted">Total Clients</span><b>{totalClients}</b></div><div><span className="small muted">Closed Won</span><b>{converted}</b></div></div><h4 style={{ marginTop: 24 }}>Pipeline Stages</h4><div className="bar-list">{status.map((item) => <div className="bar-row" key={item.status}><div className="bar-label"><span>{item.status}</span><b>{item.count}</b></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, Number(item.count) / Math.max(1, totalClients) * 100)}%` }} /></div></div>)}</div></section><section className="card card-pad"><h3 className="section-title">Lead Sources</h3><div className="bar-list" style={{ marginTop: 18 }}>{source.map((item) => <div className="bar-row" key={item.source}><div className="bar-label"><span>{item.source || 'Unknown'}</span><b>{item.count}</b></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Number(item.count) / maxSource * 100}%` }} /></div></div>)}</div></section></div>
    </>
  );
}
