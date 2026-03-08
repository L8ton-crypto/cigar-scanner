const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function parseCgarsPDF() {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'cgars-pricelist.pdf'));
  const data = await pdfParse(buf);
  
  const lines = data.text.split('\n').filter(l => l.trim());
  
  const cigars = [];
  let currentCategory = 'Uncategorized';
  let skippedLines = [];
  
  // Category header pattern
  const categoryPattern = /^(Shop Cigars|Cuban Cigars|New World Cigars|Rest of the World Cigars|Cigar Samplers)\s*>\s*(.+)/;
  
  // Price pattern: name followed by £price (possibly with sale price)
  // Some have format: "Name£29.99" or "Name£29.99			£19.99" (original + sale)
  const pricePattern = /^(.+?)£([\d,]+\.?\d*)\s*(?:£([\d,]+\.?\d*))?$/;
  
  // Skip patterns
  const skipPatterns = [
    /^Prices correct at time of printing/,
    /^Page \d+\/\d+/,
    /^\d+\/\d+\s*$/,
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip non-product lines
    if (skipPatterns.some(p => p.test(trimmed))) continue;
    if (!trimmed || trimmed.length < 5) continue;
    
    // Check for category header
    const catMatch = trimmed.match(categoryPattern);
    if (catMatch) {
      currentCategory = catMatch[2].replace(' Cigars', '').trim();
      continue;
    }
    
    // Check for product line
    const priceMatch = trimmed.match(pricePattern);
    if (priceMatch) {
      const name = priceMatch[1].trim();
      const originalPrice = parseFloat(priceMatch[2].replace(',', ''));
      const salePrice = priceMatch[3] ? parseFloat(priceMatch[3].replace(',', '')) : null;
      
      // Skip non-cigar items (subscriptions, events, lockers, etc.)
      if (name.match(/subscription|event|locker|gift card|membership|humidor rental/i)) continue;
      
      // Extract brand from name (first few words before a known pattern)
      const brand = extractBrand(name, currentCategory);
      
      cigars.push({
        sourceId: `cgars-${cigars.length + 1}`,
        name: name,
        brand: brand,
        description: '',
        price: salePrice || originalPrice,
        originalPrice: salePrice ? originalPrice : null,
        currency: 'GBP',
        available: !name.includes('(Discontinued)') && !name.includes('(End of Line)') && !name.includes('(Sold Out)'),
        url: buildCgarsUrl(name),
        image: null, // Will need to scrape from website
        retailer: 'C.Gars Ltd',
        retailerUrl: 'https://www.cgarsltd.co.uk',
        category: currentCategory,
        parentCategory: catMatch ? catMatch[1] : getCategoryParent(currentCategory, trimmed),
        length_mm: null,
        ring_gauge: null,
        strength: null,
        raw_tags: [],
        scraped_at: new Date().toISOString()
      });
    } else {
      // Track unmatched lines for debugging
      if (trimmed.includes('£')) {
        skippedLines.push(trimmed.substring(0, 100));
      }
    }
  }
  
  // Stats
  const brands = [...new Set(cigars.map(c => c.brand))].sort();
  const categories = [...new Set(cigars.map(c => c.category))].sort();
  
  console.log(`\n📊 CGars PDF Parse Results:`);
  console.log(`   Total cigars: ${cigars.length}`);
  console.log(`   Unique brands: ${brands.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   With sale prices: ${cigars.filter(c => c.originalPrice).length}`);
  console.log(`   Discontinued/EOL: ${cigars.filter(c => !c.available).length}`);
  console.log(`   Skipped lines with £: ${skippedLines.length}`);
  
  // Show category breakdown
  console.log(`\n📁 Categories:`);
  const catCounts = {};
  cigars.forEach(c => {
    catCounts[c.category] = (catCounts[c.category] || 0) + 1;
  });
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count}`);
  });
  
  // Show top brands
  console.log(`\n🏷️  Top 20 Brands:`);
  const brandCounts = {};
  cigars.forEach(c => {
    brandCounts[c.brand] = (brandCounts[c.brand] || 0) + 1;
  });
  Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([brand, count]) => {
    console.log(`   ${brand}: ${count}`);
  });
  
  if (skippedLines.length > 0) {
    console.log(`\n⚠️  Sample skipped lines:`);
    skippedLines.slice(0, 10).forEach(l => console.log(`   ${l}`));
  }
  
  // Save to file
  const outPath = path.join(__dirname, '..', 'cgars-cigars.json');
  fs.writeFileSync(outPath, JSON.stringify(cigars, null, 2));
  console.log(`\n💾 Saved to ${outPath}`);
  
  return cigars;
}

function getCategoryParent(category, line) {
  // Determine parent from the original category mapping
  const cubanBrands = ['Bolivar', 'Cohiba', 'Cuaba', 'Diplomaticos', 'El Rey del Mundo', 
    'Fonseca', 'Guantanamera', 'H. Upmann', 'Hoyo de Monterrey', 'Jose L Piedra', 
    'Juan Lopez', 'La Flor De Cano', 'La Gloria Cubana', 'Montecristo', 'Partagas', 
    'Por Larranaga', 'Punch', "Quai d'Orsay", 'Quintero', 'Rafael Gonzalez', 
    'Ramon Allones', 'Romeo y Julieta', 'Saint Luis Rey', 'San Cristobal', 
    'Sancho Panza', 'Trinidad', 'Vegas Robaina', 'Vegueros'];
  
  if (cubanBrands.some(b => category.includes(b))) return 'Cuban Cigars';
  return 'New World Cigars';
}

function extractBrand(name, category) {
  // For brand-specific categories, use the category name as brand
  // e.g. "Cuban Cigars > Bolivar Cigars" => brand is "Bolivar"
  const brandFromCategory = category.replace(/ Cigars?$/i, '').trim();
  
  // Categories that aren't brand-specific
  const nonBrandCategories = [
    'Shop by Flavoured', 'Top 25 Award Winning', 'C.Gars Ltd Top 40',
    'New to Cigar Smoking?', 'C.Gars Ltd House Brands & Orchant Selection',
    'Cigar Subscriptions', 'Client Lockers', 'Cigar & Whisky Sampling Events',
    'Bundle Deals', 'Cheap', 'Clearance', 'Aged, Rare & Unusual',
    'Packs of 3 & 5', 'Boxes of 10', 'Minis, Clubs & Puritos',
    'Mixed Box Special', 'LCDH Exclusive', 'Limited Edition Havanas',
    'Tubed', 'UK Regional Edition'
  ];
  
  if (!nonBrandCategories.some(c => category.includes(c))) {
    return brandFromCategory;
  }
  
  // For non-brand categories, extract brand from the cigar name
  // Common patterns: "Brand Name Product Details"
  const knownBrands = [
    'A.J. Fernandez', 'Aladino', 'Alec Bradley', 'Antonio Gimenez', 'Arturo Fuente',
    'AVO', 'Black Label Trading Company', 'Blackbird', 'Bolivar', 'Bossner',
    'Brick House', 'Caldwell', 'Camacho', 'CAO', 'Casa 1910', 'Casa Turrent',
    'Cavalier Geneve', 'Charatan', 'Chateau Diadem', 'Chevron', 'Chinchalero',
    'CigarKings', 'CLE', 'Cohiba', 'Conquistador', 'Curivari', 'Cusano',
    'Davidoff', 'De Olifant', 'Diamond Crown', 'Diplomaticos', 'Don Tomas',
    'Drew Estate', 'Dunbarton', 'EGM', 'Eiroa', 'El Rey del Mundo', 'El Septimo',
    'Flor de Filipinas', 'Flor De Selva', 'Fonseca', 'Foundation', 'Fratello',
    'Freud', 'Guantanamera', 'Guillermo Pena', 'Gurkha', 'H. Upmann',
    'Henri Wintermans', 'Hiram & Solomon', 'Hoyo de Monterrey',
    'Independencia 1898', 'Inka Secret Blend', 'J Cortes', 'J.C Newman',
    'Jose L Piedra', 'Joya de Nicaragua', 'Juan Lopez', 'Juliany',
    'Karen Berger', 'Kristoff', 'La Aurora', 'La Estrella', 'La Flor De Cano',
    'La Flor Dominicana', 'La Galera', 'La Gloria Cubana', 'La Invicta', 'La Unica',
    'Leon Jimenes', 'Luis Martinez', 'Macanudo', 'Matilde', 'Meerapfel',
    'Mitchellero', 'Montecristo', 'My Father', 'Nostrano del Brenta', 'Oliva',
    'Oscar Valladares', 'Padron', 'Partagas', 'PDR', 'Perdomo', 'Perla Del Mar',
    'Plasencia', 'Por Larranaga', 'Puffin', 'Punch', "Quai d'Orsay", 'Quintero',
    'Quorum', 'Rafael Gonzalez', 'Ramon Allones', 'Regius', 'Rocky Patel',
    'Romeo y Julieta', 'Room 101', 'Rosalone', 'Saint Luis Rey',
    'San Cristobal', 'San Lotano', 'Sancho Panza', 'Silencio', 'Tatuaje',
    'The Only One', 'Trinidad', 'Umnum', 'VegaFina', 'Vegas Robaina', 'Vegueros',
    'Warped', 'West Tampa', 'Zino', 'La Estancia', 'Machetero', 'Unbanded'
  ].sort((a, b) => b.length - a.length); // Sort by length desc for longest match first
  
  for (const brand of knownBrands) {
    if (name.startsWith(brand)) {
      return brand;
    }
  }
  
  // Fallback: take first 2-3 words
  const words = name.split(' ');
  if (words.length >= 2) {
    return words.slice(0, 2).join(' ');
  }
  return words[0];
}

function buildCgarsUrl(name) {
  // Build approximate CGars URL from product name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.cgarsltd.co.uk/${slug}-p.asp`;
}

parseCgarsPDF().catch(console.error);
