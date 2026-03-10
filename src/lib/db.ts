import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

let initialized = false;

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export const sql = getDb();

export async function ensureDb() {
  if (initialized) return;
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS cs_scans (
      id TEXT PRIMARY KEY,
      identification JSONB NOT NULL,
      matches JSONB DEFAULT '[]',
      similar JSONB DEFAULT '[]',
      thumbnail TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  initialized = true;
}
