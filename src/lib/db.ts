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
      "similar" JSONB DEFAULT '[]',
      thumbnail TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS cs_alerts (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      target_price DECIMAL(10,2) NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      triggered_at TIMESTAMP WITH TIME ZONE
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_cs_alerts_email ON cs_alerts(email)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_cs_alerts_active ON cs_alerts(active) WHERE active = true
  `;
  await db`
    CREATE TABLE IF NOT EXISTS cs_scrape_log (
      id SERIAL PRIMARY KEY,
      run_id TEXT NOT NULL,
      retailer TEXT NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      status TEXT DEFAULT 'running',
      products_scraped INTEGER DEFAULT 0,
      prices_updated INTEGER DEFAULT 0,
      prices_added INTEGER DEFAULT 0,
      prices_removed INTEGER DEFAULT 0,
      new_products INTEGER DEFAULT 0,
      errors TEXT[],
      duration_ms INTEGER
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS cs_price_changes (
      id SERIAL PRIMARY KEY,
      product_id INTEGER,
      retailer TEXT NOT NULL,
      old_price NUMERIC(10,2),
      new_price NUMERIC(10,2),
      change_type TEXT NOT NULL,
      changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS cs_clicks (
      id SERIAL PRIMARY KEY,
      product_id INTEGER,
      retailer TEXT NOT NULL,
      url TEXT NOT NULL,
      clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      user_agent TEXT,
      referer TEXT
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_cs_clicks_retailer ON cs_clicks(retailer)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_cs_clicks_product ON cs_clicks(product_id)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_cs_clicks_date ON cs_clicks(clicked_at)
  `;
  initialized = true;
}
