const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file::memory:' });
const schema = fs.readFileSync('lib/db-schema.ts', 'utf8').match(/`([\s\S]*?)`/)[1];
const moduleObject = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('lib/db.ts', 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
vm.runInNewContext(code, {
 module: moduleObject, exports: moduleObject.exports,
 process: { env: { TURSO_DATABASE_URL: 'file::memory:' } },
 require(name) {
  if(name === './db-schema') return { schema };
  if(name === '@libsql/client') return { createClient: () => client };
  return require(name);
 },
});
const db = moduleObject.exports.default;
(async () => {
 // Exercise an older database and concurrent initialization.
 await client.execute('CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL)');
 await Promise.all([moduleObject.exports.initializeDatabase(), moduleObject.exports.initializeDatabase()]);
 assert.ok((await client.execute('PRAGMA table_info(clients)')).rows.some(row => row.name === 'progress_note'));
 const result = await db.prepare('INSERT INTO clients (name,phone) VALUES (?,?)').run('Test', '01700000000');
 const id = Number(result.lastInsertRowid);
 assert.equal((await db.prepare('SELECT name FROM clients WHERE id=?').get(id)).name, 'Test');
 assert.equal(await db.prepare('SELECT * FROM clients WHERE id=-1').get(), undefined);
 await assert.rejects(db.transaction(async () => {
  await db.prepare('UPDATE clients SET name=? WHERE id=?').run('Rollback', id);
  throw new Error('rollback test');
 }), /rollback test/);
 assert.equal((await db.prepare('SELECT name FROM clients WHERE id=?').get(id)).name, 'Test');
 await db.transaction(async () => {
  await db.prepare('INSERT INTO followups (client_id,followup_date,discussion) VALUES (?,?,?)').run(id, '2026-09-19', 'Test');
  await db.prepare('UPDATE clients SET name=? WHERE id=?').run('Committed', id);
 });
 assert.equal((await db.prepare('SELECT name FROM clients WHERE id=?').get(id)).name, 'Committed');
 const row = (await db.prepare('SELECT * FROM clients').all())[0];
 assert.equal(Object.getPrototypeOf(row).constructor.name, 'Object');
 await assert.rejects(db.prepare('INSERT INTO followups (client_id,followup_date,discussion) VALUES (?,?,?)').run(-1, '2026-09-19', 'Invalid'));
 await db.prepare('DELETE FROM clients WHERE id=?').run(id);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM followups').get()).n, 0);
 console.log('libSQL migration, CRUD, transaction rollback/commit, plain rows and foreign keys passed.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => client.close());
