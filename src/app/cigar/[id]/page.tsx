'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface Cigar {
  id: number;
  name: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  url: string;
  image_url?: string;
  retailer: string;
  length_mm?: number;
  ring_gauge?: number;
  strength?: string;
  format?: string;
  country?: string;
  created_at: string;
}

interface RelatedCigar {
  id: number;
  name: string;
  brand: string;
  price: number;
  image_url?: string;
  strength?: string;
  format?: string;
}

export default function CigarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [cigar, setCigar] = useState<Cigar | null>(null);
  const [related, setRelated] = useState<RelatedCigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchCigar(params.id as string);
    }
  }, [params.id]);

  const fetchCigar = async (id: string) => {
    try {
      const response = await fetch(`/api/cigars/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Cigar not found');
        } else {
          setError('Failed to load cigar details');
        }
        return;
      }

      const data = await response.json();
      setCigar(data.cigar);
      setRelated(data.related || []);
    } catch (err) {
      setError('Failed to load cigar details');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (strength?: string) => {
    if (!strength) return 'bg-gray-500';
    
    switch (strength.toLowerCase()) {
      case 'mild':
        return 'bg-green-500';
      case 'medium':
        return 'bg-[#c9a84c]';
      case 'full':
      case 'strong':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDimensions = (cigar: Cigar) => {
    const parts = [];
    if (cigar.length_mm) {
      parts.push(`${cigar.length_mm}mm length`);
    }
    if (cigar.ring_gauge) {
      parts.push(`${cigar.ring_gauge} ring gauge`);
    }
    return parts.join(' × ');
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white bg-gradient-to-br from-[#0f2419] to-[#0a1a10]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-[#1a3a2a] rounded mb-8"></div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="aspect-square bg-[#1a3a2a] rounded-xl"></div>
              <div className="space-y-4">
                <div className="h-6 bg-[#1a3a2a] rounded w-1/3"></div>
                <div className="h-8 bg-[#1a3a2a] rounded w-2/3"></div>
                <div className="h-20 bg-[#1a3a2a] rounded"></div>
                <div className="h-12 bg-[#1a3a2a] rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !cigar) {
    return (
      <div className="min-h-screen text-white bg-gradient-to-br from-[#0f2419] to-[#0a1a10] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-2">{error || 'Cigar not found'}</h1>
          <Link 
            href="/"
            className="text-[#c9a84c] hover:text-white transition-colors"
          >
            ← Return to catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-[#0f2419] to-[#0a1a10]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="text-[#8aaa7a] hover:text-[#c9a84c] transition-colors"
            >
              ← Back to Catalog
            </Link>
            <div className="h-6 w-px bg-[#c9a84c]/20"></div>
            <Image 
              src="/logo.jpg" 
              alt="Hearth & Leaf" 
              width={32} 
              height={32}
              className="rounded-lg"
            />
            <div>
              <span className="text-[#c9a84c] font-bold">Hearth & Leaf</span>
              <span className="text-[#8aaa7a] text-sm ml-2">CigarScanner</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cigar Details */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Image */}
          <div className="aspect-square relative rounded-2xl overflow-hidden bg-[#1a3a2a]/80 backdrop-blur border border-[#c9a84c]/20">
            {cigar.image_url ? (
              <Image
                src={cigar.image_url}
                alt={cigar.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-[#c9a84c]/30 text-8xl">🚬</div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Brand & Name */}
            <div>
              <p className="text-[#c9a84c] text-lg font-medium mb-2">{cigar.brand}</p>
              <h1 className="text-4xl font-bold text-white font-[var(--font-playfair)] leading-tight">
                {cigar.name}
              </h1>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              {cigar.strength && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStrengthColor(cigar.strength)}`}>
                  {cigar.strength} Strength
                </span>
              )}
              {cigar.format && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a3a2a] text-[#c9a84c] border border-[#c9a84c]/20">
                  {cigar.format}
                </span>
              )}
              {cigar.country && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a3a2a] text-[#8aaa7a] border border-[#c9a84c]/20">
                  {cigar.country}
                </span>
              )}
            </div>

            {/* Specifications */}
            <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 border border-[#c9a84c]/20">
              <h3 className="text-[#c9a84c] font-semibold mb-4">Specifications</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {cigar.length_mm && (
                  <div>
                    <span className="text-[#8aaa7a] block">Length</span>
                    <span className="text-white font-medium">{cigar.length_mm}mm</span>
                  </div>
                )}
                {cigar.ring_gauge && (
                  <div>
                    <span className="text-[#8aaa7a] block">Ring Gauge</span>
                    <span className="text-white font-medium">{cigar.ring_gauge}</span>
                  </div>
                )}
                {cigar.format && (
                  <div>
                    <span className="text-[#8aaa7a] block">Format</span>
                    <span className="text-white font-medium">{cigar.format}</span>
                  </div>
                )}
                {cigar.strength && (
                  <div>
                    <span className="text-[#8aaa7a] block">Strength</span>
                    <span className="text-white font-medium">{cigar.strength}</span>
                  </div>
                )}
              </div>
              {formatDimensions(cigar) && (
                <div className="mt-4 pt-4 border-t border-[#c9a84c]/10">
                  <p className="text-[#8aaa7a] text-sm">{formatDimensions(cigar)}</p>
                </div>
              )}
            </div>

            {/* Description */}
            {cigar.description && (
              <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 border border-[#c9a84c]/20">
                <h3 className="text-[#c9a84c] font-semibold mb-3">Description</h3>
                <p className="text-[#8aaa7a] leading-relaxed">{cigar.description}</p>
              </div>
            )}

            {/* Price & Purchase */}
            <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-6 border border-[#c9a84c]/20">
              <h3 className="text-[#c9a84c] font-semibold mb-4">Price & Availability</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-[#c9a84c] mb-1">
                    £{cigar.price.toFixed(2)}
                  </div>
                  <div className="text-[#8aaa7a] text-sm">
                    Available from {cigar.retailer}
                  </div>
                </div>
                <a
                  href={cigar.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] font-semibold px-8 py-3 rounded-xl transition-all transform hover:scale-105 hover:shadow-lg hover:shadow-[#c9a84c]/20"
                >
                  Buy from {cigar.retailer} →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Related Cigars */}
        {related.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-[#c9a84c] font-[var(--font-playfair)] mb-8">
              Related Cigars
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {related.map((relatedCigar) => (
                <Link
                  key={relatedCigar.id}
                  href={`/cigar/${relatedCigar.id}`}
                  className="group"
                >
                  <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 border border-[#c9a84c]/20 hover:border-[#c9a84c]/40 transition-all group-hover:transform group-hover:scale-105">
                    <div className="aspect-[3/4] relative mb-3 rounded-lg overflow-hidden bg-[#0a1a10]">
                      {relatedCigar.image_url ? (
                        <Image
                          src={relatedCigar.image_url}
                          alt={relatedCigar.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-[#c9a84c]/30 text-2xl">🚬</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[#c9a84c] text-xs font-medium mb-1">{relatedCigar.brand}</p>
                      <h3 className="text-white text-sm font-medium leading-tight mb-2 line-clamp-2">
                        {relatedCigar.name}
                      </h3>
                      <div className="flex justify-between items-center">
                        <span className="text-[#c9a84c] font-bold">£{relatedCigar.price.toFixed(2)}</span>
                        {relatedCigar.strength && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getStrengthColor(relatedCigar.strength)}`}>
                            {relatedCigar.strength}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}