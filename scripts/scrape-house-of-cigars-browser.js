/**
 * House of Cigars browser-based scraper
 * Uses the simpler approach: fetch each category page via HTTPS,
 * but extract products using WooCommerce REST API which is usually exposed
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.thehouseofcigars.co.uk';

// All brand category slugs
const brandPages = [
  { slug: 'new-world-cigars/nicaraguan-cigars/aj-fernandez', brand: 'A.J. Fernandez' },
  { slug: 'new-world-cigars/nicaraguan-cigars/aging-room-cigars', brand: 'Aging Room' },
  { slug: 'new-world-cigars/nicaraguan-cigars/brick-house-cigars', brand: 'Brick House' },
  { slug: 'new-world-cigars/nicaraguan-cigars/charatan-cigars', brand: 'Charatan' },
  { slug: 'new-world-cigars/nicaraguan-cigars/chinchalero-cigars', brand: 'Chinchalero' },
  { slug: 'new-world-cigars/nicaraguan-cigars/conquistador-cigars', brand: 'Conquistador' },
  { slug: 'new-world-cigars/nicaraguan-cigars/curivari-buenaventura-cigars', brand: 'Curivari' },
  { slug: 'new-world-cigars/nicaraguan-cigars/don-tomas-cigars', brand: 'Don Tomas' },
  { slug: 'new-world-cigars/nicaraguan-cigars/drew-estate-cigars', brand: 'Drew Estate' },
  { slug: 'new-world-cigars/nicaraguan-cigars/factory-smokes-cigars', brand: 'Factory Smokes' },
  { slug: 'new-world-cigars/nicaraguan-cigars/flor-de-nicaragua-cigars', brand: 'Flor de Nicaragua' },
  { slug: 'new-world-cigars/nicaraguan-cigars/flor-de-oliva-cigars', brand: 'Flor de Oliva' },
  { slug: 'new-world-cigars/nicaraguan-cigars/foundation-cigars', brand: 'Foundation' },
  { slug: 'new-world-cigars/nicaraguan-cigars/joya-de-nicaragua-cigars', brand: 'Joya de Nicaragua' },
  { slug: 'new-world-cigars/nicaraguan-cigars/karen-berger-cigars', brand: 'Karen Berger' },
  { slug: 'new-world-cigars/nicaraguan-cigars/luis-martinez', brand: 'Luis Martinez' },
  { slug: 'new-world-cigars/nicaraguan-cigars/my-father-cigars', brand: 'My Father' },
  { slug: 'new-world-cigars/nicaraguan-cigars/oliva-cigars', brand: 'Oliva' },
  { slug: 'new-world-cigars/nicaraguan-cigars/padron-cigars', brand: 'Padron' },
  { slug: 'new-world-cigars/nicaraguan-cigars/perdomo-cigars', brand: 'Perdomo' },
  { slug: 'new-world-cigars/nicaraguan-cigars/plasencia-cigars', brand: 'Plasencia' },
  { slug: 'new-world-cigars/nicaraguan-cigars/tatuaje-cigars', brand: 'Tatuaje' },
  { slug: 'new-world-cigars/dominican-cigars/arturo-fuente-cigars', brand: 'Arturo Fuente' },
  { slug: 'new-world-cigars/dominican-cigars/avo-cigars', brand: 'AVO' },
  { slug: 'new-world-cigars/dominican-cigars/casa-magna-cigars', brand: 'Casa Magna' },
  { slug: 'new-world-cigars/dominican-cigars/casa-carrillo-cigars', brand: 'Casa Carrillo' },
  { slug: 'new-world-cigars/dominican-cigars/davidoff-cigars', brand: 'Davidoff' },
  { slug: 'new-world-cigars/dominican-cigars/gurkha-cigars', brand: 'Gurkha' },
  { slug: 'new-world-cigars/dominican-cigars/kristoff-cigars', brand: 'Kristoff' },
  { slug: 'new-world-cigars/dominican-cigars/la-aurora-cigars', brand: 'La Aurora' },
  { slug: 'new-world-cigars/dominican-cigars/la-flor-dominicana-cigars', brand: 'La Flor Dominicana' },
  { slug: 'new-world-cigars/dominican-cigars/macanudo-cigars', brand: 'Macanudo' },
  { slug: 'new-world-cigars/dominican-cigars/pdr-cigars', brand: 'PDR' },
  { slug: 'new-world-cigars/dominican-cigars/zino-cigars', brand: 'Zino' },
  { slug: 'new-world-cigars/honduran-cigars/aladino-cigars', brand: 'Aladino' },
  { slug: 'new-world-cigars/honduran-cigars/alec-bradley-cigars', brand: 'Alec Bradley' },
  { slug: 'new-world-cigars/honduran-cigars/asylum-13-cigars', brand: 'Asylum 13' },
  { slug: 'new-world-cigars/honduran-cigars/camacho-cigars', brand: 'Camacho' },
  { slug: 'new-world-cigars/honduran-cigars/c-l-e-cigars', brand: 'C.L.E.' },
  { slug: 'new-world-cigars/honduran-cigars/eiroa-cigars', brand: 'Eiroa' },
  { slug: 'new-world-cigars/honduran-cigars/flor-de-selva-cigars', brand: 'Flor De Selva' },
  { slug: 'new-world-cigars/honduran-cigars/la-estrella-cigars', brand: 'La Estrella' },
  { slug: 'new-world-cigars/mexican-cigars/casa-turrent-cigars', brand: 'Casa Turrent' },
  { slug: 'cigarillos', brand: null },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-').replace(/&pound;/g, '£');
}

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractProducts(html) {
  const products = [];
  
  // Elementor renders each product as an e-loop-item block
  // Split HTML by loop items
  const itemRegex = /class="[^"]*e-loop-item[^"]*post-(\d+)[^"]*"([\s\S]*?)(?=class="[^"]*e-loop-item|$)/g;
  let match;
  
  while ((match = itemRegex.exec(html)) !== null) {
    const postId = match[1];
    const block = match[2];
    
    // Extract product URL and name - the title link is an <a> inside the loop item pointing to /product/
    const linkMatch = block.match(/<a[^>]*href="(https?:\/\/www\.thehouseofcigars\.co\.uk\/product\/[^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/);
    if (!linkMatch) continue;
    
    const url = linkMatch[1];
    const name = decodeEntities(linkMatch[2]).trim();
    if (!name || name.length < 5) continue;
    
    // Extract price - look for £XX.XX pattern in this block
    const priceMatch = block.match(/£([\d,.]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;
    
    // Extract image
    const imgMatch = block.match(/src="([^"]+\.(?:webp|jpg|jpeg|png))"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    
    products.push({ name, url, price, imageUrl, postId });
  }
  
  return products;
}

function extractFormat(name) {
  const formats = [
    'Double Corona', 'Petit Corona', 'Corona Extra', 'Corona Gorda', 'Grand Corona',
    'Corona', 'Double Robusto', 'Robusto', 'Churchill', 'Torpedo', 'Toro Grande', 'Toro',
    'Petit', 'Gordo', 'Lancero', 'Belicoso', 'Figurado', 'Perfecto', 'Panetela',
    'Lonsdale', 'Rothschild', 'Short Robusto', 'Petit Robusto', 'Half Corona', 'Nub',
    'Puritos', 'Purito', 'Cigarillo', 'Chicos', 'Mini', 'Club'
  ];
  const lower = name.toLowerCase();
  for (const f of formats) {
    if (lower.includes(f.toLowerCase())) return f;
  }
  return null;
}

async function scrapeAll() {
  const allProducts = [];
  const seen = new Set();
  
  console.log('🏠 House of Cigars Scraper v2 (per-item extraction)');
  console.log(`📋 ${brandPages.length} category pages to scrape\n`);
  
  for (const bp of brandPages) {
    const url = `${BASE}/product-category/${bp.slug}/`;
    
    try {
      let page = 1;
      let pageProducts = [];
      
      while (true) {
        const pageUrl = page === 1 ? url : `${url}page/${page}/`;
        const html = await fetchPage(pageUrl);
        if (!html) break;
        
        const products = extractProducts(html);
        if (products.length === 0) break;
        
        pageProducts.push(...products);
        
        // Check for next page
        if (!html.includes(`/page/${page + 1}/`)) break;
        page++;
        await sleep(400);
      }
      
      let added = 0;
      for (const p of pageProducts) {
        if (seen.has(p.url)) continue;
        seen.add(p.url);
        
        p.brand = bp.brand || p.name.split(' ').slice(0, 2).join(' ');
        p.format = extractFormat(p.name);
        allProducts.push(p);
        added++;
      }
      
      if (added > 0 || pageProducts.length > 0) {
        console.log(`  ✅ ${(bp.brand || bp.slug).padEnd(25)} ${added} products${page > 1 ? ` (${page} pages)` : ''}`);
      } else {
        console.log(`  ⚠️  ${bp.brand || bp.slug}: no products found`);
      }
    } catch (err) {
      console.log(`  ❌ ${bp.brand || bp.slug}: ${err.message}`);
    }
    
    await sleep(400);
  }
  
  const outPath = path.join(__dirname, '..', 'house-of-cigars-data.json');
  fs.writeFileSync(outPath, JSON.stringify(allProducts, null, 2));
  
  console.log(`\n📊 Summary:`);
  console.log(`   Categories scraped: ${brandPages.length}`);
  console.log(`   Total unique products: ${allProducts.length}`);
  console.log(`   With prices: ${allProducts.filter(p => p.price).length}`);
  console.log(`   With images: ${allProducts.filter(p => p.imageUrl).length}`);
  console.log(`\n💾 Saved to ${outPath}`);
}

scrapeAll().catch(console.error);
