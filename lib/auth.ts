import { cookies } from 'next/headers';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import db from './db';

type AdminCredentials = { email: string; password_hash: string; password_salt: string };

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

async function credentials(): Promise<AdminCredentials> {
  let record = (await db.prepare('SELECT email, password_hash, password_salt FROM admin_credentials WHERE id=1').get()) as AdminCredentials | undefined;
  if (!record) {
    const salt = randomBytes(16).toString('hex');
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = hashPassword(password, salt);
    await db.prepare('INSERT OR IGNORE INTO admin_credentials (id,email,password_hash,password_salt) VALUES (1,?,?,?)').run(email, passwordHash, salt);
    record = (await db.prepare('SELECT email, password_hash, password_salt FROM admin_credentials WHERE id=1').get()) as AdminCredentials;
  }
  return record;
}

function tokenFor(email: string, passwordHash: string) {
  return createHash('sha256').update(`${email}:${passwordHash}:${process.env.AUTH_SECRET || 'dev-secret'}`).digest('hex');
}

export async function getAdminEmail() {
  return (await credentials()).email;
}

export async function verifyAdminCredentials(email: string, password: string) {
  const record = (await credentials());
  const suppliedHash = hashPassword(password, record.password_salt);
  const matches = timingSafeEqual(Buffer.from(suppliedHash, 'hex'), Buffer.from(record.password_hash, 'hex'));
  return email === record.email && matches;
}

export async function updateAdminCredentials(email: string, password: string) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  (await db.prepare('INSERT INTO admin_credentials (id,email,password_hash,password_salt,updated_at) VALUES (1,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,password_salt=excluded.password_salt,updated_at=CURRENT_TIMESTAMP').run(email, passwordHash, salt));
}

export async function expectedAuthToken() {
  const record = (await credentials());
  return tokenFor(record.email, record.password_hash);
}

export async function isAuthenticated() {
  const store = await cookies();
  return store.get('cms_auth')?.value === (await expectedAuthToken());
}
