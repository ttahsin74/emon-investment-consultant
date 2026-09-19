import ActionForm from "@/components/ActionForm";
import db from "@/lib/db";
import { activeFollowupSql } from "@/lib/followups";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import StatusBadge from "@/components/StatusBadge";
import {
  Users,
  UserCheck,
  PhoneCall,
  BadgeDollarSign,
  Plus,
  MapPinned,
  CalendarDays,
  CalendarCheck2,
  ListTodo,
  Banknote,
  Mail,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { money, shortDate, today } from "@/lib/utils";
import { saveDailyCollection } from "@/app/actions";

export default async function Dashboard() {
  const admin = (await db
    .prepare("SELECT * FROM admin_profile WHERE id=1")
    .get()) as any;
  const totals = (await db
    .prepare(
      `SELECT COUNT(*) total,SUM(CASE WHEN status='Closed Won' THEN 1 ELSE 0 END) converted,SUM(CASE WHEN status NOT IN ('Closed Won','Closed Lost') THEN 1 ELSE 0 END) active FROM clients`,
    )
    .get()) as any;
  const sales = (await db
    .prepare(
      `SELECT COALESCE(SUM(final_amount),0) total,COALESCE(SUM(paid_amount),0) paid FROM sales`,
    )
    .get()) as any;
  const followups = (await db
    .prepare(
      `SELECT f.*,c.name client_name,c.phone,c.preferred_location FROM followups f JOIN clients c ON c.id=f.client_id WHERE ${activeFollowupSql} ORDER BY date(COALESCE(NULLIF(f.next_followup_date,''),f.followup_date)) ASC LIMIT 6`,
    )
    .all()) as any[];
  const previousFollowups = (await db
    .prepare(
      `SELECT f.*,c.name client_name FROM followups f JOIN clients c ON c.id=f.client_id WHERE f.status!='Pending' ORDER BY f.id DESC LIMIT 6`,
    )
    .all()) as any[];
  const recent = (await db
    .prepare(`SELECT * FROM clients ORDER BY id DESC LIMIT 6`)
    .all()) as any[];
  const monthly = (await db
    .prepare(
      `SELECT strftime('%m',sale_date) m,SUM(final_amount) total FROM sales WHERE sale_date>=date('now','-5 months','start of month') GROUP BY strftime('%Y-%m',sale_date) ORDER BY sale_date ASC`,
    )
    .all()) as any[];
  const attention = (await db
    .prepare(
      `SELECT COUNT(*) total FROM followups f JOIN clients c ON c.id=f.client_id WHERE ${activeFollowupSql} AND date(COALESCE(NULLIF(f.next_followup_date,''),f.followup_date))<=date('now','+6 hours')`,
    )
    .get()) as { total: number };
  const meetings = (await db
    .prepare(
      "SELECT COUNT(*) total FROM meetings WHERE status='Scheduled' AND date(meeting_date)>=date('now','+6 hours')",
    )
    .get()) as { total: number };
  const appointments = (await db
    .prepare(
      "SELECT COUNT(*) total FROM appointments WHERE status='Scheduled' AND date(appointment_date)>=date('now','+6 hours')",
    )
    .get()) as { total: number };
  const taskCount = (await db
    .prepare(
      "SELECT COUNT(*) total FROM tasks WHERE status!='Completed' AND date(task_date)<=date('now','+6 hours')",
    )
    .get()) as { total: number };
  const collection = (await db
    .prepare("SELECT * FROM daily_collection WHERE collection_date=?")
    .get(today())) as any;
  const notices = (await db
    .prepare(
      "SELECT * FROM notices WHERE status='Published' ORDER BY id DESC LIMIT 3",
    )
    .all()) as any[];
  const nextMeetings = (await db
    .prepare(
      `SELECT m.*,c.name client_name FROM meetings m LEFT JOIN clients c ON c.id=m.client_id WHERE m.status='Scheduled' AND date(m.meeting_date)>=date('now','+6 hours') ORDER BY date(m.meeting_date),m.meeting_time LIMIT 5`,
    )
    .all()) as any[];
  const max = Math.max(1, ...monthly.map((x) => Number(x.total)));

  return (
    <>
      <PageHead
        title={`Welcome back, ${admin?.name?.split(" ")[0] || "Admin"}`}
        subtitle="Here is what is happening with your clients and daily work today."
        action={
          <Link className="btn btn-primary" href="/clients/new">
            <Plus size={16} /> Add Client
          </Link>
        }
      />
      <section className="dashboard-profile" aria-labelledby="admin-profile-name">
        <div className="dashboard-profile-portrait">
          <div className="dashboard-profile-photo">
            {admin?.image_url ? (
              <img
                src={admin.image_url}
                alt={`${admin?.name || "Admin"} profile photo`}
                width={208}
                height={208}
                fetchPriority="high"
              />
            ) : (
              <span aria-label="Admin initials">
                {(admin?.name || "Admin").trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase()}
              </span>
            )}
          </div>
          <span className="dashboard-profile-badge"><ShieldCheck size={14} aria-hidden="true" /> Administrator</span>
        </div>
        <div className="dashboard-profile-info">
          <span className="eyebrow">EMON INVESTMENT CONSULTANT</span>
          <h2 id="admin-profile-name">{admin?.name || "Admin"}</h2>
          <p className="dashboard-profile-designation">{admin?.designation || "Add your designation in Settings"}</p>
          <dl className="dashboard-profile-contacts">
            <div>
              <span className="dashboard-profile-contact-icon"><PhoneCall size={19} aria-hidden="true" /></span>
              <div>
                <dt>Phone number</dt>
                <dd>{admin?.phone ? <a href={`tel:${admin.phone.replace(/[^+\d]/g, "")}`}>{admin.phone}</a> : "Not added yet"}</dd>
              </div>
            </div>
            <div>
              <span className="dashboard-profile-contact-icon"><Mail size={19} aria-hidden="true" /></span>
              <div>
                <dt>Email address</dt>
                <dd>{admin?.email ? <a href={`mailto:${admin.email}`}>{admin.email}</a> : "Not added yet"}</dd>
              </div>
            </div>
          </dl>
        </div>
        <Link href="/settings" className="btn dashboard-profile-edit">
          <Pencil size={14} aria-hidden="true" /> Edit profile
        </Link>
      </section>
      <div className="kpis">
        <Link href="/clients" className="card kpi">
          <div className="kpi-top">
            <span>Clients</span>
            <div className="iconbox">
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-value">{totals.total || 0}</div>
          <div className="small muted">Active {totals.active || 0}</div>
        </Link>
        <Link href="/meetings" className="card kpi">
          <div className="kpi-top">
            <span>Meetings</span>
            <div className="iconbox">
              <CalendarDays size={18} />
            </div>
          </div>
          <div className="kpi-value">{meetings.total}</div>
          <div className="small muted">Upcoming</div>
        </Link>
        <Link href="/appointments" className="card kpi">
          <div className="kpi-top">
            <span>Appointments</span>
            <div className="iconbox">
              <CalendarCheck2 size={18} />
            </div>
          </div>
          <div className="kpi-value">{appointments.total}</div>
          <div className="small muted">Upcoming</div>
        </Link>
        <Link href="/tasks" className="card kpi">
          <div className="kpi-top">
            <span>Tasks</span>
            <div className="iconbox">
              <ListTodo size={18} />
            </div>
          </div>
          <div className="kpi-value">{taskCount.total}</div>
          <div className="small muted">Due / open</div>
        </Link>
        <Link href="/followups?view=today" className="card kpi">
          <div className="kpi-top">
            <span>Follow Ups</span>
            <div className="iconbox">
              <PhoneCall size={18} />
            </div>
          </div>
          <div className="kpi-value">{attention.total}</div>
          <div className="small muted">Need attention</div>
        </Link>
        <div className="card kpi">
          <div className="kpi-top">
            <span>Closed Deals</span>
            <div className="iconbox">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="kpi-value">{totals.converted || 0}</div>
        </div>
        <Link href="/sales" className="card kpi">
          <div className="kpi-top">
            <span>Total Sales</span>
            <div className="iconbox">
              <BadgeDollarSign size={18} />
            </div>
          </div>
          <div className="kpi-value">{money(sales.total)}</div>
          <div className="small muted">Paid {money(sales.paid)}</div>
        </Link>
        <div className="card kpi">
          <div className="kpi-top">
            <span>Today Collection</span>
            <div className="iconbox">
              <Banknote size={18} />
            </div>
          </div>
          <div className="kpi-value">
            {money(collection?.collected_amount || 0)}
          </div>
          <div className="small muted">
            Target {money(collection?.probable_amount || 0)}
          </div>
        </div>
      </div>
      <section className="card card-pad form-card" style={{ marginBottom: 18 }}>
        <div className="section-head" style={{ padding: 0, marginBottom: 12 }}>
          <h3 className="section-title">Today&apos;s Probable Collection</h3>
        </div>
        <ActionForm action={saveDailyCollection}>
          <div className="form-grid">
            <input type="hidden" name="collection_date" value={today()} />
            <div className="field">
              <label>Probable Collection Amount</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                name="probable_amount"
                defaultValue={collection?.probable_amount || 0}
              />
            </div>
            <div className="field">
              <label>Collected Amount</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                name="collected_amount"
                defaultValue={collection?.collected_amount || 0}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary">Save Collection</button>
          </div>
        </ActionForm>
      </section>
      <div className="attention-strip">
        <div>
          <b>{attention.total} follow-ups need attention</b>
          <span className="muted">
            {" "}
            Due today or overdue / Outstanding payments:{" "}
            {money(sales.total - sales.paid)}
          </span>
        </div>
        <Link href="/followups?view=overdue" className="btn btn-sm">
          Review follow-ups
        </Link>
      </div>
      <div className="grid2">
        <section className="card">
          <div className="section-head">
            <h3 className="section-title">Monthly Deal Value</h3>
            <Link className="small muted" href="/reports">
              View report →
            </Link>
          </div>
          {monthly.length ? (
            <div className="chart-bars">
              {monthly.map((x, i) => (
                <div className="bar-wrap" key={i}>
                  <div
                    title={money(x.total)}
                    className="bar"
                    style={{
                      height: `${Math.max(8, (Number(x.total) / max) * 170)}px`,
                    }}
                  ></div>
                  <span>
                    {new Date(2026, Number(x.m) - 1, 1).toLocaleDateString(
                      "en-GB",
                      { month: "short" },
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              Add property deals to see sales performance.
            </div>
          )}
        </section>
        <section className="card">
          <div className="section-head">
            <h3 className="section-title">Upcoming Follow-ups</h3>
            <Link className="small muted" href="/followups">
              View all →
            </Link>
          </div>
          <div className="list-stack">
            {followups.map((f) => (
              <Link
                href={`/clients/${f.client_id}`}
                className="list-item"
                key={f.id}
              >
                <div>
                  <div className="name">{f.client_name}</div>
                  <div className="small muted">
                    {f.type} · {f.phone}
                  </div>
                  {f.preferred_location && (
                    <div className="small muted">
                      <MapPinned
                        size={12}
                        style={{ verticalAlign: "middle", marginRight: 4 }}
                      />
                      {f.preferred_location}
                    </div>
                  )}
                </div>
                <div className="rig">
                  <div className="small muted">
                    {shortDate(f.next_followup_date || f.followup_date)}
                  </div>
                  <StatusBadge value={f.status} />
                </div>
              </Link>
            ))}
            {!followups.length && (
              <div className="empty">No follow-ups scheduled.</div>
            )}
          </div>
        </section>
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        <section className="card">
          <div className="section-head">
            <h3 className="section-title">
              Previous Followups ({previousFollowups.length})
            </h3>
            <Link className="small muted" href="/followups?view=all">
              View all →
            </Link>
          </div>
          <div className="list-stack">
            {previousFollowups.map((f) => (
              <Link
                href={`/clients/${f.client_id}`}
                className="list-item"
                key={f.id}
              >
                <div>
                  <div className="name">{f.client_name}</div>
                  <div className="small muted">
                    {f.type} · {f.result || "Completed"}
                  </div>
                </div>
                <StatusBadge value={f.status} />
              </Link>
            ))}
            {!previousFollowups.length && (
              <div className="empty">No previous follow-ups.</div>
            )}
          </div>
        </section>
        <section className="card">
          <div className="section-head">
            <h3 className="section-title">
              Upcoming Meetings ({nextMeetings.length})
            </h3>
            <Link className="small muted" href="/meetings">
              View all →
            </Link>
          </div>
          <div className="list-stack">
            {nextMeetings.map((m) => (
              <div className="list-item" key={m.id}>
                <div>
                  <div className="name">{m.subject}</div>
                  <div className="small muted">
                    {m.client_name || "General"} · {shortDate(m.meeting_date)}{" "}
                    {m.meeting_time || ""}
                  </div>
                </div>
                <StatusBadge value={m.status} />
              </div>
            ))}
            {!nextMeetings.length && (
              <div className="empty">No upcoming meetings.</div>
            )}
          </div>
        </section>
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        <section className="card">
          <div className="section-head">
            <h3 className="section-title">Office Notice</h3>
            <Link className="small muted" href="/notices">
              View notice board →
            </Link>
          </div>
          <div className="list-stack">
            {notices.map((n) => (
              <div className="list-item" key={n.id}>
                <div>
                  <div className="name">{n.title}</div>
                  <div className="small muted">{n.body}</div>
                </div>
              </div>
            ))}
            {!notices.length && (
              <div className="empty">No published notice.</div>
            )}
          </div>
        </section>
        <section className="card">
          <div className="section-head">
            <h3 className="section-title">Recent Client Leads</h3>
            <Link className="small muted" href="/clients">
              Customer information →
            </Link>
          </div>
          <div className="list-stack">
            {recent.map((c) => (
              <Link href={`/clients/${c.id}`} className="list-item" key={c.id}>
                <div>
                  <div className="name">{c.name}</div>
                  <div className="small muted">
                    {c.company || "No company"} · {c.phone}
                  </div>
                </div>
                <StatusBadge value={c.status} />
              </Link>
            ))}
            {!recent.length && <div className="empty">No recent leads.</div>}
          </div>
        </section>
      </div>
    </>
  );
}
