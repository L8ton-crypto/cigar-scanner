const https = require('https');

// Test different approaches to get past Cloudflare
const url = 'https://www.cgarsltd.co.uk/cohiba-siglo-i-cigar-1-single-p.asp';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  }
};

https.get(url, options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('First 500 chars:', data.substring(0, 500));
    // Check for product image
    const imgMatch = data.match(/og:image[^>]*content="([^"]+)"/);
    if (imgMatch) console.log('\nOG Image:', imgMatch[1]);
    const prodImg = data.match(/class="[^"]*product[^"]*img[^"]*"[\s\S]*?src="([^"]+)"/i);
    if (prodImg) console.log('Product image:', prodImg[1]);
  });
}).on('error', e => console.error('Error:', e.message));
