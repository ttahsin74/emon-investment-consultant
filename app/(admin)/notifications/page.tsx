import ActionForm from '@/components/ActionForm';
import PageHead from '@/components/PageHead';
import db from '@/lib/db';
import { shortDate } from '@/lib/utils';
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions';
export default async function Notifications(){const rows=(await db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all()) as any[];return <><PageHead title="Notifications" subtitle="Updates from meetings, appointments, tasks, notices and leave workflows." action={<ActionForm action={markAllNotificationsRead}><button className="btn">Mark all read</button></ActionForm>}/><section className="card">{rows.map(r=><div className="list-item" style={{padding:'18px 20px'}} key={r.id}><div><div className="name">{r.title} {!r.is_read&&<span className="badge warn">New</span>}</div><div>{r.message}</div><div className="small muted">{shortDate(r.created_at)}</div></div>{!r.is_read&&<ActionForm action={markNotificationRead.bind(null,r.id)}><button className="btn btn-sm btn-success">Mark read</button></ActionForm>}</div>)}{!rows.length&&<div className="empty">No notifications.</div>}</section></>}
