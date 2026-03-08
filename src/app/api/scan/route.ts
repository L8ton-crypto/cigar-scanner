import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureDb } from '@/lib/db';

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
    await ensureDb();

    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder') {
      return NextResponse.json({
        identification: {
          brand: 'Demo Brand',
          name: 'Demo Cigar',
          format: 'Robusto',
          country: 'Unknown',
          confidence: 0.8,
          description: 'AI identification is not available. Please configure OPENAI_API_KEY to enable cigar scanning.'
        },
        matches: []
      });
    }

    // Clean up image data (remove data: prefix if present)
    let imageData = image;
    if (image.startsWith('data:')) {
      imageData = image.split(',')[1];
    }

    // Call OpenAI Vision API
    const identification = await identifyCigar(imageData);

    // Find matching cigars in database
    let matches: any[] = [];
    
    if (identification.confidence > 0.3) {
      // Fuzzy search for matches
      const searchTerms: string[] = [];
      
      if (identification.brand) {
        searchTerms.push(`brand ILIKE '%${identification.brand}%'`);
      }
      
      if (identification.name) {
        const nameParts = identification.name.split(' ').filter(part => part.length > 2);
        for (const part of nameParts) {
          searchTerms.push(`name ILIKE '%${part}%'`);
        }
      }
      
      if (identification.format) {
        searchTerms.push(`format ILIKE '%${identification.format}%'`);
      }

      if (searchTerms.length > 0) {
        const whereClause = `WHERE available = true AND (${searchTerms.join(' OR ')})`;
        
        matches = await sql.query(`
          SELECT 
            id, name, brand, price, currency, image_url, format, 
            strength, url, retailer,
            CASE 
              WHEN brand ILIKE '%${identification.brand || ''}%' THEN 3
              WHEN name ILIKE '%${identification.name || ''}%' THEN 2
              WHEN format ILIKE '%${identification.format || ''}%' THEN 1
              ELSE 0
            END as relevance_score
          FROM cs_cigars
          ${whereClause}
          ORDER BY relevance_score DESC, price ASC
          LIMIT 10
        `);
      }
    }

    // Save scan to history
    await sql`
      INSERT INTO cs_scan_history (
        identified_name, identified_brand, confidence, matched_cigar_id
      ) VALUES (
        ${identification.name || null},
        ${identification.brand || null},
        ${identification.confidence},
        ${matches.length > 0 ? matches[0].id : null}
      )
    `;

    return NextResponse.json({
      identification,
      matches
    });

  } catch (error) {
    console.error('Error scanning cigar:', error);
    return NextResponse.json(
      { error: 'Failed to scan cigar' },
      { status: 500 }
    );
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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'You are a cigar expert. Identify this cigar from the image. Return JSON: { brand, name, format (e.g. Robusto, Churchill, Corona, Torpedo), country, confidence (0-1), description }. If you cannot identify it confidently, set confidence to 0. Focus on visible text on bands, wrapper color, and size.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageData}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(content);
      return {
        brand: parsed.brand || '',
        name: parsed.name || '',
        format: parsed.format || '',
        country: parsed.country || '',
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        description: parsed.description || ''
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract information from text
      return {
        confidence: 0,
        description: 'Could not parse identification result'
      };
    }

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return {
      confidence: 0,
      description: 'Failed to identify cigar'
    };
  }
}