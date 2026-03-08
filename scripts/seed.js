const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');

    // Ensure tables exist
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

    // Check if data already exists
    const existingCount = await sql`SELECT COUNT(*) as count FROM cs_cigars`;
    if (existingCount[0].count > 0) {
      console.log(`Database already contains ${existingCount[0].count} cigars. Skipping seed.`);
      return;
    }

    // Read and parse the JSON file
    const jsonPath = path.join(__dirname, '..', 'smoke-king-cigars.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const cigarsData = JSON.parse(rawData);

    console.log(`📦 Found ${cigarsData.length} cigars to import`);

    // Insert data in batches
    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < cigarsData.length; i += batchSize) {
      const batch = cigarsData.slice(i, i + batchSize);
      
      for (const cigar of batch) {
        // Extract format from name or description
        const formatKeywords = ['Corona', 'Robusto', 'Churchill', 'Torpedo', 'Toro', 'Petit', 'Double Corona', 'Gordo', 'Lancero'];
        let format = null;
        
        for (const keyword of formatKeywords) {
          if (cigar.name.includes(keyword) || (cigar.description && cigar.description.includes(keyword))) {
            format = keyword;
            break;
          }
        }

        await sql`
          INSERT INTO cs_cigars (
            name, brand, description, price, currency, available, 
            url, image_url, retailer, length_mm, ring_gauge, 
            strength, format, scraped_at
          ) VALUES (
            ${cigar.name},
            ${cigar.brand},
            ${cigar.description || ''},
            ${cigar.price},
            ${cigar.currency || 'GBP'},
            ${cigar.available !== false},
            ${cigar.url},
            ${cigar.image},
            ${cigar.retailer || 'Smoke King'},
            ${cigar.length_mm || null},
            ${cigar.ring_gauge || null},
            ${cigar.strength || null},
            ${format},
            ${new Date(cigar.scraped_at || Date.now())}
          )
        `;
        imported++;
      }

      console.log(`✅ Imported ${Math.min(i + batchSize, cigarsData.length)} / ${cigarsData.length} cigars`);
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_brand ON cs_cigars(brand)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_strength ON cs_cigars(strength)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_price ON cs_cigars(price)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cs_cigars_available ON cs_cigars(available)`;

    console.log(`🎉 Successfully imported ${imported} cigars!`);

    // Show some stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT brand) as brands,
        COUNT(DISTINCT strength) as strengths,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM cs_cigars 
      WHERE available = true
    `;

    console.log('📊 Database Stats:');
    console.log(`   Total cigars: ${stats[0].total}`);
    console.log(`   Unique brands: ${stats[0].brands}`);
    console.log(`   Price range: £${stats[0].min_price} - £${stats[0].max_price}`);
    console.log(`   Average price: £${Math.round(stats[0].avg_price * 100) / 100}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();