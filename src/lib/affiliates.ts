interface RetailerAffiliateConfig {
  retailer: string;
  affiliateParam?: string;  // e.g. "ref=cigarscanner123"
  utmSource?: string;       // override default utm_source
  commission?: string;      // for display, e.g. "5%"
  active: boolean;
}

// Retailer affiliate configurations
// Retailers from DB: C.Gars, Sautter, House of Cigars, Rebellion Cigars, Turmeaus, Smoke King, GQ Tobaccos
const affiliateConfigs: RetailerAffiliateConfig[] = [
  {
    retailer: 'C.Gars',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  },
  {
    retailer: 'Sautter',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  },
  {
    retailer: 'House of Cigars',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  },
  {
    retailer: 'Rebellion Cigars',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  },
  {
    retailer: 'Turmeaus',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  },
  {
    retailer: 'Smoke King',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  },
  {
    retailer: 'GQ Tobaccos',
    utmSource: 'cigarscanner',
    commission: 'TBD',
    active: true
  }
];

// Default UTM parameters for all retailers
const defaultUtmParams = {
  utm_source: 'cigarscanner',
  utm_medium: 'referral',
  utm_campaign: 'price_compare'
};

/**
 * Transform a retailer URL with affiliate/UTM parameters
 * @param retailer - Retailer name (as stored in cs_prices.retailer)
 * @param originalUrl - Original retailer URL
 * @returns Affiliate-enriched URL
 */
export function getAffiliateUrl(retailer: string, originalUrl: string): string {
  const config = affiliateConfigs.find(c => c.retailer === retailer);
  
  if (!config || !config.active) {
    // No affiliate config or inactive - still add default UTM params
    return addUtmParams(originalUrl, defaultUtmParams);
  }

  // Build parameters to add
  const params: Record<string, string> = {
    ...defaultUtmParams
  };

  // Override utm_source if specified
  if (config.utmSource) {
    params.utm_source = config.utmSource;
  }

  // Add affiliate-specific parameters
  if (config.affiliateParam) {
    const [key, value] = config.affiliateParam.split('=');
    if (key && value) {
      params[key] = value;
    }
  }

  return addUtmParams(originalUrl, params);
}

/**
 * Add UTM parameters to a URL, handling existing query params correctly
 * @param url - Original URL
 * @param params - Parameters to add
 * @returns URL with parameters appended
 */
function addUtmParams(url: string, params: Record<string, string>): string {
  try {
    const urlObj = new URL(url);
    
    // Add each parameter
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });

    return urlObj.toString();
  } catch (error) {
    // Fallback for malformed URLs - append parameters manually
    console.warn('Failed to parse URL for affiliate params:', url, error);
    const hasQueryParams = url.includes('?');
    const separator = hasQueryParams ? '&' : '?';
    const paramString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    return `${url}${separator}${paramString}`;
  }
}

/**
 * Get affiliate config for a retailer (for display purposes)
 * @param retailer - Retailer name
 * @returns Affiliate config or null
 */
export function getRetailerConfig(retailer: string): RetailerAffiliateConfig | null {
  return affiliateConfigs.find(c => c.retailer === retailer) || null;
}

/**
 * Get all retailer configs (for admin/stats purposes)
 * @returns All affiliate configurations
 */
export function getAllRetailerConfigs(): RetailerAffiliateConfig[] {
  return affiliateConfigs;
}

export type { RetailerAffiliateConfig };