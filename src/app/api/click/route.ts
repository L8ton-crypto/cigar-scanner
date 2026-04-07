import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAffiliateUrl } from '@/lib/affiliates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('pid');
    const retailer = searchParams.get('retailer');
    const originalUrl = searchParams.get('url');

    // Validate required parameters
    if (!retailer || !originalUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: retailer and url' },
        { status: 400 }
      );
    }

    // Get user agent and referer from headers
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';

    // Transform URL with affiliate parameters
    const affiliateUrl = getAffiliateUrl(retailer, decodeURIComponent(originalUrl));

    // Log the click before redirecting
    try {
      await sql`
        INSERT INTO cs_clicks (product_id, retailer, url, user_agent, referer)
        VALUES (
          ${productId ? parseInt(productId) : null},
          ${retailer},
          ${originalUrl},
          ${userAgent},
          ${referer}
        )
      `;
    } catch (error) {
      console.error('Failed to log click:', error);
      // Don't block redirect on logging failure
    }

    // Redirect user to affiliate URL
    return NextResponse.redirect(affiliateUrl, 302);
    
  } catch (error) {
    console.error('Error in click redirect:', error);
    
    // Fallback: redirect to original URL if possible
    const originalUrl = new URL(request.url).searchParams.get('url');
    if (originalUrl) {
      try {
        return NextResponse.redirect(decodeURIComponent(originalUrl), 302);
      } catch (redirectError) {
        console.error('Failed fallback redirect:', redirectError);
      }
    }
    
    return NextResponse.json(
      { error: 'Click tracking failed' },
      { status: 500 }
    );
  }
}