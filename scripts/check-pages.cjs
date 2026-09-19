// Read-only smoke check against an already running local development server.
const { loadEnvConfig } = require('@next/env');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const assert = require('node:assert/strict');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const token = createHash('sha256').update(`${process.env.ADMIN_EMAIL || 'admin@example.com'}:${process.env.ADMIN_PASSWORD || 'admin123'}:${process.env.AUTH_SECRET || 'dev-secret'}`).digest('hex');
const db = new DatabaseSync('data/crm.db', { readOnly: true });
const client = db.prepare('SELECT id FROM clients ORDER BY id LIMIT 1').get();
const followup = db.prepare('SELECT id,client_id FROM followups ORDER BY id LIMIT 1').get();
db.close();
const paths = ['/dashboard', '/followups', '/clients'];
if (client) paths.push(`/clients/${client.id}`, `/clients/${client.id}/edit`);
if (followup) paths.push(`/clients/${followup.client_id}/followups/${followup.id}/edit`);
(async () => {
  let failed = false;
  for (const path of paths) {
    try {
    const port = Number(process.argv[2] || 3000);
    const response = await fetch(`http://localhost:${port}${path}`, { headers: { Cookie: `cms_auth=${token}` }, signal: AbortSignal.timeout(45000) });
    const html = await response.text();
    const hasRenderError = /:E\{\\?"digest|Only plain objects|We could not load this page/.test(html);
    console.log(`${path}: HTTP ${response.status}, render error=${hasRenderError}`);
    assert.equal(new URL(response.url).pathname, path, 'Unexpected redirect');
    assert.equal(response.status, 200);
    assert.equal(hasRenderError, false, 'Page contains a server rendering error');
    } catch (error) { failed = true; console.error(`${path}: ${error.message}`); }
  }
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
