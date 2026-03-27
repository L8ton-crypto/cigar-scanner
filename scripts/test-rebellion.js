const https = require('https');

function fetchPage(path, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.rebellioncigars.co.uk',
      path: path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie || '',
        'Accept': 'text/html'
      }
    };
    https.get(options, (res) => {
      let d = '';
      // Capture set-cookie headers
      console.log('Status:', res.statusCode);
      console.log('Set-Cookie:', res.headers['set-cookie']?.slice(0, 3));
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function test() {
  // First try without cookie
  console.log('=== WITHOUT COOKIE ===');
  let html = await fetchPage('/search/products?keywords=robusto&page=1', '');
  console.log('Length:', html.length);
  
  // Check for product data
  const prices = html.match(/£[\d,.]+/g);
  console.log('Prices found:', prices?.length, prices?.slice(0, 5));
  
  // Look for product links
  const links = html.match(/href="\/[^"]*cigar[^"]*"/gi);
  console.log('Cigar links:', links?.length, links?.slice(0, 3));
  
  // Look for structured data (JSON-LD, microdata)
  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  console.log('JSON-LD blocks:', jsonLd?.length);
  
  // Look for product name patterns
  const productNames = html.match(/product-name[^>]*>([^<]+)</g);
  console.log('Product names:', productNames?.slice(0, 5));
  
  // Try with age gate cookie
  console.log('\n=== WITH AGE GATE COOKIE ===');
  html = await fetchPage('/search/products?keywords=robusto&page=1', 'age_verified=true; over18=yes; agegate=passed');
  console.log('Length:', html.length);
  const prices2 = html.match(/£[\d,.]+/g);
  console.log('Prices found:', prices2?.length, prices2?.slice(0, 5));
  
  // Try a product page directly
  console.log('\n=== PRODUCT PAGE ===');
  html = await fetchPage('/fratello-cigars-oro-robusto---single-cigar', 'age_verified=true; over18=yes; agegate=passed');
  console.log('Length:', html.length);
  const prices3 = html.match(/£[\d,.]+/g);
  console.log('Prices found:', prices3?.length, prices3?.slice(0, 5));
  
  // Extract product info patterns
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  console.log('H1:', h1?.[1]?.substring(0, 100));
  
  const priceSpan = html.match(/price[^>]*>([^<]+)/gi);
  console.log('Price elements:', priceSpan?.slice(0, 5));
  
  // Check for meta tags
  const ogTitle = html.match(/og:title[^>]*content="([^"]+)"/);
  console.log('OG Title:', ogTitle?.[1]);
  const ogPrice = html.match(/product:price:amount[^>]*content="([^"]+)"/);
  console.log('OG Price:', ogPrice?.[1]);
}

test().catch(console.error);
