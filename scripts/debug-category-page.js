const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  console.log('⏳ Cloudflare...');
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const title = await page.title();
  console.log('Title:', title);
  if (title.includes('Just a moment')) {
    await page.waitForTimeout(12000);
  }

  // Try a category with lots of products
  const catUrl = 'https://www.cgarsltd.co.uk/cuban-cigars-montecristo-cigars-c-317_101_158.html';
  console.log('\nLoading Montecristo category...');
  await page.goto(catUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Scroll to load lazy content
  await page.evaluate(async () => {
    for (let i = 0; i < 10; i++) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 300));
    }
  });
  await page.waitForTimeout(2000);

  // Get ALL links and images
  const data = await page.evaluate(() => {
    const allLinks = [...document.querySelectorAll('a')].map(a => ({
      href: a.href,
      text: a.textContent.trim().slice(0, 80),
      hasImg: !!a.querySelector('img'),
      imgAlt: a.querySelector('img')?.alt || '',
      imgSrc: a.querySelector('img')?.src || '',
    })).filter(l => l.href.includes('-p-') || l.href.includes('-p.asp'));

    const allImgs = [...document.querySelectorAll('img')].map(i => ({
      alt: i.alt,
      src: i.src,
      w: i.naturalWidth,
      h: i.naturalHeight,
    })).filter(i => i.alt && i.alt.length > 5 && !i.src.includes('logo'));

    return { links: allLinks.slice(0, 30), imgs: allImgs.slice(0, 30), pageTitle: document.title };
  });

  console.log('Page title:', data.pageTitle);
  console.log(`\nProduct links (${data.links.length}):`);
  data.links.forEach(l => console.log(`  ${l.text} | img: ${l.imgAlt} | ${l.imgSrc.slice(0, 80)}`));
  
  console.log(`\nAll images with alt (${data.imgs.length}):`);
  data.imgs.forEach(i => console.log(`  [${i.w}x${i.h}] "${i.alt}" -> ${i.src.slice(0, 100)}`));

  // Check pagination
  const pagination = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')];
    return links.filter(a => /^\d+$/.test(a.textContent.trim()) || a.textContent.includes('Next') || a.textContent.includes('»'))
      .map(a => ({ text: a.textContent.trim(), href: a.href }));
  });
  console.log('\nPagination:', pagination);

  await browser.close();
})();
