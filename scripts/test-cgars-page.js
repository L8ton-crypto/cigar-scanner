const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);

async function test() {
  // Get a few URLs to test
  const entries = await sql`
    SELECT id, name, url FROM cs_cigars 
    WHERE retailer = 'C.Gars Ltd' AND (image_url IS NULL OR image_url = '')
    LIMIT 5
  `;

  console.log('Sample URLs to test:');
  entries.forEach(e => console.log(`  ${e.name}\n  -> ${e.url}\n`));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Pass Cloudflare
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('Cloudflare:', await page.title());

  // Test first URL
  const testUrl = entries[0].url;
  console.log('\nTesting:', testUrl);
  const resp = await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('Status:', resp.status());
  console.log('Final URL:', page.url());
  console.log('Title:', await page.title());

  // Check page content
  const html = await page.content();
  console.log('HTML length:', html.length);
  
  // Look for any images
  const images = await page.evaluate(() => {
    return [...document.querySelectorAll('img')].map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
      classes: img.className
    })).filter(img => img.src && !img.src.includes('data:'));
  });
  console.log('\nImages found:', images.length);
  images.forEach(img => console.log(`  ${img.width}x${img.height} [${img.classes}] ${img.alt || 'no alt'}\n    ${img.src}`));

  // Check OG image
  const ogImage = await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:image"]');
    return og ? og.getAttribute('content') : null;
  });
  console.log('\nOG Image:', ogImage);

  await browser.close();
}

test().catch(console.error);
