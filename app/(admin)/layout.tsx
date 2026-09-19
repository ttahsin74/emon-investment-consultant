import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import db from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({children}:{children:React.ReactNode}){if(!(await isAuthenticated()))redirect('/login');const profile=(await db.prepare('SELECT name FROM admin_profile WHERE id=1').get()) as {name:string}|undefined;const unread=Number(((await db.prepare('SELECT COUNT(*) total FROM notifications WHERE is_read=0').get()) as {total:number}).total);return <div className="shell"><a className="skip-link" href="#main-content">Skip to content</a><Sidebar/><main className="main"><WorkspaceHeader name={profile?.name||'Admin'} unread={unread}/><div id="main-content" className="content">{children}</div></main></div>}
