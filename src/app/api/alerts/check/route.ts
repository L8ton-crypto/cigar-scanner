import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureDb } from '@/lib/db';

// Cron endpoint to check all active alerts against current prices
// Can be called by Vercel Cron or external scheduler
export async function POST(request: NextRequest) {
  try {
    // Simple API key auth for cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDb();
    const sql = getDb();

    // Find all active alerts where current price is at or below target
    const triggeredAlerts = await sql`
      SELECT 
        a.id as alert_id, a.email, a.target_price, a.product_id,
        p.name as product_name, p.brand as product_brand, p.min_price
      FROM cs_alerts a
      JOIN cs_products p ON a.product_id = p.id
      WHERE a.active = true AND p.min_price <= a.target_price
    `;

    if (triggeredAlerts.length === 0) {
      return NextResponse.json({ 
        message: 'No alerts triggered', 
        checked: 0, 
        triggered: 0 
      });
    }

    // Mark triggered alerts
    const triggeredIds = triggeredAlerts.map(a => a.alert_id);
    await sql`
      UPDATE cs_alerts 
      SET active = false, triggered_at = NOW()
      WHERE id = ANY(${triggeredIds})
    `;

    // In future: send emails via Resend here
    // For now, alerts are marked as triggered and visible in /alerts page

    return NextResponse.json({
      message: `${triggeredAlerts.length} alert(s) triggered`,
      checked: triggeredAlerts.length,
      triggered: triggeredAlerts.length,
      alerts: triggeredAlerts.map(a => ({
        id: a.alert_id,
        email: a.email,
        product: `${a.product_brand} ${a.product_name}`,
        targetPrice: a.target_price,
        currentPrice: a.min_price
      }))
    });
  } catch (error) {
    console.error('Error checking alerts:', error);
    return NextResponse.json({ error: 'Failed to check alerts' }, { status: 500 });
  }
}

// Also support GET for Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request);
}
