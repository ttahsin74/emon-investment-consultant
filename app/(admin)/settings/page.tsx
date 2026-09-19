import ActionForm from '@/components/ActionForm';
import db from '@/lib/db';
import PageHead from '@/components/PageHead';
import { updateAdminLogin, updateAdminProfile } from '@/app/actions';
import { getAdminEmail } from '@/lib/auth';

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
	const sp = await searchParams;
	const profile = (await db.prepare('SELECT * FROM admin_profile WHERE id=1').get()) as any;
	const loginEmail = (await getAdminEmail());

	return <><PageHead title="Settings" subtitle="Manage the admin profile shown on your dashboard." />
		<section className="card card-pad form-card"><h3 className="section-title">Admin Profile</h3>
			{sp.saved && <div className="success" style={{ marginTop: 12 }}>Admin profile saved successfully.</div>}
			<ActionForm action={updateAdminProfile} encType="multipart/form-data" style={{ marginTop: 16 }}><div className="form-grid">
				<div className="field"><label htmlFor="name">Admin Name *</label><input className="input" id="name" name="name" defaultValue={profile?.name || ''} placeholder="e.g. Emon Ahmed" required /></div>
				<div className="field"><label htmlFor="designation">Designation</label><input className="input" id="designation" name="designation" defaultValue={profile?.designation || ''} placeholder="e.g. Managing Director" /></div>
				<div className="field"><label htmlFor="phone">Phone</label><input className="input" id="phone" name="phone" defaultValue={profile?.phone || ''} placeholder="01XXXXXXXXX" /></div>
				<div className="field"><label htmlFor="email">Email</label><input className="input" type="email" id="email" name="email" defaultValue={profile?.email || ''} placeholder="admin@example.com" /></div>
				<div className="field span2"><label htmlFor="image">Profile Image</label><input className="input" type="file" id="image" name="image" accept="image/png,image/jpeg,image/webp,image/gif" /><div className="small muted" style={{ marginTop: 6 }}>PNG, JPG, WEBP or GIF. Maximum 5MB.</div></div>
			</div><div className="form-actions"><button className="btn btn-primary">Save Admin Profile</button></div></ActionForm>
		</section>
		<section className="card card-pad" style={{ marginTop: 18 }}><h3 className="section-title">Admin Login</h3><p className="muted small">Change the email and password used to sign in to this dashboard.</p>
			<ActionForm action={updateAdminLogin} style={{ marginTop: 16 }}><div className="form-grid">
				<div className="field span2"><label htmlFor="login_email">Login Email *</label><input className="input" type="email" id="login_email" name="login_email" defaultValue={loginEmail} autoComplete="username" required /></div>
				<div className="field"><label htmlFor="current_password">Current Password *</label><input className="input" type="password" id="current_password" name="current_password" autoComplete="current-password" required /></div>
				<div className="field"><label htmlFor="new_password">New Password *</label><input className="input" type="password" id="new_password" name="new_password" minLength={6} autoComplete="new-password" required /></div>
			</div><div className="form-actions"><button className="btn btn-primary">Update Login Credentials</button></div></ActionForm>
		</section>
		<section className="card card-pad" style={{ marginTop: 18 }}><h3 className="section-title">Database</h3><p className="muted small">SQLite database file is automatically created at <b>data/crm.db</b>. Keep a backup of this file to back up the CRM.</p></section>
	</>;
}
