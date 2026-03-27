const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.turmeaus.co.uk/fernandez-new-world-decenio-toro-cigar-single-p-64175.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Check og:image
  const og = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => 'none');
  console.log('og:image:', og);
  
  // All img srcs
  const imgs = await page.$$eval('img', els => els.map(e => ({ src: e.src, alt: e.alt, id: e.id, cls: e.className })));
  console.log('\nAll images:');
  imgs.forEach((img, i) => console.log(`  ${i}: id="${img.id}" class="${img.cls}" src="${img.src.substring(0, 100)}" alt="${img.alt}"`));
  
  // Try zen cart patterns
  const selectors = ['#productMainImage', '.productImage img', '#productImage img', '.prodImage img', 
    '#mainProductImage', '.images_box img', '#image img', '#zen_image img', '.product_image img'];
  for (const sel of selectors) {
    const found = await page.$(sel);
    if (found) {
      const src = await found.evaluate(el => el.src || el.getAttribute('data-src'));
      console.log(`\n${sel} found: ${src}`);
    }
  }
  
  await browser.close();
})();
