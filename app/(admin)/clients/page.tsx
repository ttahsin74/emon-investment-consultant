import db from '@/lib/db';
import { activeFollowupSql } from '@/lib/followups';
import Link from 'next/link';
import PageHead from '@/components/PageHead';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Search } from 'lucide-react';
import { money, statuses, sources, shortDate } from '@/lib/utils';

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; source?: string; page?: string; sort?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const status = sp.status || '';
  const source = sp.source || '';

  let sql = `
    SELECT c.*,
      (SELECT MIN(COALESCE(NULLIF(next_followup_date,''),followup_date))
       FROM followups f
       WHERE f.client_id = c.id
         AND ${activeFollowupSql}
         ) next_followup
    FROM clients c
    WHERE 1 = 1
  `;

  const args: any[] = [];

  if (q) {
    sql += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.company LIKE ? OR c.preferred_location LIKE ?)`;
    for (let i = 0; i < 5; i++) args.push(`%${q}%`);
  }

  if (status) {
    sql += ` AND c.status = ?`;
    args.push(status);
  }

  if (source) {
    sql += ` AND c.source = ?`;
    args.push(source);
  }

  const total = Number(((await db.prepare('SELECT COUNT(*) total FROM ('+sql+')').get(...args)) as {total:number}).total);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(sp.page) || 1)));
  const sort = sp.sort === 'name' ? 'name' : 'recent';
  sql += sort === 'name' ? ' ORDER BY c.name COLLATE NOCASE, c.id DESC' : ' ORDER BY c.id DESC';
  sql += ' LIMIT 20 OFFSET ?';
  const clients = (await db.prepare(sql).all(...args, (page-1)*20)) as any[];
  const pageUrl = (target:number) => '/clients?' + new URLSearchParams({q,status,source,sort,page:String(target)});

  return (
    <>
      <PageHead
        title="Client Pipeline"
        subtitle={`${total} lead${total === 1 ? '' : 's'} in the sales funnel.`}
        action={<Link className="btn btn-primary" href="/clients/new"><Plus size={16} /> Add Client</Link>}
      />

      <form className="filters">
        <div className="search" style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 11, top: 12, color: '#8b93a2' }} />
          <input className="input search-input" aria-label="Search clients" name="q" defaultValue={q} placeholder="Search name, phone, location, or company..." />
        </div>

        <select className="select" aria-label="Filter by stage" name="status" defaultValue={status} style={{ width: 200 }}>
          <option value="">All Stages</option>
          {statuses.map((x) => <option key={x}>{x}</option>)}
        </select>

        <select className="select" aria-label="Filter by source" name="source" defaultValue={source} style={{ width: 180 }}>
          <option value="">All Sources</option>
          {sources.map((x) => <option key={x}>{x}</option>)}
        </select>

        <select className="select" name="sort" aria-label="Sort clients" defaultValue={sort} style={{width:150}}><option value="recent">Newest first</option><option value="name">Name A-Z</option></select><button className="btn btn-primary">Apply filters</button>
        <Link className="btn" href="/clients">Reset</Link>
      </form>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Deal</th>
                <th>Location</th>
                <th>Source</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Next Follow-up</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="name">{c.name}</Link>
                    <div className="small muted">{c.company || 'No company'} · {c.phone}</div>
                  </td>

                  <td>
                    <div className="name">{c.deal_type || 'Buy'}</div>
                    <div className="small muted">{c.property_type || 'Property'}</div>
                  </td>

                  <td>{c.preferred_location || '—'}</td>
                  <td>{c.source || '—'}</td>
                  <td><StatusBadge value={c.status} /></td>
                  <td>{c.budget ? money(c.budget) : '—'}</td>
                  <td>{shortDate(c.next_followup)}</td>
                  <td>
                    <Link className="btn btn-sm" href={`/clients/${c.id}`}>Open</Link>
                  </td>
                </tr>
              ))}

              {!clients.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">No clients match your current filter.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination"><span className="small muted">{total ? (page-1)*20+1 : 0} - {Math.min(page*20,total)} of {total} clients</span><div className="rig">{page > 1 && <Link className="btn btn-sm" href={pageUrl(page-1)}>Previous</Link>}<span className="small">Page {page} of {pages}</span>{page < pages && <Link className="btn btn-sm" href={pageUrl(page+1)}>Next</Link>}</div></div>
      </section>
    </>
  );
}
