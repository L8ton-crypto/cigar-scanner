/**
 * Cigar dimension extraction and price-per-inch calculation.
 *
 * Extracts length_mm and ring_gauge from product names and descriptions using
 * a combination of:
 *  1. Direct pattern matching (e.g., "5 x 50", "127mm x 50", "Length: 5 inch")
 *  2. Vitola name lookup (Robusto, Churchill, Toro, etc.)
 *
 * Also provides a helper to parse pack counts from names so we can compute
 * price-per-inch on a per-stick basis.
 */

export interface ParsedDimensions {
  length_mm: number | null;
  ring_gauge: number | null;
  vitola: string | null;
  source: 'explicit' | 'vitola' | 'description' | null;
}

export interface PackInfo {
  count: number;
  kind: 'single' | 'pack' | 'box' | 'tin' | 'bundle' | 'cabinet' | 'twist' | 'tub' | 'unknown';
}

const INCH_TO_MM = 25.4;

/**
 * Standard vitola dimensions. Sourced from common industry conventions
 * (Cuban and New World vitolas). Values are approximate midpoints used when
 * a product only names the vitola without giving exact dimensions.
 */
export const VITOLA_DIMENSIONS: Record<string, { length_mm: number; ring_gauge: number }> = {
  // Cuban/traditional vitolas
  'demi tasse': { length_mm: 100, ring_gauge: 30 },
  'entreacto': { length_mm: 100, ring_gauge: 30 },
  'chico': { length_mm: 106, ring_gauge: 29 },
  'perla': { length_mm: 102, ring_gauge: 40 },
  'minuto': { length_mm: 110, ring_gauge: 42 },
  'half corona': { length_mm: 89, ring_gauge: 40 },
  'petit corona': { length_mm: 129, ring_gauge: 42 },
  'petit robusto': { length_mm: 102, ring_gauge: 50 },
  'short robusto': { length_mm: 110, ring_gauge: 50 },
  'robusto': { length_mm: 127, ring_gauge: 50 },
  'corona': { length_mm: 142, ring_gauge: 42 },
  'corona gorda': { length_mm: 143, ring_gauge: 46 },
  'lonsdale': { length_mm: 165, ring_gauge: 42 },
  'cervantes': { length_mm: 165, ring_gauge: 42 },
  'panetela': { length_mm: 178, ring_gauge: 34 },
  'panatela': { length_mm: 178, ring_gauge: 34 },
  'laguito no 1': { length_mm: 192, ring_gauge: 38 },
  'laguito no 2': { length_mm: 152, ring_gauge: 38 },
  'laguito no 3': { length_mm: 115, ring_gauge: 26 },
  'dalia': { length_mm: 170, ring_gauge: 43 },
  'hermoso no 4': { length_mm: 127, ring_gauge: 48 },
  'hermoso no 2': { length_mm: 157, ring_gauge: 48 },
  'piramide': { length_mm: 156, ring_gauge: 52 },
  'pyramid': { length_mm: 156, ring_gauge: 52 },
  'belicoso': { length_mm: 140, ring_gauge: 50 },
  'belicoso fino': { length_mm: 140, ring_gauge: 52 },
  'torpedo': { length_mm: 152, ring_gauge: 52 },
  'campana': { length_mm: 140, ring_gauge: 52 },
  'toro': { length_mm: 152, ring_gauge: 50 },
  'churchill': { length_mm: 178, ring_gauge: 47 },
  'julieta no 2': { length_mm: 178, ring_gauge: 47 },
  'double corona': { length_mm: 194, ring_gauge: 49 },
  'prominente': { length_mm: 194, ring_gauge: 49 },
  'sublime': { length_mm: 164, ring_gauge: 54 },
  'gran corona': { length_mm: 232, ring_gauge: 47 },
  'presidente': { length_mm: 203, ring_gauge: 50 },
  'double robusto': { length_mm: 140, ring_gauge: 52 },
  'gordo': { length_mm: 152, ring_gauge: 60 },
  'gigante': { length_mm: 152, ring_gauge: 60 },
  'magnum': { length_mm: 165, ring_gauge: 54 },
  'lancero': { length_mm: 191, ring_gauge: 38 },
  'culebra': { length_mm: 146, ring_gauge: 39 },
  'diplomatico': { length_mm: 155, ring_gauge: 42 },
  'diplomaticos': { length_mm: 155, ring_gauge: 42 },
  'regalia': { length_mm: 127, ring_gauge: 42 },
  'cazadores': { length_mm: 162, ring_gauge: 44 },
  'crystal': { length_mm: 142, ring_gauge: 42 },
  // Machine-made common sizes
  'mareva': { length_mm: 127, ring_gauge: 42 },
  'franciscano': { length_mm: 117, ring_gauge: 40 },
  'petit': { length_mm: 100, ring_gauge: 32 },
  'slim panatela': { length_mm: 175, ring_gauge: 28 },
  'short': { length_mm: 102, ring_gauge: 40 },
};

