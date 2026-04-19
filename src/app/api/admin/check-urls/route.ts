import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';
import { checkUrlStatus } from '@/lib/stale';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}

interface PriceRow {
  id: number;
  product_id: number;
  retailer: string;
  url: string;
  url_status: number | null;
  url_checked_at: string | null;
}

/**
 * Picks the oldest-checked prices (or never-checked) and HEAD-requests the URL.
 * Records status + timestamp. Used by a daily cron to detect 404s / dead URLs.
 *
 * Params:
 *   - retailer: optional filter (gq, sautter, rebellion, turmeaus, smoke-king, house-of-cigars, Havana House, etc.)
 *   - limit:    number of URLs to check per run (default 50, max 500)
 *   - olderThanHours: only check URLs last checked more than this many hours ago (default 24)
 *   - dryRun:   preview the URLs that would be checked without making HTTP requests
 */
async function runCheck(request: NextRequest) {
  await ensureDb();

  const url = new URL(request.url);
  const retailer = url.searchParams.get('retailer');
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || '50', 10) || 50,
    500
  );
  const olderThanHours = Math.max(
    parseInt(url.searchParams.get('olderThanHours') || '24', 10) || 24,
    1
  );
  const dryRun = url.searchParams.get('dryRun') === 'true';

  // Race guard: skip rows the scraper verified in the last hour.
  // The scraper is the stronger signal - if it found the product in a listing,
  // the URL is definitely live, so we don't want a transient 5xx from a
  // HEAD request to flip the status.
  const rows: PriceRow[] = (retailer
    ? await sql`
        SELECT id, product_id, retailer, url, url_status, url_checked_at
        FROM cs_prices
        WHERE retailer = ${retailer}
          AND url IS NOT NULL
          AND url <> ''
          AND (url_checked_at IS NULL OR url_checked_at < NOW() - (${olderThanHours} || ' hours')::interval)
          AND (last_verified IS NULL OR last_verified < NOW() - INTERVAL '1 hour')
        ORDER BY url_checked_at ASC NULLS FIRST, id ASC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, product_id, retailer, url, url_status, url_checked_at
        FROM cs_prices
        WHERE url IS NOT NULL
          AND url <> ''
          AND (url_checked_at IS NULL OR url_checked_at < NOW() - (${olderThanHours} || ' hours')::interval)
          AND (last_verified IS NULL OR last_verified < NOW() - INTERVAL '1 hour')
        ORDER BY url_checked_at ASC NULLS FIRST, id ASC
        LIMIT ${limit}
      `) as PriceRow[];

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      retailer: retailer || 'all',
      limit,
      olderThanHours,
      wouldCheck: rows.length,
      sample: rows.slice(0, 10).map(r => ({
        id: r.id,
        retailer: r.retailer,
        url: r.url,
        lastChecked: r.url_checked_at,
        lastStatus: r.url_status,
      })),
    });
  }

  const stats = {
    checked: 0,
    ok: 0,         // 2xx or 3xx
    broken: 0,     // 4xx
    server: 0,     // 5xx
    networkError: 0, // null (DNS, timeout, etc.)
    newlyStale: 0,
    newlyFresh: 0,
  };

  const brokenSample: Array<{ id: number; retailer: string; url: string; status: number | null }> = [];
  const now = new Date();

  // Process in small concurrent batches to avoid hammering any single retailer
  const BATCH = 8;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (row) => {
        const status = await checkUrlStatus(row.url);
        return { row, status };
      })
    );

    for (const { row, status } of results) {
      stats.checked++;
      const prevStale = row.url_status != null && row.url_status >= 400;

      if (status == null) {
        stats.networkError++;
        // Don't flip a previously healthy URL to stale on a single network blip.
        // Record the check time only.
        try {
          await sql`
            UPDATE cs_prices
            SET url_checked_at = ${now}
            WHERE id = ${row.id}
          `;
        } catch (e) {
          console.error('check-urls update error', e);
        }
        continue;
      }

      if (status >= 400 && status < 500) {
        stats.broken++;
      } else if (status >= 500) {
        stats.server++;
      } else {
        stats.ok++;
      }

      const newlyStale = status >= 400 && !prevStale;
      const newlyFresh = status < 400 && prevStale;
      if (newlyStale) {
        stats.newlyStale++;
        if (brokenSample.length < 20) {
          brokenSample.push({ id: row.id, retailer: row.retailer, url: row.url, status });
        }
      }
      if (newlyFresh) stats.newlyFresh++;

      try {
        await sql`
          UPDATE cs_prices
          SET url_status = ${status}, url_checked_at = ${now}
          WHERE id = ${row.id}
        `;
      } catch (e) {
        console.error('check-urls update error', e);
      }
    }
  }

  // If we just flipped prices to stale, recompute product aggregates so
  // listings stop showing inflated retailer counts / stale min prices.
  if (stats.newlyStale > 0 || stats.newlyFresh > 0) {
    try {
      const { recalcProductAggregates } = await import('@/lib/refresh-engine');
      await recalcProductAggregates(false);
    } catch (e) {
      console.error('recalc after url check failed', e);
    }
  }

  return NextResponse.json({
    retailer: retailer || 'all',
    limit,
    olderThanHours,
    ...stats,
    brokenSample,
  });
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return await runCheck(request);
  } catch (error) {
    console.error('check-urls error', error);
    return NextResponse.json({ error: 'Failed to check URLs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return await runCheck(request);
  } catch (error) {
    console.error('check-urls error', error);
    return NextResponse.json({ error: 'Failed to check URLs' }, { status: 500 });
  }
}
