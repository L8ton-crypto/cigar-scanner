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
        matches: []
      });
    }

    let imageData = image;
    if (image.startsWith('data:')) {
      imageData = image.split(',')[1];
    }

    const identification = await identifyCigar(imageData);
    let matches: any[] = [];

    if (identification.confidence > 0) {
      const brandTerm = identification.brand ? `%${identification.brand}%` : '%';
      const nameTerm = identification.name ? `%${identification.name}%` : '%';
      const exactBrand = identification.brand ? `${identification.brand}` : '';

      matches = await sql`
        SELECT p.id, p.name, p.brand, p.image_url, p.format, p.strength,
               pr.price, pr.retailer, pr.url
        FROM cs_products p
        JOIN cs_prices pr ON pr.product_id = p.id
        WHERE p.brand ILIKE ${brandTerm} OR p.name ILIKE ${nameTerm}
        ORDER BY 
          CASE WHEN p.brand ILIKE ${exactBrand} THEN 10 ELSE 0 END +
          CASE WHEN p.name ILIKE ${nameTerm} THEN 5 ELSE 0 END DESC,
          pr.price ASC
        LIMIT 20
      `;

      // Group by product and show best (cheapest) price per retailer
      const groupedMatches = matches.reduce((acc: any[], match: any) => {
        const existingProduct = acc.find(p => p.id === match.id);
        if (existingProduct) {
          if (match.price < existingProduct.price) {
            existingProduct.price = match.price;
            existingProduct.retailer = match.retailer;
            existingProduct.url = match.url;
          }
        } else {
          acc.push(match);
        }
        return acc;
      }, []);

      matches = groupedMatches.slice(0, 10);
    }

    return NextResponse.json({ identification, matches });
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
              text: 'You are a cigar expert. Look at the cigar band/label in this image and identify the cigar. Return ONLY valid JSON with no other text: { "brand": "...", "name": "full cigar name", "format": "size/vitola if identifiable", "country": "country of origin", "confidence": 0.0-1.0, "description": "brief tasting/identification notes" }'
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
