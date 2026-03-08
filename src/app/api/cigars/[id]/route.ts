import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Get the product
    const products = await sql`
      SELECT id, name, brand, description, image_url, format, strength, country,
             length_mm, ring_gauge, min_price, max_price, retailer_count
      FROM cs_products WHERE id = ${productId}
    `;

    if (products.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];

    // Get all prices for this product
    const prices = await sql`
      SELECT retailer, retailer_url, price, original_price, currency, available, url, source_name
      FROM cs_prices 
      WHERE product_id = ${productId}
      ORDER BY price ASC
    `;

    // Get related products (same brand)
    const related = await sql`
      SELECT id, name, brand, image_url, min_price, strength, format, retailer_count
      FROM cs_products 
      WHERE brand = ${product.brand} AND id != ${productId}
      ORDER BY name
      LIMIT 6
    `;

    return NextResponse.json({
      cigar: product,
      prices,
      related
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
