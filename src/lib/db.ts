import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = neon(process.env.DATABASE_URL);

let dbInitialized = false;

export async function ensureDb() {
  if (dbInitialized) return;

  try {
    // Create cs_cigars table
    await sql`
      CREATE TABLE IF NOT EXISTS cs_cigars (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2),
        currency TEXT DEFAULT 'GBP',
        available BOOLEAN DEFAULT true,
        url TEXT,
        image_url TEXT,
        retailer TEXT,
        length_mm INTEGER,
        ring_gauge INTEGER,
        strength TEXT,
        country TEXT,
        format TEXT,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create cs_scan_history table
    await sql`
      CREATE TABLE IF NOT EXISTS cs_scan_history (
        id SERIAL PRIMARY KEY,
        image_url TEXT,
        identified_name TEXT,
        identified_brand TEXT,
        confidence DECIMAL(3,2),
        matched_cigar_id INTEGER REFERENCES cs_cigars(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_brand ON cs_cigars(brand)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_strength ON cs_cigars(strength)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_price ON cs_cigars(price)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_available ON cs_cigars(available)`;

    dbInitialized = true;
    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating database tables:', error);
    throw error;
  }
}

export { sql };