/**
 * Sautter Cigars scraper - uses WooCommerce Store REST API
 * Same pattern as House of Cigars
 * Endpoint: /wp-json/wc/store/v1/products?per_page=100&page=N
 * Prices in minor units (pence) - divide by 100
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.sauttercigars.com';
const API = '/wp-json/wc/store/v1/products';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-').replace(/&pound;/g, '£');
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      if (res.statusCode !== 200) { console.log(`  HTTP ${res.statusCode} for ${url}`); resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
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

// Categories to EXCLUDE (not cigars)
const EXCLUDED_CATEGORIES = [
  'Accessories', 'Ashtrays', 'Candles', 'Cutters', 'Lighters', 'Humidors',
  'Cases', 'Pouches', 'Lifestyle', 'Art', 'Books', 'Writing', 'Clothing',
  'Private Purchases', 'Spirits', 'Whisky', 'Rum', 'Gin', 'Wine',
  'Coffee', 'Chocolate', 'Gift Sets', 'Vouchers', 'Membership'
];

function isExcludedCategory(categories) {
  if (!categories || categories.length === 0) return false;
  const catNames = categories.map(c => c.name);
  // If ALL categories are excluded types, skip the product
  return catNames.every(name => 
    EXCLUDED_CATEGORIES.some(exc => name.toLowerCase().includes(exc.toLowerCase()))
  );
}

function extractBrand(product) {
  // Try brands field first
  if (product.brands && product.brands.length > 0) {
    return product.brands[0].name;
  }
  // Try categories - brands parent is id 190
  if (product.categories) {
    for (const cat of product.categories) {
      // Skip top-level and non-brand categories
      const skip = ['Brands', 'Accessories', 'Lifestyle', 'Private Purchases',
                     'Cuban Cigars', 'New World Cigars', 'Cigarillos', 'Samplers'];
      if (!skip.includes(cat.name) && !EXCLUDED_CATEGORIES.some(e => cat.name.includes(e))) {
        return decodeEntities(cat.name);
      }
    }
  }
  // Fallback: first two words of name
  return decodeEntities(product.name).split(' ').slice(0, 2).join(' ');
}

async function scrapeAll() {
  const allProducts = [];
  let page = 1;
  const perPage = 100;
  
  console.log('🏪 Sautter Cigars Scraper (WooCommerce Store API)');
  console.log('');
  
  while (true) {
    const url = `${BASE}${API}?per_page=${perPage}&page=${page}`;
    console.log(`  Fetching page ${page}...`);
    
    const products = await fetchJSON(url);
    
    if (!products || products.length === 0) {
      console.log(`  Page ${page}: no more products`);
      break;
    }
    
    for (const p of products) {
      const name = decodeEntities(p.name);
      const price = p.prices?.price ? parseInt(p.prices.price) / Math.pow(10, p.prices.currency_minor_unit || 2) : null;
      const imageUrl = p.images?.[0]?.src || null;
      const url = p.permalink;
      const inStock = p.is_in_stock;
      
      // Skip non-cigar products
      if (isExcludedCategory(p.categories)) continue;
      
      const brand = extractBrand(p);
      
      allProducts.push({
        name,
        brand,
        price,
        url,
        imageUrl,
        format: extractFormat(name),
        inStock,
        wooId: p.id
      });
    }
    
    console.log(`  Page ${page}: ${products.length} products (cigars collected: ${allProducts.length})`);
    
    if (products.length < perPage) break;
    page++;
    await sleep(800); // Be polite
  }
  
  const outPath = path.join(__dirname, '..', 'sautter-data.json');
  fs.writeFileSync(outPath, JSON.stringify(allProducts, null, 2));
  
  // Stats
  const brands = {};
  allProducts.forEach(p => { brands[p.brand] = (brands[p.brand] || 0) + 1; });
  const sortedBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]);
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total cigar products: ${allProducts.length}`);
  console.log(`   With prices: ${allProducts.filter(p => p.price).length}`);
  console.log(`   With images: ${allProducts.filter(p => p.imageUrl).length}`);
  console.log(`   In stock: ${allProducts.filter(p => p.inStock).length}`);
  console.log(`   Unique brands: ${Object.keys(brands).length}`);
  console.log(`\n🏷️  Top brands:`);
  sortedBrands.slice(0, 15).forEach(([b, c]) => console.log(`   ${b}: ${c}`));
  console.log(`\n💾 Saved to ${outPath}`);
}

scrapeAll().catch(console.error);
