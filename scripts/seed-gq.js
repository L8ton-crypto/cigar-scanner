const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function seedGQ() {
  const gqData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'gq-tobaccos-cigars.json'), 'utf8'));
  console.log(`📦 GQ Tobaccos: ${gqData.length} products to import\n`);

  // Check existing GQ count
  const existing = await sql`SELECT COUNT(*) as c FROM cs_cigars WHERE retailer = 'GQ Tobaccos'`;
  if (parseInt(existing[0].c) > 0) {
    console.log(`Clearing ${existing[0].c} existing GQ entries...`);
    await sql`DELETE FROM cs_cigars WHERE retailer = 'GQ Tobaccos'`;
  }

  // Extract brand from GQ name format: "Brand - Product - Vitola - Quantity"
  function extractBrand(name, slug) {
    // GQ format is usually "Brand - Product Line - Size - Quantity"
    const brandMap = {
      'cohiba': 'Cohiba', 'cuaba': 'Cuaba', 'el-rey-del-mundo': 'El Rey del Mundo',
      'fonseca': 'Fonseca', 'hoyo-de-monterrey': 'Hoyo de Monterrey',
      'jose-l-piedra': 'Jose L Piedra', 'juan-lopez': 'Juan Lopez',
      'montecristo': 'Montecristo', 'partagas': 'Partagas',
      'por-larranaga': 'Por Larranaga', 'quai-dorsay': "Quai d'Orsay",
      'rafael-gonzalez': 'Rafael Gonzalez', 'ramon-allones': 'Ramon Allones',
      'sancho-panza': 'Sancho Panza', 'trinidad': 'Trinidad',
      'vegas-robaina': 'Vegas Robaina', 'vegueros': 'Vegueros',
      'a-j-fernandez': 'A.J. Fernandez', 'aladino': 'Aladino',
      'alec-bradley': 'Alec Bradley', 'arturo-fuente': 'Arturo Fuente',
      'avo': 'AVO', 'brick-house': 'Brick House', 'camacho': 'Camacho',
      'cao': 'CAO', 'casa-turrent': 'Casa Turrent', 'charatan': 'Charatan',
      'chinchalero': 'Chinchalero', 'davidoff': 'Davidoff',
      'drew-estate': 'Drew Estate', 'flor-de-selva': 'Flor De Selva',
      'foundation-cigars': 'Foundation', 'gurkha': 'Gurkha',
      'joya-de-nicaragua': 'Joya de Nicaragua', 'kristoff': 'Kristoff',
      'la-aurora': 'La Aurora', 'la-invicta': 'La Invicta',
      'macanudo': 'Macanudo', 'my-father': 'My Father', 'oliva': 'Oliva',
      'oscar-valladares': 'Oscar Valladares', 'padron': 'Padron',
      'perdomo': 'Perdomo', 'plasencia': 'Plasencia', 'quorum': 'Quorum',
      'regius': 'Regius', 'rocky-patel': 'Rocky Patel', 'tatuaje': 'Tatuaje',
      'ritmeester': 'Ritmeester', 'conquistador': 'Conquistador',
      'mitchellero': 'Mitchellero', 'puffin-cigars': 'Puffin',
      'two-smoking-barrels': 'Two Smoking Barrels',
    };
    return brandMap[slug] || name.split(' - ')[0].trim();
  }

  function extractFormat(name) {
    const formats = [
      'Double Corona', 'Petit Corona', 'Corona Extra', 'Corona Gorda', 'Grand Corona',
      'Corona', 'Robusto', 'Churchill', 'Torpedo', 'Toro', 'Petit', 'Gordo',
      'Lancero', 'Belicoso', 'Figurado', 'Perfecto', 'Panetela', 'Lonsdale',
      'Rothschild', 'Short Robusto', 'Petit Robusto', 'Half Corona', 'Nub',
      'Puritos', 'Cigarillo', 'Chicos', 'Mini', 'Club'
    ];
    const lower = name.toLowerCase();
    for (const f of formats) {
      if (lower.includes(f.toLowerCase())) return f;
    }
    return null;
  }

  let imported = 0;
  for (let i = 0; i < gqData.length; i++) {
    const gq = gqData[i];
    const brand = extractBrand(gq.name, gq.brandSlug);
    
    await sql`
      INSERT INTO cs_cigars (
        source_id, name, brand, description, price, currency, available,
        url, image_url, retailer, retailer_url, category, format, scraped_at
      ) VALUES (
        ${'gq-' + (i + 1)}, ${gq.name}, ${brand}, ${''},
        ${gq.price}, ${'GBP'}, ${true},
        ${gq.url || 'https://www.gqtobaccos.com/' + gq.brandSlug + '/'},
        ${gq.imageUrl}, ${'GQ Tobaccos'}, ${'https://www.gqtobaccos.com'},
        ${null}, ${extractFormat(gq.name)},
        ${new Date()}
      )
    `;
    imported++;
    if (imported % 200 === 0) console.log(`  Imported ${imported}/${gqData.length}`);
  }

  console.log(`\n🎉 Imported ${imported} GQ Tobaccos products`);

  // Final stats
  const stats = await sql`
    SELECT retailer, COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image
    FROM cs_cigars GROUP BY retailer ORDER BY total DESC
  `;
  console.log('\n📊 Database totals:');
  let grandTotal = 0;
  for (const s of stats) {
    const pct = Math.round((s.with_image / s.total) * 100);
    console.log(`  ${s.retailer}: ${s.total} cigars, ${s.with_image} with images (${pct}%)`);
    grandTotal += parseInt(s.total);
  }
  console.log(`  TOTAL: ${grandTotal} cigars`);
}

seedGQ().catch(console.error);
