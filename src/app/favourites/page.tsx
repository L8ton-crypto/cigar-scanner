'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getFavourites, type FavouriteCigar } from '@/lib/favourites';
import { FavouriteButton } from '@/components/FavouriteButton';

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState<FavouriteCigar[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favourites
  useEffect(() => {
    setFavourites(getFavourites());
    setLoading(false);
  }, []);

  // Handle favourite removal (update state immediately)
  const handleFavouriteChange = (_isFav?: boolean) => {
    setFavourites(getFavourites());
  };

  const getStrengthColor = (strength?: string) => {
    if (!strength) return 'bg-gray-500';
    switch (strength.toLowerCase()) {
      case 'mild': return 'bg-green-500';
      case 'medium': return 'bg-[#c9a84c]';
      case 'full': case 'strong': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f2419]">
        {/* Header */}
        <nav className="border-b border-[#c9a84c]/20 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <Link href="/" className="text-[#8aaa7a] hover:text-white transition-colors">← Back to Catalog</Link>
            <span className="text-[#c9a84c]/40">|</span>
            <span className="text-[#c9a84c] font-semibold">🚬 Hearth & Leaf</span>
            <span className="text-[#8aaa7a] text-sm">CigarScanner</span>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center">
            <div className="text-[#c9a84c] text-xl">Loading favourites...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f2419]">
      {/* Header */}
      <nav className="border-b border-[#c9a84c]/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#8aaa7a] hover:text-white transition-colors">← Back to Catalog</Link>
          <span className="text-[#c9a84c]/40">|</span>
          <span className="text-[#c9a84c] font-semibold">🚬 Hearth & Leaf</span>
          <span className="text-[#8aaa7a] text-sm">CigarScanner</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-white text-4xl font-bold font-[var(--font-playfair)] mb-2">
            {favourites.length} Favourites
          </h1>
          <p className="text-[#8aaa7a]">Your saved cigars for easy reference</p>
        </div>

        {favourites.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">❤️</div>
            <h3 className="text-2xl font-semibold text-white mb-2">No favourites yet</h3>
            <p className="text-[#8aaa7a] mb-6">Browse cigars and tap the heart to save them here</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Browse Cigars →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favourites.map((cigar) => {
              const minPrice = Number(cigar.min_price);
              const maxPrice = Number(cigar.max_price);
              const hasPriceRange = maxPrice > minPrice && cigar.retailer_count > 1;

              return (
                <div key={cigar.id} className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4">
                  {/* Image */}
                  <div className="relative aspect-[3/4] mb-4 rounded-lg overflow-hidden bg-[#0a1a10]">
                    {cigar.image_url ? (
                      <Image
                        src={cigar.image_url}
                        alt={cigar.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-[#c9a84c]/30 text-6xl">🚬</div>
                      </div>
                    )}
                    
                    {/* Favourite button */}
                    <div className="absolute top-2 left-2 z-[1]">
                      <FavouriteButton cigar={cigar} size="sm" onToggle={handleFavouriteChange} />
                    </div>
                    
                    {/* Retailer count badge */}
                    {cigar.retailer_count > 1 && (
                      <div className="absolute top-2 right-2 bg-[#c9a84c] text-[#0f2419] text-xs font-bold px-2 py-1 rounded-full">
                        {cigar.retailer_count} retailers
                      </div>
                    )}
                  </div>

                  {/* Brand */}
                  <p className="text-[#c9a84c] text-sm font-medium mb-1">{cigar.brand}</p>

                  {/* Name */}
                  <h3 className="text-white font-semibold text-lg leading-tight mb-3 line-clamp-2">{cigar.name}</h3>

                  {/* Strength & Format */}
                  <div className="flex gap-2 mb-4">
                    {cigar.strength && (
                      <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getStrengthColor(cigar.strength)}`}>
                        {cigar.strength}
                      </span>
                    )}
                    {cigar.format && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-[#0f2419] text-[#8aaa7a] border border-[#c9a84c]/20">
                        {cigar.format}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[#8aaa7a] text-xs">from</span>
                      <span className="text-[#c9a84c] text-2xl font-bold ml-1">
                        £{minPrice.toFixed(2)}
                      </span>
                    </div>
                    {hasPriceRange && (
                      <span className="text-green-400 text-xs font-medium">
                        Save up to £{(maxPrice - minPrice).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link 
                      href={`/cigar/${cigar.id}`}
                      className="flex-1 bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] text-center py-2 px-4 rounded-lg font-medium transition-colors"
                    >
                      Compare Prices
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}