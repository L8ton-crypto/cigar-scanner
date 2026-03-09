import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface IdentificationResult {
  brand?: string;
  name?: string;
  format?: string;
  country?: string;
  confidence: number;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        identification: {
          brand: 'Demo Brand', name: 'Demo Cigar', format: 'Robusto',
          country: 'Unknown', confidence: 0.8,
          description: 'AI identification is not available. Configure ANTHROPIC_API_KEY to enable scanning.'
        },
        matches: [],
        similar: []
      });
    }

    let imageData = image;
    if (image.startsWith('data:')) {
      imageData = image.split(',')[1];
    }

    const identification = await identifyCigar(imageData);
    let matches: any[] = [];
    let similar: any[] = [];

    if (identification.confidence > 0) {
      const brandTerm = identification.brand ? `%${identification.brand}%` : '%';
      const nameTerm = identification.name ? `%${identification.name}%` : '%';
      const exactBrand = identification.brand ? `${identification.brand}` : '';

      // Try exact + brand+name matches first
      const rawMatches = await sql`
        SELECT p.id, p.name, p.brand, p.image_url, p.format, p.strength,
               pr.price, pr.retailer, pr.url
        FROM cs_products p
        JOIN cs_prices pr ON pr.product_id = p.id
        WHERE p.brand ILIKE ${brandTerm} OR p.name ILIKE ${nameTerm}
        ORDER BY 
          CASE WHEN p.brand ILIKE ${exactBrand} AND p.name ILIKE ${nameTerm} THEN 20
               WHEN p.name ILIKE ${nameTerm} THEN 15
               WHEN p.brand ILIKE ${exactBrand} THEN 10
               ELSE 0 END DESC,
          pr.price ASC
        LIMIT 30
      `;

      // Group by product - cheapest price per product
      const grouped = rawMatches.reduce((acc: any[], match: any) => {
        const existing = acc.find((p: any) => p.id === match.id);
        if (existing) {
          if (Number(match.price) < Number(existing.price)) {
            existing.price = match.price;
            existing.retailer = match.retailer;
            existing.url = match.url;
          }
        } else {
          acc.push({ ...match });
        }
        return acc;
      }, []);

      matches = grouped.slice(0, 10);

      // If no matches found, get "similar" cigars from the same brand
      if (matches.length === 0 && identification.brand) {
        const brandSimilar = await sql`
          SELECT p.id, p.name, p.brand, p.image_url, p.format, p.strength,
                 p.min_price as price, p.retailer_count
          FROM cs_products p
          WHERE p.brand ILIKE ${brandTerm}
          AND p.min_price IS NOT NULL
          ORDER BY p.retailer_count DESC, p.min_price ASC
          LIMIT 6
        `;
        similar = brandSimilar;
      }
    }

    return NextResponse.json({ identification, matches, similar });
  } catch (error) {
    console.error('Error scanning cigar:', error);
    return NextResponse.json({ error: 'Failed to scan cigar' }, { status: 500 });
  }
}

async function identifyCigar(imageData: string): Promise<IdentificationResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageData
              }
            },
            {
              type: 'text',
              text: 'You are a cigar expert. Look at the cigar band/label in this image and identify the cigar. Return ONLY valid JSON with no other text: { "brand": "...", "name": "full cigar name including brand", "format": "size/vitola if identifiable", "country": "country of origin", "confidence": 0.0-1.0, "description": "brief tasting/identification notes" }'
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { confidence: 0 };
  } catch {
    return { confidence: 0 };
  }
}
