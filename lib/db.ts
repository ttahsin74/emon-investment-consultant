import { createClient, type Client, type InValue, type Transaction, type Value } from '@libsql/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { schema } from './db-schema';

let client: Client | undefined;
let initialization: Promise<void> | undefined;
const context = new AsyncLocalStorage<Transaction>();

function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (process.env.VERCEL && (!url || url.startsWith('file:'))) {
      throw new Error('Set TURSO_DATABASE_URL to a remote database on Vercel.');
    }
    if (!url) mkdirSync('data', { recursive: true });
    client = createClient({
      url: url || 'file:data/crm.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: 'number',
    });
  }
  return client;
}

async function initialize() {
  const connection = getClient();
  const tx = await connection.transaction('write');
  try {
    await tx.batch(schema.split(';').map(s => s.trim()).filter(Boolean));
    const columns = new Set((await tx.execute('PRAGMA table_info(clients)')).rows.map(row => row.name));
    for (const [column, definition] of [
      ['profession', 'TEXT'], ['deal_type', "TEXT DEFAULT 'Buy'"],
      ['property_type', 'TEXT'], ['preferred_location', 'TEXT'],
      ['budget_range', 'TEXT'], ['closing_date', 'TEXT'], ['progress_note', 'TEXT'],
    ]) {
      if (!columns.has(column)) await tx.execute(`ALTER TABLE clients ADD COLUMN ${column} ${definition}`);
    }
    await tx.execute('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await tx.commit();
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

export function initializeDatabase() {
  if (!initialization) initialization = initialize().catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

async function execute(sql: string, args: InValue[]) {
  await initializeDatabase();
  return (context.getStore() || getClient()).execute({ sql, args });
}

// Keep the existing SQL call sites small while making all I/O explicitly async.
const db = {
  prepare(sql: string) {
    return {
      async all(...args: InValue[]): Promise<Record<string, Value>[]> {
        return (await execute(sql, args)).rows.map(row => ({ ...row }));
      },
      async get(...args: InValue[]): Promise<Record<string, Value> | undefined> {
        const row = (await execute(sql, args)).rows[0];
        return row ? { ...row } : undefined;
      },
      async run(...args: InValue[]) {
        const result = await execute(sql, args);
        return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
      },
    };
  },
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    await initializeDatabase();
    if (context.getStore()) return work();
    const tx = await getClient().transaction('write');
    try {
      const result = await context.run(tx, work);
      await tx.commit();
      return result;
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  },
};

export default db;
