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

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
      return NextResponse.json({
        identification: {
          brand: 'Demo Brand', name: 'Demo Cigar', format: 'Robusto',
          country: 'Unknown', confidence: 0.8,
          description: 'AI identification is not available. Configure OPENAI_API_KEY to enable scanning.'
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
      const brandTerm = identification.brand ? `%${identification.brand}%` : null;
      const nameTerm = identification.name ? `%${identification.name}%` : null;

      matches = await sql`
        SELECT p.id, p.name, p.brand, p.image_url, p.format, p.strength,
               p.min_price, p.retailer_count
        FROM cs_products p
        WHERE (${brandTerm}::text IS NULL OR p.brand ILIKE ${brandTerm} OR p.name ILIKE ${brandTerm})
           OR (${nameTerm}::text IS NULL OR p.name ILIKE ${nameTerm})
        ORDER BY 
          CASE WHEN p.brand ILIKE ${brandTerm || ''} THEN 3
               WHEN p.name ILIKE ${nameTerm || ''} THEN 2
               ELSE 0 END DESC,
          p.min_price ASC
        LIMIT 10
      `;
    }

    return NextResponse.json({ identification, matches });
  } catch (error) {
    console.error('Error scanning cigar:', error);
    return NextResponse.json({ error: 'Failed to scan cigar' }, { status: 500 });
  }
}

async function identifyCigar(imageData: string): Promise<IdentificationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'You are a cigar expert. Identify this cigar. Return JSON: { brand, name, format, country, confidence (0-1), description }.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } }
          ]
        }],
        max_tokens: 500
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { confidence: 0 };
  } catch {
    return { confidence: 0 };
  }
}
