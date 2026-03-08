const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');

    // Drop and recreate tables for clean schema
    await sql`DROP TABLE IF EXISTS cs_scan_history`;
    await sql`DROP TABLE IF EXISTS cs_cigars`;
    
    await sql`
      CREATE TABLE IF NOT EXISTS cs_cigars (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2),
        original_price DECIMAL(10,2),
        currency TEXT DEFAULT 'GBP',
        available BOOLEAN DEFAULT true,
        url TEXT,
        image_url TEXT,
        retailer TEXT,
        retailer_url TEXT,
        category TEXT,
        length_mm INTEGER,
        ring_gauge INTEGER,
        strength TEXT,
        country TEXT,
        format TEXT,
        source_id TEXT,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

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

    // Load datasets
    const smokeKingPath = path.join(__dirname, '..', 'smoke-king-cigars.json');
    const cgarsPath = path.join(__dirname, '..', 'cgars-cigars.json');

    let allCigars = [];

    // Smoke King data
    if (fs.existsSync(smokeKingPath)) {
      const skData = JSON.parse(fs.readFileSync(smokeKingPath, 'utf8'));
      console.log(`📦 Smoke King: ${skData.length} cigars`);
      allCigars.push(...skData.map(c => ({
        source_id: c.sourceId,
        name: c.name,
        brand: c.brand,
        description: c.description || '',
        price: c.price,
        original_price: null,
        currency: c.currency || 'GBP',
        available: c.available !== false,
        url: c.url,
        image_url: c.image || null,
        retailer: 'Smoke King',
        retailer_url: 'https://www.smoke-king.co.uk',
        category: null,
        length_mm: c.length_mm || null,
        ring_gauge: c.ring_gauge || null,
        strength: c.strength || null,
        format: extractFormat(c.name),
        scraped_at: c.scraped_at || new Date().toISOString()
      })));
    }

    // CGars data
    if (fs.existsSync(cgarsPath)) {
      const cgData = JSON.parse(fs.readFileSync(cgarsPath, 'utf8'));
      console.log(`📦 CGars: ${cgData.length} cigars`);
      allCigars.push(...cgData.map(c => ({
        source_id: c.sourceId,
        name: c.name,
        brand: c.brand,
        description: c.description || '',
        price: c.price,
        original_price: c.originalPrice || null,
        currency: c.currency || 'GBP',
        available: c.available !== false,
        url: c.url,
        image_url: c.image || null,
        retailer: 'C.Gars Ltd',
        retailer_url: 'https://www.cgarsltd.co.uk',
        category: c.category || null,
        length_mm: null,
        ring_gauge: null,
        strength: null,
        format: extractFormat(c.name),
        scraped_at: c.scraped_at || new Date().toISOString()
      })));
    }

    console.log(`📦 Total: ${allCigars.length} cigars to import`);

    // Insert in batches using parameterized queries
    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < allCigars.length; i += batchSize) {
      const batch = allCigars.slice(i, i + batchSize);

      for (const c of batch) {
        await sql`
          INSERT INTO cs_cigars (
            source_id, name, brand, description, price, original_price,
            currency, available, url, image_url, retailer, retailer_url,
            category, length_mm, ring_gauge, strength, format, scraped_at
          ) VALUES (
            ${c.source_id}, ${c.name}, ${c.brand}, ${c.description},
            ${c.price}, ${c.original_price}, ${c.currency}, ${c.available},
            ${c.url}, ${c.image_url}, ${c.retailer}, ${c.retailer_url},
            ${c.category}, ${c.length_mm}, ${c.ring_gauge}, ${c.strength},
            ${c.format}, ${new Date(c.scraped_at)}
          )
        `;
        imported++;
      }

      if ((i + batchSize) % 500 === 0 || i + batchSize >= allCigars.length) {
        console.log(`✅ Imported ${Math.min(i + batchSize, allCigars.length)} / ${allCigars.length}`);
      }
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_brand ON cs_cigars(brand)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_strength ON cs_cigars(strength)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_price ON cs_cigars(price)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_available ON cs_cigars(available)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_retailer ON cs_cigars(retailer)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_source_id ON cs_cigars(source_id)`;

    console.log(`\n🎉 Successfully imported ${imported} cigars!`);

    // Stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT brand) as brands,
        COUNT(DISTINCT retailer) as retailers,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM cs_cigars 
      WHERE available = true
    `;

    const retailerStats = await sql`
      SELECT retailer, COUNT(*) as count 
      FROM cs_cigars 
      GROUP BY retailer 
      ORDER BY count DESC
    `;

    console.log('\n📊 Database Stats:');
    console.log(`   Total cigars: ${stats[0].total}`);
    console.log(`   Unique brands: ${stats[0].brands}`);
    console.log(`   Retailers: ${stats[0].retailers}`);
    console.log(`   Price range: £${stats[0].min_price} - £${stats[0].max_price}`);
    console.log(`   Average price: £${Math.round(stats[0].avg_price * 100) / 100}`);
    console.log('\n🏪 By Retailer:');
    retailerStats.forEach(r => console.log(`   ${r.retailer}: ${r.count}`));

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

function extractFormat(name) {
  const formats = [
    'Double Corona', 'Petit Corona', 'Corona Extra', 'Corona Gorda', 'Grand Corona',
    'Corona', 'Robusto', 'Churchill', 'Torpedo', 'Toro', 'Petit', 'Gordo',
    'Lancero', 'Belicoso', 'Figurado', 'Perfecto', 'Panetela', 'Lonsdale',
    'Rothschild', 'Short Robusto', 'Petit Robusto', 'Half Corona', 'Nub',
    'Puritos', 'Cigarillo', 'Chicos', 'Mini', 'Club'
  ];
  
  for (const f of formats) {
    if (name.toLowerCase().includes(f.toLowerCase())) return f;
  }
  return null;
}

seedDatabase();
