/**
 * Migration: Add tables for price refresh tracking
 * - cs_scrape_log: tracks each refresh run
 * - cs_price_changes: records price changes over time
 */
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('🔧 Running refresh schema migration...\n');

  // Scrape log - one row per retailer per refresh run
  await sql`
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
  console.log('✅ cs_scrape_log table created');

  await sql`CREATE INDEX IF NOT EXISTS idx_scrape_log_run ON cs_scrape_log(run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scrape_log_retailer ON cs_scrape_log(retailer)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scrape_log_started ON cs_scrape_log(started_at DESC)`;

  // Price changes - records every price change for history
  await sql`
    CREATE TABLE IF NOT EXISTS cs_price_changes (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES cs_products(id),
      retailer TEXT NOT NULL,
      old_price NUMERIC(10,2),
      new_price NUMERIC(10,2),
      change_type TEXT NOT NULL,
      changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  console.log('✅ cs_price_changes table created');

  await sql`CREATE INDEX IF NOT EXISTS idx_price_changes_product ON cs_price_changes(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_price_changes_date ON cs_price_changes(changed_at DESC)`;

  // Add last_verified column to cs_prices if not exists
  const cols = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'cs_prices' AND column_name = 'last_verified'
  `;
  if (cols.length === 0) {
    await sql`ALTER TABLE cs_prices ADD COLUMN last_verified TIMESTAMP WITH TIME ZONE`;
    console.log('✅ Added last_verified to cs_prices');
  } else {
    console.log('⏭️  last_verified already exists on cs_prices');
  }

  console.log('\n🎉 Migration complete!');
}

migrate().catch(e => { console.error('❌ Migration failed:', e); process.exit(1); });
