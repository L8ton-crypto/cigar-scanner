/**
 * Rebellion Cigars scraper - HTML scraping from search endpoint
 * Search: /search/products?keywords=&page=N (12 items per page, ~28 pages)
 * Pattern: <h3 class="item-heading"><a href="URL">NAME</a></h3>
 *          <span class="price">&pound;PRICE</span>
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.rebellioncigars.co.uk';

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
    const options = {
      hostname: 'www.rebellioncigars.co.uk',
      path: pagePath,
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

function extractBrand(name) {
  // Rebellion uses "BRAND: PRODUCT" format
  const colonMatch = name.match(/^([^:]+):\s+(.+)/);
  if (colonMatch) return colonMatch[1].trim();
  return '';
}

function extractFormat(name) {
  const formats = [
    'Double Corona', 'Petit Corona', 'Corona Extra', 'Corona Gorda', 'Grand Corona',
    'Corona', 'Double Robusto', 'Robusto', 'Churchill', 'Torpedo', 'Toro Grande', 'Toro',
    'Petit', 'Gordo', 'Lancero', 'Belicoso', 'Figurado', 'Perfecto', 'Panetela',
    'Lonsdale', 'Rothschild', 'Short Robusto', 'Petit Robusto', 'Half Corona', 'Nub',
    'Magnum', 'Piramide', 'Epicure', 'No. 1', 'No. 2', 'No. 3', 'No. 4', 'No. 5',
    'Coronet', 'Senoritas', 'Cigarillos', 'Cigarillo', 'Mini', 'Short', 'Wide'
  ];
  const nameUpper = name;
  for (const f of formats) {
    if (nameUpper.toLowerCase().includes(f.toLowerCase())) return f;
  }
  return '';
}

function extractProducts(html) {
  const products = [];
  
  // Match each product card: article with item-heading containing link + price
  // Pattern: <h3 class="item-heading"><a href="URL">NAME</a></h3> ... <span class="price">£PRICE</span>
  const cardRegex = /<article class="card item-box product-box">([\s\S]*?)<\/article>/g;
  let match;
  
  while ((match = cardRegex.exec(html)) !== null) {
    const card = match[1];
    
    // Extract name and URL from item-heading
    const headingMatch = card.match(/<h3 class="item-heading">\s*<a href="([^"]+)">([^<]+)<\/a>/);
    if (!headingMatch) continue;
    
    const url = headingMatch[1];
    const rawName = decodeEntities(headingMatch[2].trim());
    
    // Extract first price (ignore duplicates from list view)
    const priceMatch = card.match(/class="price">\s*&pound;([\d,.]+)/);
    if (!priceMatch) continue;
    
    const price = parseFloat(priceMatch[1].replace(',', ''));
    if (isNaN(price) || price <= 0) continue;
    
    // Extract image
    const imgMatch = card.match(/<img src="([^"]+)"[^>]*class="item-img"/);
    const imageUrl = imgMatch ? (imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1]) : '';
    
    // Clean up name - Rebellion uses ALL CAPS
    const name = rawName
      .split(' ')
      .map(w => {
        if (w.length <= 2 && w !== 'OF' && w !== 'TO') return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ')
      .replace(/ - /g, ' - ');
    
    const brand = extractBrand(rawName);
    const format = extractFormat(rawName);
    
    products.push({
      name: name,
      rawName: rawName,
      brand: brand,
      format: format,
      price: price,
      url: url.startsWith('http') ? url : BASE + url,
      imageUrl: imageUrl,
      available: true
    });
  }
  
  return products;
}

async function scrape() {
  console.log('🏴 Rebellion Cigars Scraper');
  console.log('==========================\n');
  
  const allProducts = [];
  let page = 1;
  let emptyPages = 0;
  
  while (emptyPages < 2) {
    const url = `/search/products?keywords=&page=${page}`;
    const html = await fetchPage(url);
    
    if (!html) {
      console.log(`  Page ${page}: Failed to fetch`);
      emptyPages++;
      page++;
      continue;
    }
    
    const products = extractProducts(html);
    
    if (products.length === 0) {
      console.log(`  Page ${page}: 0 products (end of results)`);
      emptyPages++;
    } else {
      emptyPages = 0;
      allProducts.push(...products);
      console.log(`  Page ${page}: ${products.length} products (total: ${allProducts.length})`);
    }
    
    page++;
    await sleep(500); // Be polite
  }
  
  // Filter out non-cigar products (accessories, humidors, cutters, etc)
  const cigarProducts = allProducts.filter(p => {
    const lower = p.rawName.toLowerCase();
    // Skip accessories
    if (lower.includes('cutter') || lower.includes('lighter') || lower.includes('humidor') ||
        lower.includes('ashtray') || lower.includes('case') || lower.includes('punch') ||
        lower.includes('boveda') || lower.includes('humidity') || lower.includes('holder') ||
        lower.includes('travel') || lower.includes('pouch') || lower.includes('stand') ||
        lower.includes('xikar') || lower.includes('torch') || lower.includes('rest')) {
      return false;
    }
    return true;
  });
  
  // Deduplicate by URL
  const seen = new Set();
  const unique = cigarProducts.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total scraped: ${allProducts.length}`);
  console.log(`   After filtering accessories: ${cigarProducts.length}`);
  console.log(`   After dedup: ${unique.length}`);
  
  // Show some samples
  console.log('\n📋 Sample products:');
  unique.slice(0, 10).forEach(p => {
    console.log(`   ${p.name} — £${p.price}${p.brand ? ' [' + p.brand + ']' : ''}`);
  });
  
  // Show brand distribution
  const brands = {};
  unique.forEach(p => { brands[p.brand || 'Unknown'] = (brands[p.brand || 'Unknown'] || 0) + 1; });
  const topBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\n🏷️  Top brands:');
  topBrands.forEach(([b, c]) => console.log(`   ${b}: ${c}`));
  
  const outPath = path.join(__dirname, '..', 'rebellion-data.json');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2));
  console.log(`\n💾 Saved ${unique.length} products to rebellion-data.json`);
}

scrape().catch(console.error);
