const https = require('https');
const fs = require('fs');
const path = require('path');

const brandPages = [
  'bolivar', 'cohiba', 'cuaba', 'diplomaticos', 'el-rey-del-mundo',
  'fonseca', 'guantanamera', 'h-upmann', 'hoyo-de-monterrey',
  'jose-l-piedra', 'juan-lopez', 'la-gloria-cubana', 'montecristo',
  'partagas', 'por-larranaga', 'punch', 'quai-dorsay', 'quintero',
  'rafael-gonzalez', 'ramon-allones', 'romeo-y-julieta',
  'saint-luis-rey', 'san-cristobal-de-la-habana', 'sancho-panza',
  'trinidad', 'vegas-robaina', 'vegueros',
  'a-j-fernandez', 'aladino', 'alec-bradley', 'arturo-fuente',
  'avo', 'brick-house', 'camacho', 'cao', 'casa-turrent',
  'charatan', 'chinchalero', 'davidoff', 'drew-estate',
  'flor-de-selva', 'foundation-cigars', 'gurkha', 'inka-secret-blend',
  'joya-de-nicaragua', 'kristoff', 'la-aurora', 'la-flor-dominicana',
  'la-invicta', 'macanudo', 'my-father', 'nub-cigars', 'oliva',
  'oscar-valladares', 'padron', 'perdomo', 'plasencia',
  'quorum', 'regius', 'rocky-patel', 'tatuaje', 'vegafina',
  'ritmeester', 'villiger-cigars', 'hamlet-cigars',
  'henri-wintermans-cigars', 'conquistador', 'mitchellero',
  'puffin-cigars', 'two-smoking-barrels', 'meerapfel',
];

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
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
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractProducts(html) {
  const products = [];
  
  // Method that worked before: card-figure img tags
  const imgRegex = /class="card-figure"[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let imageUrl = match[1];
    let name = decodeEntities(match[2]).trim();
    if (!name || name.length < 3) continue;
    products.push({ name, imageUrl, price: null, url: null });
  }
  
  // Get prices separately (they're in order matching products)
  const priceRegex = /class="price[^"]*"[^>]*>\s*£([\d,.]+)/g;
  let i = 0;
  while ((match = priceRegex.exec(html)) !== null) {
    if (i < products.length) {
      products[i].price = parseFloat(match[1].replace(',', ''));
    }
    i++;
  }
  
  // Get product URLs
  const urlRegex = /class="card-figure"[\s\S]*?<a[^>]*href="([^"]+)"/g;
  i = 0;
  while ((match = urlRegex.exec(html)) !== null) {
    if (i < products.length) {
      products[i].url = match[1];
    }
    i++;
  }
  
  return products;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x3D;/g, '=');
}

function getMaxPage(html) {
  const match = html.match(/Page \d+ of (\d+)/);
  if (match) return parseInt(match[1]);
  const nums = [...html.matchAll(/page(?:=|&#x3D;)(\d+)/g)].map(m => parseInt(m[1]));
  return nums.length > 0 ? Math.max(...nums) : 1;
}

async function scrapeAll() {
  const allProducts = [];
  
  console.log(`Scraping GQ Tobaccos - ${brandPages.length} brands...\n`);
  
  for (const brand of brandPages) {
    let brandProducts = [];
    
    const html = await fetchPage(`https://www.gqtobaccos.com/${brand}/`);
    if (!html) {
      await sleep(200);
      continue;
    }
    
    const p1 = extractProducts(html);
    brandProducts.push(...p1);
    
    const maxPage = getMaxPage(html);
    for (let page = 2; page <= maxPage; page++) {
      await sleep(300);
      const pageHtml = await fetchPage(`https://www.gqtobaccos.com/${brand}/?page=${page}`);
      if (!pageHtml) break;
      const pp = extractProducts(pageHtml);
      if (pp.length === 0) break;
      brandProducts.push(...pp);
    }
    
    if (brandProducts.length > 0) {
      console.log(`  ${brand}: ${brandProducts.length}${maxPage > 1 ? ` (${maxPage}p)` : ''}`);
      allProducts.push(...brandProducts.map(p => ({
        ...p, brandSlug: brand, retailer: 'GQ Tobaccos', retailerUrl: 'https://www.gqtobaccos.com'
      })));
    }
    
    await sleep(200);
  }
  
  // Dedupe
  const seen = new Set();
  const unique = allProducts.filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`\nTotal: ${allProducts.length} -> ${unique.length} unique`);
  console.log(`Images: ${unique.filter(p => p.imageUrl).length}`);
  console.log(`Prices: ${unique.filter(p => p.price).length}`);
  
  const outPath = path.join(__dirname, '..', 'gq-tobaccos-cigars.json');
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2));
  console.log(`Saved to ${outPath}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
scrapeAll().catch(console.error);
