import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

type SortKey = 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'retailers-desc' | 'savings-desc' | 'brand-asc';
const validSorts: SortKey[] = ['price-asc', 'price-desc', 'name-asc', 'name-desc', 'retailers-desc', 'savings-desc', 'brand-asc'];

async function fetchSorted(
  brand: string | null, strength: string | null, minPrice: number | null,
  maxPrice: number | null, searchTerm: string | null, sortKey: SortKey,
  limit: number, offset: number
) {
  switch (sortKey) {
    case 'price-asc':
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY min_price ASC NULLS LAST, name ASC LIMIT ${limit} OFFSET ${offset}`;
    case 'price-desc':
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY min_price DESC NULLS LAST, name ASC LIMIT ${limit} OFFSET ${offset}`;
    case 'name-asc':
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`;
    case 'name-desc':
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY name DESC LIMIT ${limit} OFFSET ${offset}`;
    case 'retailers-desc':
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY retailer_count DESC NULLS LAST, name ASC LIMIT ${limit} OFFSET ${offset}`;
    case 'savings-desc':
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY (COALESCE(max_price,0)-COALESCE(min_price,0)) DESC NULLS LAST, name ASC LIMIT ${limit} OFFSET ${offset}`;
    default:
      return sql`SELECT id,name,brand,image_url,format,strength,min_price,max_price,retailer_count FROM cs_products
        WHERE (${brand}::text IS NULL OR brand=${brand}) AND (${strength}::text IS NULL OR strength=${strength})
        AND (${minPrice}::numeric IS NULL OR min_price>=${minPrice}) AND (${maxPrice}::numeric IS NULL OR min_price<=${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
        ORDER BY brand ASC, name ASC LIMIT ${limit} OFFSET ${offset}`;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const strength = searchParams.get('strength');
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : null;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : null;
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'brand-asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const offset = (page - 1) * limit;
    const searchTerm = search ? `%${search}%` : null;
    const sortKey: SortKey = validSorts.includes(sort as SortKey) ? sort as SortKey : 'brand-asc';

    const countResult = await sql`
      SELECT COUNT(*) as count FROM cs_products
      WHERE (${brand}::text IS NULL OR brand = ${brand})
        AND (${strength}::text IS NULL OR strength = ${strength})
        AND (${minPrice}::numeric IS NULL OR min_price >= ${minPrice})
        AND (${maxPrice}::numeric IS NULL OR min_price <= ${maxPrice})
        AND (${searchTerm}::text IS NULL OR name ILIKE ${searchTerm} OR brand ILIKE ${searchTerm})
    `;
    const total = parseInt(countResult[0].count as string);

    const products = await fetchSorted(brand, strength, minPrice, maxPrice, searchTerm, sortKey, limit, offset);

    return NextResponse.json({
      cigars: products,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    });
  } catch (error) {
    console.error('Error fetching cigars:', error);
    return NextResponse.json({ error: 'Failed to fetch cigars' }, { status: 500 });
  }
}
