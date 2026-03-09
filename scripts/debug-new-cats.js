const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Test new Montecristo URL
  console.log('Testing Montecristo (new URL)...');
  await page.goto('https://www.cgarsltd.co.uk/cuban-cigars-montecristo-cigars-c-317_44_52.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Scroll down to load all products
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log('Title:', title);

  const products = await page.evaluate(() => {
    const results = [];
    // Try product links
    const links = document.querySelectorAll('a');
    const seen = new Set();
    for (const link of links) {
      if (!link.href.includes('-p-') && !link.href.includes('-p.asp')) continue;
      const img = link.querySelector('img');
      if (!img || !img.src) continue;
      if (img.src.includes('logo') || img.src.includes('icon')) continue;
      const name = img.alt || link.textContent.trim();
      if (!name || name.length < 5 || seen.has(name)) continue;
      seen.add(name);
      results.push({ name, img: img.src.slice(0, 120) });
    }
    return results;
  });

  console.log(`Products found: ${products.length}`);
  products.slice(0, 10).forEach(p => console.log(`  ${p.name} -> ${p.img}`));

  // Check pagination
  const pages = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => a.textContent.trim() === '»' || a.textContent.includes('Next') || /^[0-9]+$/.test(a.textContent.trim()))
      .map(a => ({ text: a.textContent.trim(), href: a.href }));
  });
  console.log('\nPagination:', JSON.stringify(pages.slice(0, 5)));

  // Also try the "All Cigars" page
  console.log('\n--- Testing All Cigars ---');
  await page.goto('https://www.cgarsltd.co.uk/shop/all-cigars', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('All cigars title:', await page.title());
  
  const allCount = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    let count = 0;
    for (const link of links) {
      if ((link.href.includes('-p-') || link.href.includes('-p.asp')) && link.querySelector('img')) count++;
    }
    return count;
  });
  console.log('Products on all-cigars page:', allCount);

  await browser.close();
})();
