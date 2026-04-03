import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sql, ensureDb } from '@/lib/db';
import { ScrapingStats } from '@/lib/scrapers/index';
import { compareAndUpdate, recalcProductAggregates } from '@/lib/refresh-engine';

// Import all scrapers
import { scrapeGQ } from '@/lib/scrapers/gq';
import { scrapeHouseOfCigars } from '@/lib/scrapers/house-of-cigars';
import { scrapeSautter } from '@/lib/scrapers/sautter';
import { scrapeRebellion } from '@/lib/scrapers/rebellion';
import { scrapeTurmeaus } from '@/lib/scrapers/turmeaus';
import { scrapeSmokingKing } from '@/lib/scrapers/smoke-king';

// Set max duration to 5 minutes for long-running scrapers
export const maxDuration = 300;

const RETAILERS = {
  'gq': { name: 'GQ Tobaccos', scrape: scrapeGQ },
  'house-of-cigars': { name: 'House of Cigars', scrape: scrapeHouseOfCigars },
  'sautter': { name: 'Sautter', scrape: scrapeSautter },
  'rebellion': { name: 'Rebellion', scrape: scrapeRebellion },
  'turmeaus': { name: 'Turmeaus', scrape: scrapeTurmeaus },
  'smoke-king': { name: 'Smoke King', scrape: scrapeSmokingKing },
};

async function refreshRetailer(
  key: string, 
  retailer: { name: string; scrape: () => Promise<any[]> },
  runId: string,
  dryRun = false
) {
  const startTime = Date.now();
  const stats: ScrapingStats = { 
    productsScraped: 0, 
    productsVerified: 0, 
    pricesUpdated: 0, 
    potentialRemovals: 0, 
    errors: [] 
  };
  
  // Log start
  let logId: number | null = null;
  if (!dryRun) {
    try {
      await ensureDb();
      const rows = await sql`
        INSERT INTO cs_scrape_log (run_id, retailer, status)
        VALUES (${runId}, ${retailer.name}, 'running')
        RETURNING id
      `;
      logId = rows[0].id as number;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      stats.errors.push(`Log start error: ${errorMessage}`);
    }
  }
  
  try {
    const products = await retailer.scrape();
    stats.productsScraped = products.length;
    
    if (products.length === 0) {
      stats.errors.push('No products scraped - possible site issue');
    } else {
      await compareAndUpdate(retailer.name, products, stats, dryRun);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    stats.errors.push(errorMessage);
  }
  
  const duration = Date.now() - startTime;
  
  // Log completion
  if (!dryRun && logId) {
    try {
      await sql`
        UPDATE cs_scrape_log SET
          completed_at = NOW(),
          status = ${stats.errors.length > 0 ? 'error' : 'success'},
          products_scraped = ${stats.productsScraped},
          prices_updated = ${stats.pricesUpdated},
          prices_removed = ${stats.potentialRemovals},
          errors = ${stats.errors.length > 0 ? stats.errors : null},
          duration_ms = ${duration}
        WHERE id = ${logId}
      `;
    } catch (e) {
      // Log error but don't fail the whole operation
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error('Error updating scrape log:', errorMessage);
    }
  }
  
  return { retailer: retailer.name, ...stats, duration };
}

export async function GET(request: NextRequest) {
  try {
    // Auth check - Vercel crons send Authorization: Bearer <CRON_SECRET>
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const retailerParam = searchParams.get('retailer') || 'all';
    const dryRun = searchParams.get('dry-run') === 'true';
    
    const runId = `refresh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const startTime = Date.now();
    const results: any[] = [];
    
    if (retailerParam === 'all') {
      // Run all retailers sequentially
      for (const [key, retailer] of Object.entries(RETAILERS)) {
        const result = await refreshRetailer(key, retailer, runId, dryRun);
        results.push(result);
      }
    } else {
      // Run single retailer
      const retailer = RETAILERS[retailerParam as keyof typeof RETAILERS];
      if (!retailer) {
        return NextResponse.json({ 
          error: `Unknown retailer: ${retailerParam}. Valid options: ${Object.keys(RETAILERS).join(', ')}, all` 
        }, { status: 400 });
      }
      
      const result = await refreshRetailer(retailerParam, retailer, runId, dryRun);
      results.push(result);
    }
    
    // Recalculate aggregates if any prices changed
    const totalUpdated = results.reduce((sum, r) => sum + r.pricesUpdated, 0);
    if (totalUpdated > 0) {
      await recalcProductAggregates(dryRun);
    }
    
    const totalDuration = Date.now() - startTime;
    const summary = {
      runId,
      retailer: retailerParam,
      dryRun,
      totalDuration,
      summary: {
        totalScraped: results.reduce((sum, r) => sum + r.productsScraped, 0),
        totalVerified: results.reduce((sum, r) => sum + r.productsVerified, 0),
        totalUpdated: results.reduce((sum, r) => sum + r.pricesUpdated, 0),
        totalRemovals: results.reduce((sum, r) => sum + r.potentialRemovals, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0)
      },
      results
    };
    
    return NextResponse.json(summary);
    
  } catch (error) {
    console.error('Error in refresh API:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage 
    }, { status: 500 });
  }
}