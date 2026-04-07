import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface ClickStats {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
  clicksByRetailer: { retailer: string; clicks: number; percentage: number }[];
  topProducts: { 
    product_id: number; 
    product_name: string; 
    brand: string; 
    clicks: number; 
  }[];
  dailyClicks: { date: string; clicks: number }[];
}

export async function GET(request: NextRequest) {
  try {
    // Total clicks
    const totalClicksResult = await sql`
      SELECT COUNT(*) as count FROM cs_clicks
    `;
    const totalClicks = Number(totalClicksResult[0].count);

    // Clicks last 7 days
    const clicks7DaysResult = await sql`
      SELECT COUNT(*) as count FROM cs_clicks 
      WHERE clicked_at >= NOW() - INTERVAL '7 days'
    `;
    const clicksLast7Days = Number(clicks7DaysResult[0].count);

    // Clicks last 30 days
    const clicks30DaysResult = await sql`
      SELECT COUNT(*) as count FROM cs_clicks 
      WHERE clicked_at >= NOW() - INTERVAL '30 days'
    `;
    const clicksLast30Days = Number(clicks30DaysResult[0].count);

    // Clicks by retailer
    const retailerClicksResult = await sql`
      SELECT retailer, COUNT(*) as clicks
      FROM cs_clicks 
      GROUP BY retailer 
      ORDER BY clicks DESC
    `;
    
    const clicksByRetailer = retailerClicksResult.map(row => ({
      retailer: row.retailer,
      clicks: Number(row.clicks),
      percentage: totalClicks > 0 ? Number((Number(row.clicks) / totalClicks * 100).toFixed(1)) : 0
    }));

    // Top 10 most-clicked products
    const topProductsResult = await sql`
      SELECT 
        c.product_id,
        p.name as product_name,
        p.brand,
        COUNT(*) as clicks
      FROM cs_clicks c
      LEFT JOIN cs_products p ON c.product_id = p.id
      WHERE c.product_id IS NOT NULL
      GROUP BY c.product_id, p.name, p.brand
      ORDER BY clicks DESC
      LIMIT 10
    `;

    const topProducts = topProductsResult.map(row => ({
      product_id: Number(row.product_id),
      product_name: row.product_name || 'Unknown Product',
      brand: row.brand || 'Unknown Brand',
      clicks: Number(row.clicks)
    }));

    // Daily clicks for last 30 days
    const dailyClicksResult = await sql`
      SELECT 
        DATE(clicked_at) as date,
        COUNT(*) as clicks
      FROM cs_clicks
      WHERE clicked_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(clicked_at)
      ORDER BY date DESC
    `;

    const dailyClicks = dailyClicksResult.map(row => ({
      date: row.date,
      clicks: Number(row.clicks)
    }));

    const stats: ClickStats = {
      totalClicks,
      clicksLast7Days,
      clicksLast30Days,
      clicksByRetailer,
      topProducts,
      dailyClicks
    };

    return NextResponse.json(stats);
    
  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate stats' },
      { status: 500 }
    );
  }
}