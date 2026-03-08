const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // Get all nav links that mention cigars/brands
  const navLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => a.href && (
        a.href.includes('cigar') || 
        a.href.includes('cohiba') || 
        a.href.includes('montecristo') ||
        a.href.includes('cuban')
      ))
      .map(a => ({ text: a.textContent.trim().substring(0, 60), href: a.href }))
      .filter(a => a.text.length > 0);
  });

  console.log('Navigation links with cigars/brands:');
  // Dedupe
  const seen = new Set();
  navLinks.forEach(l => {
    const key = l.href;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  ${l.text} -> ${l.href}`);
    }
  });

  await browser.close();
}

debug().catch(console.error);
