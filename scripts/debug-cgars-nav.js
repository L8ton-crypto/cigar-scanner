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

  // Find all nav links to category pages
  const navLinks = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')];
    return links
      .filter(a => a.href.includes('cgarsltd.co.uk') && (a.href.includes('/c-') || a.href.includes('cigars')))
      .map(a => ({ text: a.textContent.trim(), href: a.href }))
      .filter(l => l.text.length > 2 && l.text.length < 60)
      .slice(0, 60);
  });

  console.log('Nav category links:');
  navLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Also try searching
  console.log('\n--- Testing search ---');
  await page.goto('https://www.cgarsltd.co.uk/search.php?search=montecristo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const searchTitle = await page.title();
  console.log('Search title:', searchTitle);
  
  const searchResults = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')];
    return links
      .filter(a => (a.href.includes('-p-') || a.href.includes('-p.asp')) && a.querySelector('img'))
      .map(a => ({
        text: a.querySelector('img')?.alt || a.textContent.trim().slice(0, 60),
        img: a.querySelector('img')?.src || '',
        href: a.href,
      }))
      .slice(0, 10);
  });
  console.log(`Search results (${searchResults.length}):`);
  searchResults.forEach(r => console.log(`  ${r.text} -> ${r.img.slice(0, 80)}`));

  // Try their actual product listing page
  console.log('\n--- Testing product listing ---');
  await page.goto('https://www.cgarsltd.co.uk/cuban-cigars-c-317_101.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const listTitle = await page.title();
  console.log('List title:', listTitle);

  // Try .asp URL format
  await page.goto('https://www.cgarsltd.co.uk/montecristo-c-317_101_158.asp', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('ASP title:', await page.title());

  // Check current URL structure by following links on homepage
  const homepageLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .map(a => ({ text: a.textContent.trim().slice(0, 40), href: a.href }))
      .filter(l => l.href.includes('cgarsltd') && !l.href.includes('design') && l.text.length > 2)
      .slice(0, 40);
  });
  
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  const hp = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .map(a => ({ text: a.textContent.trim().slice(0, 50), href: a.href }))
      .filter(l => l.href.includes('cgarsltd') && l.text.length > 2 && !l.href.includes('#'))
      .reduce((acc, l) => { if (!acc.find(x => x.href === l.href)) acc.push(l); return acc; }, [])
      .slice(0, 50);
  });
  console.log('\nHomepage unique links:');
  hp.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  await browser.close();
})();
