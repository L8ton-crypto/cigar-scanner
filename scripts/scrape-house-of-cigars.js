/**
 * House of Cigars scraper - uses WooCommerce Store REST API
 * Endpoint: /wp-json/wc/store/v1/products?per_page=100&page=N
 * Prices in minor units (pence) - divide by 100
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.thehouseofcigars.co.uk';
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
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
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

async function scrapeAll() {
  const allProducts = [];
  let page = 1;
  const perPage = 100; // WooCommerce Store API max
  
  console.log('🏠 House of Cigars Scraper (WooCommerce Store API)');
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
      
      // Extract brand from attributes or categories
      let brand = null;
      const brandAttr = p.attributes?.find(a => a.name === 'Brand');
      if (brandAttr?.terms?.[0]) {
        brand = brandAttr.terms[0].name;
      }
      if (!brand) {
        // Try from categories
        const catNames = (p.categories || []).map(c => c.name);
        // Skip generic categories
        const skip = ['CUBAN CIGARS', 'NEW WORLD CIGARS', 'CIGARILLOS', 'SAMPLERS', 
                       'NICARAGUAN CIGARS', 'DOMINICAN CIGARS', 'HONDURAN CIGARS', 'MEXICAN CIGARS',
                       'AWARDED CIGARS', 'TOP 25 CIGARS', 'CIGAR OF THE YEAR',
                       'SMALL CIGARS SAMPLERS', 'DOMINICAN SAMPLERS', 'NICARAGUAN SAMPLERS',
                       'HONDURAN SAMPLERS', 'SMALL CIGARS', 'SMALL CIGARS HAND MADE'];
        const brandCat = catNames.find(c => !skip.includes(c.toUpperCase()));
        if (brandCat) brand = brandCat;
      }
      if (!brand) {
        brand = name.split(' ').slice(0, 2).join(' ');
      }
      
      const inStock = p.is_in_stock;
      
      allProducts.push({
        name,
        brand,
        price,
        url,
        imageUrl,
        format: extractFormat(name),
        inStock,
        postId: p.id
      });
    }
    
    console.log(`  Page ${page}: ${products.length} products (total: ${allProducts.length})`);
    
    if (products.length < perPage) break; // Last page
    page++;
    await sleep(500);
  }
  
  const outPath = path.join(__dirname, '..', 'house-of-cigars-data.json');
  fs.writeFileSync(outPath, JSON.stringify(allProducts, null, 2));
  
  // Stats
  const brands = {};
  allProducts.forEach(p => { brands[p.brand] = (brands[p.brand] || 0) + 1; });
  const sortedBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]);
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total products: ${allProducts.length}`);
  console.log(`   With prices: ${allProducts.filter(p => p.price).length}`);
  console.log(`   With images: ${allProducts.filter(p => p.imageUrl).length}`);
  console.log(`   In stock: ${allProducts.filter(p => p.inStock).length}`);
  console.log(`   Unique brands: ${Object.keys(brands).length}`);
  console.log(`\n🏷️  Top brands:`);
  sortedBrands.slice(0, 15).forEach(([b, c]) => console.log(`   ${b}: ${c}`));
  console.log(`\n💾 Saved to ${outPath}`);
}

scrapeAll().catch(console.error);
