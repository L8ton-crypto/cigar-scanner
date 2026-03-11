import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureDb } from '@/lib/db';

// Create a new price alert
export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    const body = await request.json();
    const { product_id, email, target_price } = body;

    if (!product_id || !email || !target_price) {
      return NextResponse.json(
        { error: 'product_id, email, and target_price are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate target_price is a positive number
    const price = parseFloat(target_price);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Target price must be a positive number' }, { status: 400 });
    }

    const sql = getDb();

    // Check product exists
    const products = await sql`SELECT id, name, brand, min_price FROM cs_products WHERE id = ${product_id}`;
    if (products.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check for duplicate active alert (same product + email)
    const existing = await sql`
      SELECT id FROM cs_alerts 
      WHERE product_id = ${product_id} AND email = ${email.toLowerCase()} AND active = true
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active alert for this cigar' },
        { status: 409 }
      );
    }

    // Create the alert
    const result = await sql`
      INSERT INTO cs_alerts (product_id, email, target_price)
      VALUES (${product_id}, ${email.toLowerCase()}, ${price})
      RETURNING id, product_id, email, target_price, active, created_at
    `;

    return NextResponse.json({
      alert: result[0],
      product: products[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create alert', detail: msg }, { status: 500 });
  }
}

// Get alerts for an email address
export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    const sql = getDb();

    const alerts = await sql`
      SELECT 
        a.id, a.product_id, a.email, a.target_price, a.active, 
        a.created_at, a.triggered_at,
        p.name as product_name, p.brand as product_brand, 
        p.min_price as current_price, p.image_url as product_image
      FROM cs_alerts a
      JOIN cs_products p ON a.product_id = p.id
      WHERE a.email = ${email.toLowerCase()}
      ORDER BY a.active DESC, a.created_at DESC
    `;

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch alerts', detail: msg }, { status: 500 });
  }
}
