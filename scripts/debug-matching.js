const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const sql = neon(process.env.DATABASE_URL);

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/\s*-\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*cigar\s*$/i, '')
    .replace(/\s*\([^)]*\)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  // Get some products missing images with their CGars source_name
  const samples = await sql`
    SELECT p.id, p.name, p.brand, pr.source_name
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL AND pr.retailer = 'C.Gars Ltd'
    ORDER BY RANDOM()
    LIMIT 20
  `;

  console.log('=== DB product names (normalised) ===');
  for (const s of samples) {
    console.log(`  DB: "${s.name}" -> "${normalise(s.name)}"`);
    console.log(`  CGars source: "${s.source_name}" -> "${normalise(s.source_name)}"`);
    console.log();
  }

  // Example CGars category page names (from what we saw: "Bolivar Belicosos Finos Cigar - 1 Single")
  const cgarsExamples = [
    'Bolivar Belicosos Finos Cigar - 1 Single',
    'Cohiba Siglo II Cigar - 1 Single',
    'Montecristo No. 4 Cigar - 1 Single',
    'Partagas Serie D No. 4 Cigar - Box of 25',
    'Romeo y Julieta Churchills Cigar - 1 Single',
    'Davidoff Winston Churchill The Late Hour Churchill Cigar - Box of 20',
    'Chinchalero Novillo Fuerte Robusto Cigar - 1 Single',
  ];
  
  console.log('=== CGars category names (normalised) ===');
  for (const name of cgarsExamples) {
    console.log(`  "${name}" -> "${normalise(name)}"`);
  }
})();
