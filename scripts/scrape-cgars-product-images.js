const { chromium } = require('playwright');
const { neon } = require('@neondatabase/serverless');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const sql = neon(process.env.DATABASE_URL);
const START_URL = 'https://www.cgarsltd.co.uk/';
const PAGE_DELAY_MIN = 500;
const PAGE_DELAY_MAX = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return PAGE_DELAY_MIN + Math.floor(Math.random() * (PAGE_DELAY_MAX - PAGE_DELAY_MIN + 1));
}

function normalizeUrl(url) {
  if (!url) return null;
  try {
    return new URL(url, START_URL).toString();
  } catch {
    return null;
  }
}

function isLikelyProductImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (!lower.includes('cgarsltd.co.uk/images/')) return false;

  const blocked = [
    'logo',
    'icon',
    'banner',
    'placeholder',
    'sprite',
    'loading',
    'facebook',
    'twitter',
    'instagram',
    'payment',
    'trustpilot',
    'pixel',
  ];

  return !blocked.some((term) => lower.includes(term));
}

function scoreProductUrl(url) {
  const lower = (url || '').toLowerCase();
  let score = 0;

  if (lower.includes('-p.asp')) score += 50;
  if (lower.includes('-p-')) score += 20;
  if (lower.includes('/cigar-')) score += 5;
  if (lower.includes('single')) score -= 10;
  if (lower.includes('box-of')) score -= 5;
  if (lower.includes('bundle-of')) score -= 5;
  if (lower.includes('cabinet-of')) score -= 5;
  if (lower.includes('pack-of')) score -= 5;
  if (lower.includes('sampler')) score -= 3;

  return score;
}

async function getMissingProducts() {
  const rows = await sql`
    SELECT p.id, p.name, p.brand, pr.url
    FROM cs_products p
    JOIN cs_prices pr ON pr.product_id = p.id
    WHERE p.image_url IS NULL
      AND pr.retailer = 'C.Gars Ltd'
      AND pr.url IS NOT NULL
    ORDER BY p.id, pr.url
  `;

  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        brand: row.brand,
        urls: [],
      });
    }

    const product = grouped.get(row.id);
    if (!product.urls.includes(row.url)) {
      product.urls.push(row.url);
    }
  }

  return Array.from(grouped.values()).map((product) => ({
    ...product,
    urls: product.urls.sort((a, b) => scoreProductUrl(b) - scoreProductUrl(a)),
  }));
}

async function countRemainingMissing() {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM cs_products
    WHERE image_url IS NULL
  `;
  return rows[0].count;
}

async function passCloudflare(headless) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 1100 },
    locale: 'en-GB',
  });

  const page = await context.newPage();
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(headless ? 10000 : 12000);

  const title = await page.title();
  const content = await page.content();
  const blocked = /just a moment|attention required|cf-browser-verification|cloudflare/i.test(`${title}\n${content}`);

  if (blocked) {
    await browser.close();
    return null;
  }

  return { browser, page };
}

async function extractBestImage(page, productUrl) {
  const response = await page.goto(productUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });

  if (!response || !response.ok()) {
    throw new Error(`HTTP ${response ? response.status() : 'no-response'}`);
  }

  await page.waitForTimeout(1200);

  const result = await page.evaluate(() => {
    const candidates = [];
    const seen = new Set();

    function pushCandidate(url, meta = {}) {
      if (!url || seen.has(url)) return;
      seen.add(url);
      const width = Number(meta.width || 0);
      const height = Number(meta.height || 0);
      const area = width * height;
      candidates.push({
        url,
        width,
        height,
        area,
        alt: meta.alt || '',
        className: meta.className || '',
        id: meta.id || '',
        source: meta.source || 'img',
      });
    }

    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    pushCandidate(ogImage, { source: 'og:image', width: 1000, height: 1000 });

    for (const img of document.querySelectorAll('img')) {
      const rect = img.getBoundingClientRect();
      const width = img.naturalWidth || rect.width || img.width || 0;
      const height = img.naturalHeight || rect.height || img.height || 0;
      const src = img.currentSrc || img.src;
      pushCandidate(src, {
        width,
        height,
        alt: img.alt || '',
        className: typeof img.className === 'string' ? img.className : '',
        id: img.id || '',
        source: 'img',
      });
    }

    return candidates;
  });

  const filtered = result
    .map((candidate) => ({ ...candidate, url: normalizeUrl(candidate.url) }))
    .filter((candidate) => isLikelyProductImage(candidate.url))
    .filter((candidate) => candidate.width >= 120 || candidate.height >= 120 || candidate.area >= 25000)
    .sort((a, b) => {
      const aScore = (a.area || 0) + (a.source === 'og:image' ? 500000 : 0);
      const bScore = (b.area || 0) + (b.source === 'og:image' ? 500000 : 0);
      return bScore - aScore;
    });

  return filtered[0]?.url || null;
}

async function findImageForProduct(page, product) {
  const errors = [];

  for (const url of product.urls) {
    try {
      const imageUrl = await extractBestImage(page, url);
      if (imageUrl) {
        return { imageUrl, sourceUrl: url };
      }
      errors.push(`No image found: ${url}`);
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
    }
  }

  return { imageUrl: null, errors };
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing in .env.local');
  }

  const products = await getMissingProducts();
  console.log(`Found ${products.length} unique products missing images with at least one CGars URL.`);

  let session = await passCloudflare(true);
  if (!session) {
    console.log('Headless Cloudflare pass failed, retrying with headed browser...');
    session = await passCloudflare(false);
  }

  if (!session) {
    throw new Error('Could not pass Cloudflare challenge.');
  }

  const { browser, page } = session;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];

      try {
        const result = await findImageForProduct(page, product);

        if (!result.imageUrl) {
          failed += 1;
          console.error(`[${index + 1}/${products.length}] No image for ${product.id} - ${product.brand} ${product.name}`);
          for (const error of result.errors.slice(0, 3)) {
            console.error(`  ${error}`);
          }
          if (result.errors.length > 3) {
            console.error(`  ...and ${result.errors.length - 3} more URL attempts`);
          }
        } else {
          const dbResult = await sql`
            UPDATE cs_products
            SET image_url = ${result.imageUrl}
            WHERE id = ${product.id}
              AND image_url IS NULL
          `;

          if (dbResult.count > 0) {
            updated += 1;
          } else {
            skipped += 1;
          }
        }
      } catch (error) {
        failed += 1;
        console.error(`[${index + 1}/${products.length}] Failed for ${product.id} - ${product.brand} ${product.name}`);
        console.error(`  Error: ${error.message}`);
      }

      if ((index + 1) % 50 === 0) {
        console.log(`Progress ${index + 1}/${products.length} - updated: ${updated}, skipped: ${skipped}, failed: ${failed}`);
      }

      await sleep(randomDelay());
    }
  } finally {
    await browser.close();
  }

  const remainingMissing = await countRemainingMissing();

  console.log('Done.');
  console.log(`Total updated: ${updated}`);
  console.log(`Total skipped: ${skipped}`);
  console.log(`Total failed: ${failed}`);
  console.log(`Remaining missing: ${remainingMissing}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
