import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';
import { STALE_DAYS } from '@/lib/stale';

export const dynamic = 'force-dynamic';

/**
 * Stale product / price report. Auth-gated because it exposes
 * specific broken URLs and per-retailer coverage counts.
 *
 * Auth:
 *   - Authorization: Bearer <CRON_SECRET>, OR
 *   - ?key=<CRON_SECRET> query param (so the /admin/stale page can pass it)
 */
function checkAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === secret) {
    return true;
  }

  const key = new URL(request.url).searchParams.get('key');
  return key === secret;
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDb();

    // Per-retailer breakdown
    const perRetailer = await sql`
      SELECT
        retailer,
        COUNT(*) AS total_prices,
        COUNT(*) FILTER (
          WHERE (last_verified IS NOT NULL AND last_verified <= NOW() - INTERVAL '30 days')
             OR (url_status IS NOT NULL AND url_status >= 400)
        ) AS stale_prices,
        COUNT(*) FILTER (WHERE url_status IS NOT NULL AND url_status >= 400) AS broken_urls,
        COUNT(*) FILTER (
          WHERE last_verified IS NOT NULL AND last_verified <= NOW() - INTERVAL '30 days'
        ) AS unverified_30d,
        COUNT(*) FILTER (WHERE url_checked_at IS NOT NULL) AS urls_checked,
        MAX(url_checked_at) AS last_url_check
      FROM cs_prices
      GROUP BY retailer
      ORDER BY retailer
    `;

    // Overall totals
    const totals = await sql`
      SELECT
        COUNT(*) AS total_prices,
        COUNT(*) FILTER (
          WHERE (last_verified IS NOT NULL AND last_verified <= NOW() - INTERVAL '30 days')
             OR (url_status IS NOT NULL AND url_status >= 400)
        ) AS stale_prices,
        COUNT(*) FILTER (WHERE url_status IS NOT NULL AND url_status >= 400) AS broken_urls,
        COUNT(*) FILTER (WHERE url_checked_at IS NULL) AS never_checked,
        MAX(url_checked_at) AS last_url_check
      FROM cs_prices
    `;

    // Products that would be hidden (no fresh prices left)
    const hiddenProducts = await sql`
      SELECT COUNT(*) AS count FROM cs_products p
      WHERE NOT EXISTS (
        SELECT 1 FROM cs_prices pr
        WHERE pr.product_id = p.id
          AND (pr.last_verified IS NULL OR pr.last_verified > NOW() - INTERVAL '30 days')
          AND (pr.url_status IS NULL OR pr.url_status < 400)
      )
    `;

    // Most recent broken URLs (sample)
    const brokenSample = await sql`
      SELECT p.id AS price_id, p.product_id, p.retailer, p.url, p.url_status, p.url_checked_at,
             pr.name AS product_name
      FROM cs_prices p
      JOIN cs_products pr ON pr.id = p.product_id
      WHERE p.url_status IS NOT NULL AND p.url_status >= 400
      ORDER BY p.url_checked_at DESC NULLS LAST
      LIMIT 25
    `;

    return NextResponse.json({
      staleDays: STALE_DAYS,
      totals: {
        totalPrices: parseInt(totals[0].total_prices as string) || 0,
        stalePrices: parseInt(totals[0].stale_prices as string) || 0,
        brokenUrls: parseInt(totals[0].broken_urls as string) || 0,
        neverChecked: parseInt(totals[0].never_checked as string) || 0,
        lastUrlCheck: totals[0].last_url_check,
        hiddenProducts: parseInt(hiddenProducts[0].count as string) || 0,
      },
      retailers: perRetailer.map((r: Record<string, unknown>) => ({
        retailer: r.retailer as string,
        totalPrices: parseInt(r.total_prices as string) || 0,
        stalePrices: parseInt(r.stale_prices as string) || 0,
        brokenUrls: parseInt(r.broken_urls as string) || 0,
        unverified30d: parseInt(r.unverified_30d as string) || 0,
        urlsChecked: parseInt(r.urls_checked as string) || 0,
        lastUrlCheck: r.last_url_check as string | null,
      })),
      brokenSample,
    });
  } catch (error) {
    console.error('stale-report error', error);
    return NextResponse.json({ error: 'Failed to fetch stale report' }, { status: 500 });
  }
}
