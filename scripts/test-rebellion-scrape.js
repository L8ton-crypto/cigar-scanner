const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
  });
}

async function test() {
  for (let page = 1; page <= 3; page++) {
    const html = await httpGet(`https://www.rebellioncigars.co.uk/search/products?keywords=&page=${page}`);
    console.log(`Page ${page}: ${html.length} bytes`);
    
    // Try the new regex pattern matching full URLs
    const regex = /item-heading"><a href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a><\/h3>[\s\S]*?<span class="price">\s*&pound;([\d,.]+)/g;
    let m;
    let count = 0;
    while ((m = regex.exec(html)) !== null) {
      if (count < 3) console.log(`  ${m[2].trim()} | £${m[3]}`);
      count++;
    }
    console.log(`  Found: ${count} products\n`);
    
    if (count === 0) break;
    await new Promise(r => setTimeout(r, 500));
  }
}

test();
