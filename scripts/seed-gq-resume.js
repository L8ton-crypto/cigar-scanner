const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function resume() {
  const gqData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'gq-tobaccos-cigars.json'), 'utf8'));
  
  // Check what's already in
  const existing = await sql`SELECT COUNT(*) as c FROM cs_cigars WHERE retailer = 'GQ Tobaccos'`;
  const startFrom = parseInt(existing[0].c);
  console.log(`Already imported: ${startFrom}/${gqData.length}`);
  
  if (startFrom >= gqData.length) {
    console.log('All done!');
    return;
  }

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

  const formats = ['Double Corona','Petit Corona','Corona Extra','Corona Gorda','Grand Corona','Corona','Robusto','Churchill','Torpedo','Toro','Petit','Gordo','Lancero','Belicoso','Figurado','Perfecto','Panetela','Lonsdale','Rothschild','Short Robusto','Petit Robusto','Half Corona','Nub','Puritos','Cigarillo','Chicos','Mini','Club'];

  let imported = 0;
  for (let i = startFrom; i < gqData.length; i++) {
    const gq = gqData[i];
    const brand = brandMap[gq.brandSlug] || gq.name.split(' - ')[0].trim();
    let format = null;
    const lower = gq.name.toLowerCase();
    for (const f of formats) { if (lower.includes(f.toLowerCase())) { format = f; break; } }
    
    await sql`
      INSERT INTO cs_cigars (
        source_id, name, brand, description, price, currency, available,
        url, image_url, retailer, retailer_url, format, scraped_at
      ) VALUES (
        ${'gq-' + (i + 1)}, ${gq.name}, ${brand}, ${''},
        ${gq.price}, ${'GBP'}, ${true},
        ${gq.url || 'https://www.gqtobaccos.com/' + gq.brandSlug + '/'},
        ${gq.imageUrl}, ${'GQ Tobaccos'}, ${'https://www.gqtobaccos.com'},
        ${format}, ${new Date()}
      )
    `;
    imported++;
    if (imported % 100 === 0) console.log(`  +${imported} (${startFrom + imported}/${gqData.length})`);
  }

  console.log(`\nImported ${imported} more. Total GQ entries now: ${startFrom + imported}`);
  
  const stats = await sql`
    SELECT retailer, COUNT(*) as total,
      COUNT(image_url) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_image
    FROM cs_cigars GROUP BY retailer ORDER BY total DESC
  `;
  let grandTotal = 0;
  for (const s of stats) {
    console.log(`  ${s.retailer}: ${s.total} (${s.with_image} with images)`);
    grandTotal += parseInt(s.total);
  }
  console.log(`  TOTAL: ${grandTotal}`);
}

resume().catch(console.error);
