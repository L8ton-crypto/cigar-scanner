/**
 * Retailer Trust Indicators (Trustpilot scores)
 *
 * Static configuration of trust data for each retailer. Scores are sourced from
 * publicly visible Trustpilot profiles and should be reverified periodically.
 * To update, visit the trustpilotUrl, read the current TrustScore and review count,
 * and bump `lastVerified`.
 *
 * Retailers are matched by `retailer` string as stored in cs_prices.
 */

export interface RetailerTrust {
  /** Retailer name as stored in cs_prices.retailer */
  retailer: string;
  /** Public Trustpilot profile URL, used for the "See reviews" link */
  trustpilotUrl: string;
  /** TrustScore out of 5. Null if not yet verified on Trustpilot. */
  trustScore: number | null;
  /** Total review count from Trustpilot profile. Null if unknown. */
  reviewCount: number | null;
  /** ISO date of last manual verification (YYYY-MM-DD) */
  lastVerified: string;
  /** Short positioning blurb shown on the /retailers page */
  blurb: string;
  /** Years trading / notable trust signal shown on the /retailers page */
  established?: string;
}

// Last full review pass: 2026-04-19
const retailerTrust: RetailerTrust[] = [
  {
    retailer: 'C.Gars',
    trustpilotUrl: 'https://uk.trustpilot.com/review/cgarsltd.co.uk',
    trustScore: 4.8,
    reviewCount: 10500,
    lastVerified: '2026-04-19',
    blurb: 'The UK\'s largest online cigar retailer. Wide range, fast dispatch, long track record.',
    established: '1997'
  },
  {
    retailer: 'Turmeaus',
    trustpilotUrl: 'https://uk.trustpilot.com/review/turmeauscigars.co.uk',
    trustScore: 4.8,
    reviewCount: 2800,
    lastVerified: '2026-04-19',
    blurb: 'Heritage tobacconist (est. 1817) with bricks-and-mortar stores across the north west.',
    established: '1817'
  },
  {
    retailer: 'Sautter',
    trustpilotUrl: 'https://uk.trustpilot.com/review/sautter.co.uk',
    trustScore: 4.7,
    reviewCount: 420,
    lastVerified: '2026-04-19',
    blurb: 'Premium Mayfair tobacconist specialising in Cuban cigars and bespoke humidors.',
    established: '2005'
  },
  {
    retailer: 'House of Cigars',
    trustpilotUrl: 'https://uk.trustpilot.com/review/houseofcigars.co.uk',
    trustScore: 4.6,
    reviewCount: 310,
    lastVerified: '2026-04-19',
    blurb: 'Independent UK retailer with a curated range of Cuban and new-world cigars.'
  },
  {
    retailer: 'Rebellion Cigars',
    trustpilotUrl: 'https://uk.trustpilot.com/review/rebellioncigars.co.uk',
    trustScore: 4.7,
    reviewCount: 180,
    lastVerified: '2026-04-19',
    blurb: 'Boutique online shop focused on new-world and limited release cigars.'
  },
  {
    retailer: 'Smoke King',
    trustpilotUrl: 'https://uk.trustpilot.com/review/smokeking.co.uk',
    trustScore: 4.6,
    reviewCount: 950,
    lastVerified: '2026-04-19',
    blurb: 'Long-running UK tobacconist with broad stock across cigars, pipes and accessories.'
  },
  {
    retailer: 'GQ Tobaccos',
    trustpilotUrl: 'https://uk.trustpilot.com/review/gqtobaccos.com',
    trustScore: 4.8,
    reviewCount: 1100,
    lastVerified: '2026-04-19',
    blurb: 'Specialist cigar and pipe tobacco retailer with a reputation for attentive service.'
  }
];

export function getRetailerTrust(retailer: string): RetailerTrust | null {
  if (!retailer) return null;
  const target = retailer.trim().toLowerCase();
  return retailerTrust.find(r => r.retailer.toLowerCase() === target) ?? null;
}

export function getAllRetailerTrust(): RetailerTrust[] {
  return retailerTrust;
}

/**
 * Map a numeric TrustScore to a qualitative band, used for colour coding.
 *   >= 4.5 => 'excellent'
 *   >= 4.0 => 'good'
 *   >= 3.5 => 'fair'
 *   <  3.5 => 'poor'
 *   null   => 'unknown'
 */
export type TrustBand = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export function getTrustBand(score: number | null): TrustBand {
  if (score == null) return 'unknown';
  if (score >= 4.5) return 'excellent';
  if (score >= 4.0) return 'good';
  if (score >= 3.5) return 'fair';
  return 'poor';
}
