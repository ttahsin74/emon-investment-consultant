import ActionForm from "@/components/ActionForm";
import PageHead from "@/components/PageHead";
import StatusBadge from "@/components/StatusBadge";
import db from "@/lib/db";
import { shortDate } from "@/lib/utils";
import { addNotice, deleteNotice } from "@/app/actions";
export default async function Notices() {
  const rows = (await db
    .prepare("SELECT * FROM notices ORDER BY id DESC")
    .all()) as any[];
  return (
    <>
      <PageHead
        title="Office Notice"
        subtitle="Publish notices and keep the notice-board history."
      />
      <section className="card card-pad form-card">
        <h3 className="section-title">Publish Notice</h3>
        <ActionForm action={addNotice} style={{ marginTop: 16 }}>
          <div className="form-grid">
            <div className="field">
              <label>Title *</label>
              <input className="input" name="title" required />
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" name="status">
                <option>Published</option>
                <option>Draft</option>
              </select>
            </div>
            <div className="field span2">
              <label>Message *</label>
              <textarea className="textarea" name="body" required />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary">Publish Notice</button>
          </div>
        </ActionForm>
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        {rows.map((r) => (
          <div
            className="list-item"
            style={{ padding: "18px 20px" }}
            key={r.id}
          >
            <div>
              <div className="name">{r.title}</div>
              <div className="small muted">{shortDate(r.published_at)}</div>
              <p style={{ marginBottom: 0 }}>{r.body}</p>
            </div>
            <div className="actions">
              <StatusBadge value={r.status} />
              <ActionForm
                confirmMessage="Delete this notice?"
                action={deleteNotice.bind(null, r.id)}
              >
                <button className="btn btn-sm btn-danger">Delete</button>
              </ActionForm>
            </div>
          </div>
        ))}
        {!rows.length && <div className="empty">No notices yet.</div>}
      </section>
    </>
  );
}
