'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ScanData {
  id: string;
  identification: {
    brand?: string;
    name?: string;
    format?: string;
    country?: string;
    confidence: number;
    description?: string;
  };
  matches: Array<{
    id: number;
    name: string;
    brand: string;
    price: number;
    currency?: string;
    image_url?: string;
    strength?: string;
    format?: string;
    url: string;
    retailer: string;
  }>;
  similar: Array<{
    id: number;
    name: string;
    brand: string;
    image_url?: string;
    price: number;
    retailer_count: number;
  }>;
  thumbnail: string | null;
  createdAt: string;
}

export default function SharedScanView({ scan }: { scan: ScanData }) {
  const [copied, setCopied] = useState(false);
  const ident = scan.identification;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const scannedDate = new Date(scan.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen text-white font-[var(--font-inter)]">
      {/* Header */}
      <nav className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="Hearth & Leaf" width={36} height={36} className="rounded-lg" />
            <div>
              <span className="text-[#c9a84c] font-bold font-[var(--font-playfair)]">Hearth & Leaf</span>
              <span className="text-[#8aaa7a] text-sm ml-2">CigarScanner</span>
            </div>
          </Link>
          <button
            onClick={handleCopy}
            className="bg-[#1a3a2a] hover:bg-[#2a4a3a] text-[#c9a84c] px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Scan Badge */}
        <div className="text-center mb-2">
          <span className="text-[#8aaa7a] text-sm">Scanned on {scannedDate}</span>
        </div>

        {/* Identification Card */}
        <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-2xl p-6 sm:p-8 mb-8 border border-[#c9a84c]/10">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Thumbnail */}
            {scan.thumbnail && (
              <div className="w-32 h-32 rounded-xl overflow-hidden bg-[#0a1a10] flex-shrink-0 mx-auto sm:mx-0">
                <Image
                  src={scan.thumbnail}
                  alt={ident.name || 'Scanned cigar'}
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="flex-1 space-y-3">
              {ident.brand && (
                <p className="text-[#c9a84c] text-lg font-medium">{ident.brand}</p>
              )}
              <h1 className="text-white text-3xl font-bold font-[var(--font-playfair)]">
                {ident.name || 'Unknown Cigar'}
              </h1>

              <div className="flex flex-wrap gap-3">
                {ident.format && (
                  <span className="bg-[#0f2419] text-[#8aaa7a] px-3 py-1 rounded-lg text-sm">
                    {ident.format}
                  </span>
                )}
                {ident.country && (
                  <span className="bg-[#0f2419] text-[#8aaa7a] px-3 py-1 rounded-lg text-sm">
                    🌍 {ident.country}
                  </span>
                )}
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-3">
                <span className="text-[#8aaa7a] text-sm">Confidence:</span>
                <div className="flex-1 max-w-48 bg-[#0a1a10] rounded-full h-2">
                  <div
                    className="h-2 bg-[#c9a84c] rounded-full"
                    style={{ width: `${ident.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[#c9a84c] font-medium text-sm">
                  {Math.round(ident.confidence * 100)}%
                </span>
              </div>

              {ident.description && (
                <p className="text-[#d4ddd0] text-sm leading-relaxed">{ident.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Price Matches */}
        {scan.matches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[#c9a84c] text-xl font-bold font-[var(--font-playfair)] mb-4">
              💰 Price Comparison ({scan.matches.length} {scan.matches.length === 1 ? 'match' : 'matches'})
            </h2>
            <div className="space-y-3">
              {scan.matches.map((match, i) => {
                const isCheapest = i === 0 && scan.matches.length > 1;
                return (
                  <div
                    key={match.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                      isCheapest
                        ? 'border-green-500/40 bg-green-500/5'
                        : 'border-[#c9a84c]/10 bg-[#1a3a2a]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 bg-[#0a1a10] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {match.image_url ? (
                          <Image src={match.image_url} alt={match.name} width={48} height={48} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-[#c9a84c]/30">🚬</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isCheapest && (
                            <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              BEST
                            </span>
                          )}
                          <p className="text-white font-medium truncate">{match.name}</p>
                        </div>
                        <p className="text-[#8aaa7a] text-sm">{match.retailer}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xl font-bold ${isCheapest ? 'text-green-400' : 'text-[#c9a84c]'}`}>
                        £{Number(match.price).toFixed(2)}
                      </span>
                      <a
                        href={match.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Buy →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Similar cigars if no matches */}
        {scan.matches.length === 0 && scan.similar.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[#c9a84c] text-xl font-bold font-[var(--font-playfair)] mb-4">
              Other {ident.brand} cigars available
            </h2>
            <div className="grid gap-3">
              {scan.similar.map((item) => (
                <a
                  key={item.id}
                  href={`/cigar/${item.id}`}
                  className="bg-[#1a3a2a]/80 rounded-lg p-4 flex gap-4 hover:bg-[#1a3a2a] transition-colors"
                >
                  <div className="w-14 h-14 bg-[#0a1a10] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} width={56} height={56} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-[#c9a84c]/30 text-xl">🚬</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{item.name}</p>
                    <p className="text-[#8aaa7a] text-xs mt-1">
                      From £{Number(item.price).toFixed(2)}
                      {item.retailer_count > 1 && ` across ${item.retailer_count} retailers`}
                    </p>
                  </div>
                  <div className="text-[#c9a84c] text-sm self-center">→</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* No matches message */}
        {scan.matches.length === 0 && scan.similar.length === 0 && (
          <div className="bg-[#1a3a2a]/60 rounded-xl p-6 text-center mb-8">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-white font-medium">Cigar identified but not currently stocked by tracked UK retailers.</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-8 border-t border-[#c9a84c]/10">
          <p className="text-[#8aaa7a] mb-4">Want to identify your own cigars?</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            📷 Scan a Cigar
          </Link>
        </div>
      </main>
    </div>
  );
}