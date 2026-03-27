/**
 * Turmeaus scraper - Zen Cart all_products with pagination
 * Scrapes cigar category pages to get name, price, URL
 * Prices in: <span class="new_price">£XX.XX</span> or <span class="now_price">Online Price: <strong>£XX.XX</strong></span>
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.turmeaus.co.uk';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-').replace(/&pound;/g, '£');
}

function fetchPage(pagePath) {
  return new Promise((resolve, reject) => {
    const url = new URL(pagePath, BASE);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    };
    const req = https.get(options, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractProducts(html) {
  const products = [];
  
  // Match product listing boxes
  // Pattern: product-name > a[href] for name/url, then new_price or now_price for price
  const regex = /<div class="product-name"><a href="([^"]+)">([^<]+)<\/a><\/div>[\s\S]*?(?:<span class="new_price">£([\d,.]+)<\/span>|<span class="now_price">Online Price: <strong>£([\d,.]+)<\/strong>)/g;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const name = decodeEntities(match[2].trim());
    const price = parseFloat((match[3] || match[4]).replace(',', ''));
    
    if (isNaN(price) || price <= 0) continue;
    
    // Extract image URL
    const imgPattern = new RegExp(`<a href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*><img[^>]*src="([^"]+)"`, 'i');
    const imgMatch = html.match(imgPattern);
    const imageUrl = imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + '/' + imgMatch[1]) : '';
    
    products.push({ name, price, url, imageUrl });
  }
  
  return products;
}

function extractBrand(name) {
  // Known Cuban cigar brands
  const cubanBrands = [
    'Bolivar', 'Cohiba', 'Cuaba', 'Diplomaticos', 'El Rey del Mundo', 'Fonseca',
    'Guantanamera', 'H. Upmann', 'Hoyo de Monterrey', 'Jose L Piedra', 'Juan Lopez',
    'La Flor de Cano', 'La Gloria Cubana', 'Montecristo', 'Partagas', 'Por Larranaga',
    'Punch', "Quai d'Orsay", 'Quintero', 'Rafael Gonzalez', 'Ramon Allones',
    'Romeo y Julieta', 'Saint Luis Rey', 'San Cristobal', 'Sancho Panza',
    'Trinidad', 'Vegas Robaina', 'Vegueros'
  ];
  // New world brands
  const nwBrands = [
    'A.J. Fernandez', 'Aladino', 'Alec Bradley', 'Arturo Fuente', 'AVO',
    'Brick House', 'Camacho', 'CAO', 'Casa Turrent', 'Davidoff', 'Drew Estate',
    'Eiroa', 'Foundation', 'Gurkha', 'Joya de Nicaragua', 'Kristoff',
    'La Aurora', 'La Flor Dominicana', 'Macanudo', 'My Father', 'Oliva',
    'Padron', 'Perdomo', 'Plasencia', 'Rocky Patel', 'Tatuaje'
  ];
  
  const allBrands = [...cubanBrands, ...nwBrands];
  for (const b of allBrands) {
    if (name.toLowerCase().includes(b.toLowerCase())) return b;
  }
  return '';
}

function extractFormat(name) {
  const formats = [
    'Double Corona', 'Petit Corona', 'Corona Extra', 'Corona Gorda', 'Grand Corona',
    'Corona', 'Double Robusto', 'Robusto', 'Churchill', 'Torpedo', 'Toro Grande', 'Toro',
    'Petit', 'Gordo', 'Lancero', 'Belicoso', 'Figurado', 'Perfecto', 'Panetela',
    'Lonsdale', 'Rothschild', 'Short Robusto', 'Petit Robusto', 'Half Corona', 'Nub',
    'Magnum', 'Piramide', 'Epicure', 'No. 1', 'No. 2', 'No. 3', 'No. 4', 'No. 5',
    'Senoritas', 'Cigarillos', 'Cigarillo', 'Mini', 'Short', 'Wide', 'Coronet', 'Puritos'
  ];
  for (const f of formats) {
    if (name.toLowerCase().includes(f.toLowerCase())) return f;
  }
  return '';
}

function isCigar(name) {
  const lower = name.toLowerCase();
  // Exclude non-cigar products
  if (lower.includes('pipe tobacco') || lower.includes('rolling tobacco')) return false;
  if (lower.includes('whisky') || lower.includes('whiskey') || lower.includes('bourbon') || 
      lower.includes('rum ') || lower.includes('gin ') || lower.includes('vodka') ||
      lower.includes('brandy') || lower.includes('cognac') || lower.includes('wine')) return false;
  if (lower.includes('hip flask') || lower.includes('cufflink') || lower.includes('keyring') ||
      lower.includes('decanter') || lower.includes('glass set') || lower.includes('tumbler')) return false;
  if (lower.match(/\bpipe\b/) && !lower.includes('cigar')) return false;
  if (lower.includes('snuff') || lower.includes('chewing tobacco')) return false;
  
  // Include if it's clearly a cigar
  if (lower.includes('cigar') || lower.includes('corona') || lower.includes('robusto') ||
      lower.includes('churchill') || lower.includes('torpedo') || lower.includes('toro') ||
      lower.includes('lancero') || lower.includes('belicoso') || lower.includes('lonsdale') ||
      lower.includes('habano') || lower.includes('maduro') || lower.includes('connecticut') ||
      lower.includes('sampler') || lower.includes('humidor')) return true;
  
  // Check for known brand names  
  if (extractBrand(name)) return true;
  
  return false;
}

async function scrape() {
  console.log('🏪 Turmeaus Scraper');
  console.log('===================\n');
  
  const allProducts = [];
  let page = 1;
  let consecutiveEmpty = 0;
  
  while (consecutiveEmpty < 2) {
    const url = `/all_products.php?page=${page}`;
    
    try {
      const html = await fetchPage(url);
      
      if (!html) {
        console.log(`  Page ${page}: Failed`);
        consecutiveEmpty++;
        page++;
        continue;
      }
      
      const products = extractProducts(html);
      
      if (products.length === 0) {
        console.log(`  Page ${page}: 0 products (end)`);
        consecutiveEmpty++;
      } else {
        consecutiveEmpty = 0;
        allProducts.push(...products);
        if (page % 20 === 0 || page <= 5) {
          console.log(`  Page ${page}: ${products.length} products (total: ${allProducts.length})`);
        }
      }
    } catch(e) {
      console.log(`  Page ${page}: Error - ${e.message}`);
      consecutiveEmpty++;
    }
    
    page++;
    await sleep(300);
  }
  
  console.log(`\n📦 Total scraped: ${allProducts.length}`);
  
  // Filter to cigars
  const cigars = allProducts.filter(p => isCigar(p.name));
  
  // Add brand and format
  const enriched = cigars.map(p => ({
    ...p,
    brand: extractBrand(p.name),
    format: extractFormat(p.name),
    available: true
  }));
  
  // Deduplicate by URL
  const seen = new Set();
  const unique = enriched.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
  
  console.log(`   Cigars only: ${cigars.length}`);
  console.log(`   After dedup: ${unique.length}`);
  
  // Brand distribution
  const brands = {};
  unique.forEach(p => { brands[p.brand || 'Unknown'] = (brands[p.brand || 'Unknown'] || 0) + 1; });
  const topBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\n🏷️  Top brands:');
  topBrands.forEach(([b, c]) => console.log(`   ${b}: ${c}`));
  
  // Samples
  console.log('\n📋 Sample products:');
  unique.slice(0, 10).forEach(p => console.log(`   ${p.name} — £${p.price}${p.brand ? ' [' + p.brand + ']' : ''}`));
  
  const outPath = path.join(__dirname, '..', 'turmeaus-data.json');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2));
  console.log(`\n💾 Saved ${unique.length} cigars to turmeaus-data.json`);
}

scrape().catch(console.error);
