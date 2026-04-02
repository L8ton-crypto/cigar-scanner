import { NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET() {
  try {
    await ensureDb();

    // Get the latest scrape log per retailer
    const latest = await sql`
      SELECT DISTINCT ON (retailer)
        retailer,
        status,
        started_at,
        completed_at,
        products_scraped,
        prices_updated,
        prices_removed,
        duration_ms
      FROM cs_scrape_log
      ORDER BY retailer, started_at DESC
    `;

    // Get overall stats
    const totalProducts = await sql`SELECT COUNT(*) as count FROM cs_products`;
    const totalPrices = await sql`SELECT COUNT(*) as count FROM cs_prices`;
    const verifiedRecently = await sql`
      SELECT COUNT(*) as count FROM cs_prices 
      WHERE last_verified > NOW() - INTERVAL '7 days'
    `;

    // Get recent price changes (last 7 days)
    const recentChanges = await sql`
      SELECT 
        pc.retailer,
        pc.change_type,
        COUNT(*) as count,
        AVG(pc.new_price - pc.old_price) as avg_change
      FROM cs_price_changes pc
      WHERE pc.changed_at > NOW() - INTERVAL '7 days'
      AND pc.change_type = 'price_change'
      GROUP BY pc.retailer, pc.change_type
      ORDER BY pc.retailer
    `;

    // Get last successful run timestamp
    const lastRun = await sql`
      SELECT MAX(completed_at) as last_run 
      FROM cs_scrape_log 
      WHERE status = 'success'
    `;

    return NextResponse.json({
      lastRefresh: lastRun[0]?.last_run || null,
      retailers: latest,
      recentChanges,
      stats: {
        totalProducts: parseInt(totalProducts[0].count as string),
        totalPrices: parseInt(totalPrices[0].count as string),
        verifiedLast7Days: parseInt(verifiedRecently[0].count as string)
      }
    });
  } catch (error) {
    console.error('Error fetching refresh status:', error);
    return NextResponse.json({ error: 'Failed to fetch refresh status' }, { status: 500 });
  }
}
