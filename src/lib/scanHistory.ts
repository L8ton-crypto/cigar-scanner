const STORAGE_KEY = 'cigar-scanner-history';
const MAX_SCANS = 50;

export interface ScanRecord {
  id: string;
  timestamp: string;
  thumbnail: string; // small base64 preview
  identification: {
    brand?: string;
    name?: string;
    format?: string;
    country?: string;
    confidence: number;
    description?: string;
  };
  matchCount: number;
  bestPrice?: number;
  retailerCount?: number;
}

function generateId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Compress image to a small thumbnail for localStorage storage.
 * Returns a base64 JPEG ~15-20KB max.
 */
export function createThumbnail(imageDataUrl: string, maxSize = 150): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = imageDataUrl;
  });
}

export function getScanHistory(): ScanRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as ScanRecord[];
  } catch {
    return [];
  }
}

export function saveScan(record: Omit<ScanRecord, 'id' | 'timestamp'>): ScanRecord {
  const newRecord: ScanRecord = {
    ...record,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  const history = getScanHistory();
  history.unshift(newRecord);

  // Keep only the most recent scans
  const trimmed = history.slice(0, MAX_SCANS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — remove oldest entries and retry
    const smaller = trimmed.slice(0, 20);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(smaller));
    } catch {
      // give up silently
    }
  }

  return newRecord;
}

export function deleteScan(id: string): void {
  const history = getScanHistory();
  const filtered = history.filter(s => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getRecentScans(count = 4): ScanRecord[] {
  return getScanHistory().slice(0, count);
}
