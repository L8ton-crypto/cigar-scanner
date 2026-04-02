import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const type = searchParams.get('type') || 'all'; // all, drops, increases
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    let typeFilter = '';
    if (type === 'drops') {
      typeFilter = 'AND pc.new_price < pc.old_price';
    } else if (type === 'increases') {
      typeFilter = 'AND pc.new_price > pc.old_price';
    }

    // Get price changes with product details
    const changes = await sql`
      SELECT 
        pc.id,
        pc.product_id,
        pc.retailer,
        pc.old_price,
        pc.new_price,
        pc.change_type,
        pc.changed_at,
        p.name as product_name,
        p.brand,
        p.image_url,
        p.min_price,
        ROUND(((pc.new_price - pc.old_price) / NULLIF(pc.old_price, 0)) * 100, 1) as percent_change
      FROM cs_price_changes pc
      JOIN cs_products p ON p.id = pc.product_id
      WHERE pc.changed_at > NOW() - (${days} || ' days')::INTERVAL
      AND pc.change_type = 'price_change'
      AND pc.new_price IS NOT NULL
      AND pc.old_price IS NOT NULL
      ORDER BY ABS(pc.new_price - pc.old_price) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get summary stats
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE new_price < old_price) as drops,
        COUNT(*) FILTER (WHERE new_price > old_price) as increases,
        COUNT(*) as total,
        AVG(new_price - old_price) FILTER (WHERE new_price < old_price) as avg_drop,
        AVG(new_price - old_price) FILTER (WHERE new_price > old_price) as avg_increase
      FROM cs_price_changes
      WHERE changed_at > NOW() - (${days} || ' days')::INTERVAL
      AND change_type = 'price_change'
      AND new_price IS NOT NULL
      AND old_price IS NOT NULL
    `;

    return NextResponse.json({
      changes,
      stats: stats[0],
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching price changes:', error);
    return NextResponse.json({ error: 'Failed to fetch price changes' }, { status: 500 });
  }
}
