/**
 * Shared types and helpers for all scrapers
 */

export interface ScrapedProduct {
  name: string;
  price: number;
  url: string;
  retailer: string;
  retailerUrl: string;
}

export interface ScrapingStats {
  productsScraped: number;
  productsVerified: number;
  pricesUpdated: number;
  potentialRemovals: number;
  errors: string[];
}

/**
 * Normalize product names for comparison (exactly as in CLI script)
 */
export function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*[–—-]\s*(1 single|single|pack of \d+|box of \d+|tin of \d+|cab(inet)? of \d+|bundle of \d+|twist of \d+|\d+ cigars?).*$/i, '')
    .replace(/\s*[–—-]\s*(single cigar|box of \d+ cigars?|pack of \d+ cigars?)$/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+cuban\s+/gi, ' ')
    .replace(/\s+cigars?\b/gi, '')
    .replace(/\s+tubed\b/gi, '')
    .replace(/\s*[–—-]\s*/g, ' ')
    .replace(/\s*c\.?gars?\s*(exclusive|featured brand)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode HTML entities (exactly as in CLI script)
 */
export function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '-').replace(/&mdash;/g, '-').replace(/&pound;/g, '£');
}

/**
 * Check if a product name indicates a cigar (exactly as in CLI script)
 */
export function isCigar(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes('pipe tobacco') || lower.includes('rolling tobacco')) return false;
  if (lower.includes('whisky') || lower.includes('whiskey') || lower.includes('bourbon') || 
      lower.includes('rum ') || lower.includes('gin ') || lower.includes('vodka') ||
      lower.includes('brandy') || lower.includes('cognac') || lower.includes('wine')) return false;
  if (lower.includes('hip flask') || lower.includes('cufflink') || lower.includes('keyring') ||
      lower.includes('decanter') || lower.includes('glass set') || lower.includes('tumbler')) return false;
  if (lower.match(/\bpipe\b/) && !lower.includes('cigar')) return false;
  if (lower.includes('snuff') || lower.includes('chewing tobacco')) return false;
  if (lower.includes('cigar') || lower.includes('corona') || lower.includes('robusto') ||
      lower.includes('churchill') || lower.includes('torpedo') || lower.includes('toro') ||
      lower.includes('lancero') || lower.includes('belicoso') || lower.includes('lonsdale') ||
      lower.includes('habano') || lower.includes('maduro') || lower.includes('connecticut') ||
      lower.includes('sampler') || lower.includes('humidor')) return true;
  return false;
}

/**
 * Sleep function for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HTTP fetch wrapper with timeout and error handling
 */
export async function httpFetch(url: string, options?: RequestInit): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options?.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.text();
  } catch (error) {
    return null;
  }
}

/**
 * JSON fetch wrapper
 */
export async function httpFetchJson(url: string, options?: RequestInit): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        ...options?.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    return null;
  }
}