// Sort by length descending so multi-word names match before shorter ones
const VITOLA_KEYS_SORTED = Object.keys(VITOLA_DIMENSIONS).sort(
  (a, b) => b.length - a.length
);

/**
 * Try to parse dimensions directly from a string using common shorthand and
 * explicit length/gauge patterns.
 */
function parseExplicit(text: string): { length_mm: number | null; ring_gauge: number | null } {
  const t = text.toLowerCase();

  // Pattern: "\d+mm" for length
  const lengthMm = t.match(/\b(\d{2,3})\s*(?:mm|millimetres?|millimeters?)\b/);
  // Pattern: "\d+.\d+ inch" or "\d+" where inches - only if context clear
  const lengthInch = t.match(/\b(\d+(?:\.\d+)?)\s*(?:in(?:ch|ches)?|")\b/);

  // Ring gauge - explicit
  const ringExplicit = t.match(/\bring(?:\s*gauge)?\s*[:\-]?\s*(\d{2,3})\b/);

  // Combined shorthand: "5 x 50" or "5.5 x 52" or "127 x 50" (mm)
  // Also "5.5" x 50 or 5x50
  const shorthand = t.match(/\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d{2,3})\b/);

  // Ring gauge after an explicit length unit: "127mm x 50" or "5 inch x 50"
  const ringAfterUnit = t.match(
    /\b\d+(?:\.\d+)?\s*(?:mm|millimetres?|millimeters?|in(?:ch|ches)?|")\s*[x×/]\s*(\d{2,3})\b/
  );

  let length_mm: number | null = null;
  let ring_gauge: number | null = null;

  if (lengthMm) {
    const n = parseInt(lengthMm[1], 10);
    if (n >= 60 && n <= 300) length_mm = n;
  }
  if (!length_mm && lengthInch) {
    const n = parseFloat(lengthInch[1]);
    if (n >= 2 && n <= 12) length_mm = Math.round(n * INCH_TO_MM);
  }
  if (ringExplicit) {
    const n = parseInt(ringExplicit[1], 10);
    if (n >= 20 && n <= 80) ring_gauge = n;
  }
  if (!ring_gauge && ringAfterUnit) {
    const n = parseInt(ringAfterUnit[1], 10);
    if (n >= 20 && n <= 80) ring_gauge = n;
  }
  if (shorthand) {
    const a = parseFloat(shorthand[1]);
    const b = parseInt(shorthand[2], 10);
    if (b >= 20 && b <= 80) {
      if (!ring_gauge) ring_gauge = b;
      if (!length_mm) {
        if (a >= 2 && a <= 12) {
          length_mm = Math.round(a * INCH_TO_MM);
        } else if (a >= 60 && a <= 300) {
          length_mm = Math.round(a);
        }
      }
    }
  }

  return { length_mm, ring_gauge };
}

/**
 * Look up a vitola keyword in the product name.
 */
function parseVitola(name: string): { vitola: string; length_mm: number; ring_gauge: number } | null {
  const lower = name.toLowerCase();
  for (const key of VITOLA_KEYS_SORTED) {
    // Use word boundary-ish matching - allow hyphens/spaces around
    const re = new RegExp(`(?:^|[^a-z0-9])${key.replace(/\s+/g, '\\s+')}(?:[^a-z0-9]|$)`, 'i');
    if (re.test(lower)) {
      const dims = VITOLA_DIMENSIONS[key];
      return { vitola: key, ...dims };
    }
  }
  return null;
}

/**
 * Extract dimensions from a product name and optional description.
 */
export function parseDimensionsFromName(
  name: string,
  description: string | null | undefined = null
): ParsedDimensions {
  // 1. Explicit in name
  let explicit = parseExplicit(name);
  if (explicit.length_mm && explicit.ring_gauge) {
    return { ...explicit, vitola: null, source: 'explicit' };
  }

  // 2. Explicit in description
  if (description) {
    const descParsed = parseExplicit(description);
    if (descParsed.length_mm || descParsed.ring_gauge) {
      const merged = {
        length_mm: explicit.length_mm ?? descParsed.length_mm,
        ring_gauge: explicit.ring_gauge ?? descParsed.ring_gauge,
      };
      if (merged.length_mm && merged.ring_gauge) {
        return { ...merged, vitola: null, source: 'description' };
      }
      explicit = merged;
    }
  }

  // 3. Vitola match
  const vitolaMatch = parseVitola(name);
  if (vitolaMatch) {
    return {
      length_mm: explicit.length_mm ?? vitolaMatch.length_mm,
      ring_gauge: explicit.ring_gauge ?? vitolaMatch.ring_gauge,
      vitola: vitolaMatch.vitola,
      source: explicit.length_mm || explicit.ring_gauge ? 'explicit' : 'vitola',
    };
  }

  if (explicit.length_mm || explicit.ring_gauge) {
    return { ...explicit, vitola: null, source: 'explicit' };
  }

  return { length_mm: null, ring_gauge: null, vitola: null, source: null };
}

/**
 * Parse pack count from a product name. Returns 1 if no explicit count found
 * and name doesn't clearly indicate a multipack.
 */
export function parsePackCount(name: string): PackInfo {
  const t = name.toLowerCase();

  const patterns: Array<[RegExp, PackInfo['kind']]> = [
    [/\b(?:box)\s*of\s*(\d+)\b/, 'box'],
    [/\b(?:pack)\s*of\s*(\d+)\b/, 'pack'],
    [/\b(?:tin)\s*of\s*(\d+)\b/, 'tin'],
    [/\b(?:bundle)\s*of\s*(\d+)\b/, 'bundle'],
    [/\bcab(?:inet)?\s*of\s*(\d+)\b/, 'cabinet'],
    [/\b(?:twist)\s*of\s*(\d+)\b/, 'twist'],
    [/\b(?:tub(?:e)?)\s*of\s*(\d+)\b/, 'tub'],
    [/\b(\d+)\s*cigars?\b/, 'box'],
    [/\bbox\s*[-–]\s*(\d+)\b/, 'box'],
  ];

  for (const [re, kind] of patterns) {
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 200) {
        return { count: n, kind };
      }
    }
  }

  if (/\bsingle(?:\s*cigar)?\b/.test(t)) return { count: 1, kind: 'single' };
  if (/\b1\s*single\b/.test(t)) return { count: 1, kind: 'single' };
  if (/\btubed\b/.test(t) && !/\d+\s*tub/.test(t)) return { count: 1, kind: 'single' };

  return { count: 1, kind: 'unknown' };
}

/**
 * Compute price per inch for a single stick.
 * price is for the whole pack, so divide by pack count first.
 */
export function calculatePricePerInch(
  price: number,
  lengthMm: number,
  packCount: number
): number | null {
  if (!price || !lengthMm || !packCount || packCount <= 0 || lengthMm <= 0) return null;
  const pricePerStick = price / packCount;
  const inches = lengthMm / INCH_TO_MM;
  if (inches <= 0) return null;
  return pricePerStick / inches;
}

/**
 * Compute price per mm for a single stick (for internal use / precision).
 */
export function calculatePricePerMm(
  price: number,
  lengthMm: number,
  packCount: number
): number | null {
  if (!price || !lengthMm || !packCount || packCount <= 0 || lengthMm <= 0) return null;
  const pricePerStick = price / packCount;
  return pricePerStick / lengthMm;
}
