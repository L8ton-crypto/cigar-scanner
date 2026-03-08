const { chromium } = require('playwright');

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Pass Cloudflare
  await page.goto('https://www.cgarsltd.co.uk/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  console.log('Home title:', await page.title());

  // Try a category page
  await page.goto('https://www.cgarsltd.co.uk/cuban-cigars/cohiba-cigars/', { 
    waitUntil: 'domcontentloaded', timeout: 15000 
  });
  await page.waitForTimeout(2000);
  console.log('\nCategory title:', await page.title());
  console.log('URL:', page.url());

  // Dump page structure
  const info = await page.evaluate(() => {
    const body = document.body;
    // Find all links that might be products
    const links = [...document.querySelectorAll('a')].filter(a => 
      a.href && a.href.includes('-p.asp')
    );
    
    // Find all images with interesting alts
    const images = [...document.querySelectorAll('img')].filter(img => 
      img.src && img.naturalWidth > 50 && !img.src.includes('logo') && !img.src.includes('icon')
    );
    
    return {
      linksCount: links.length,
      links: links.slice(0, 5).map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 80) })),
      imagesCount: images.length,
      images: images.slice(0, 10).map(img => ({ 
        src: img.src, 
        alt: img.alt, 
        w: img.naturalWidth,
        h: img.naturalHeight,
        parent: img.parentElement?.tagName + '.' + img.parentElement?.className?.substring(0, 50)
      })),
      // Find any product-related classes
      productClasses: [...new Set(
        [...document.querySelectorAll('[class*="product"], [class*="item"], [class*="grid"], [class*="card"]')]
        .map(el => el.tagName + '.' + el.className.substring(0, 80))
      )].slice(0, 20),
      bodyClasses: body.className,
      mainContent: document.querySelector('main, #content, .content, .main')?.innerHTML?.substring(0, 1000) || 'no main content found',
    };
  });

  console.log('\nProduct links:', info.linksCount);
  info.links.forEach(l => console.log(`  ${l.text} -> ${l.href}`));
  
  console.log('\nImages:', info.imagesCount);
  info.images.forEach(img => console.log(`  ${img.w}x${img.h} [${img.parent}] alt="${img.alt}" -> ${img.src.substring(0, 100)}`));
  
  console.log('\nProduct-related classes:');
  info.productClasses.forEach(c => console.log(`  ${c}`));

  console.log('\nMain content preview:', info.mainContent.substring(0, 500));

  await browser.close();
}

debug().catch(console.error);
