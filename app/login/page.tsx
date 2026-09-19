import ActionForm from '@/components/ActionForm';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { loginAction } from '@/app/actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect('/dashboard');

  const sp = await searchParams;

  return (
    <main className="login-page">
      <section className="card login-card">
        <div className="login-brand">
          <div className="brandmark">EMC</div>
          <h2>Emon Investment Consultant</h2>
          <p className="muted small">Sign in to manage leads, follow-ups, sales, and client work in one place.</p>
        </div>

        {sp.error && <div className="error">Invalid email or password.</div>}

        <ActionForm action={loginAction}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" type="email" id="email" name="email" autoComplete="username" placeholder="admin@example.com" required />
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="password">Password</label>
            <input className="input" type="password" id="password" name="password" autoComplete="current-password" placeholder="••••••••" required />
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }}>
            Sign in
          </button>
        </ActionForm>

       
      </section>
    </main>
  );
}
