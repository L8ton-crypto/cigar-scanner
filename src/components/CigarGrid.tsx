'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FavouriteButton } from './FavouriteButton';

interface Cigar {
  id: number;
  name: string;
  brand: string;
  min_price: number;
  max_price: number;
  image_url?: string;
  strength?: string;
  format?: string;
  retailer_count: number;
  recent_drop?: boolean;
  sponsored?: boolean;
  sponsor_name?: string | null;
}

interface Pagination {
  page: number;
  pages: number;
  total: number;
  limit: number;
}

interface CigarGridProps {
  cigars: Cigar[];
  loading: boolean;
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

function CigarCard({ cigar }: { cigar: Cigar }) {
  const getStrengthColor = (strength?: string) => {
    if (!strength) return 'bg-gray-500';
    switch (strength.toLowerCase()) {
      case 'mild': return 'bg-green-500';
      case 'medium': return 'bg-[#c9a84c]';
      case 'full': case 'strong': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const minPrice = Number(cigar.min_price);
  const maxPrice = Number(cigar.max_price);
  const hasPriceRange = maxPrice > minPrice && cigar.retailer_count > 1;

  return (
    <div className={`cigar-card bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 ${cigar.sponsored ? 'ring-1 ring-[#c9a84c]/50' : ''}`}>
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
          <FavouriteButton cigar={cigar} size="sm" />
        </div>
        
        {/* Price drop badge */}
        {cigar.recent_drop && (
          <div className="absolute top-2 left-2 translate-y-8 bg-green-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-[1]">
            ↓ Price Drop
          </div>
        )}
        
        {/* Retailer count badge */}
        {cigar.retailer_count > 1 && (
          <div className="absolute top-2 right-2 bg-[#c9a84c] text-[#0f2419] text-xs font-bold px-2 py-1 rounded-full">
            {cigar.retailer_count} retailers
          </div>
        )}

        {/* Sponsored ribbon (task-52). Only renders when an active row exists in cs_sponsored. */}
        {cigar.sponsored && (
          <div
            className="absolute bottom-2 left-2 right-2 bg-[#c9a84c] text-[#0f2419] text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md flex items-center justify-between gap-2 shadow"
            title={cigar.sponsor_name ? `Sponsored by ${cigar.sponsor_name}` : 'Sponsored'}
          >
            <span>Sponsored</span>
            {cigar.sponsor_name && (
              <span className="font-medium normal-case truncate text-[10px]">
                {cigar.sponsor_name}
              </span>
            )}
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
          {cigar.retailer_count > 1 ? 'Compare Prices' : 'View Details'}
        </Link>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 animate-pulse">
          <div className="aspect-[3/4] bg-[#0a1a10] rounded-lg mb-4"></div>
          <div className="h-4 bg-[#0a1a10] rounded mb-2 w-1/3"></div>
          <div className="h-6 bg-[#0a1a10] rounded mb-3"></div>
          <div className="h-8 w-24 bg-[#0a1a10] rounded mb-4"></div>
          <div className="h-10 bg-[#0a1a10] rounded"></div>
        </div>
      ))}
    </div>
  );
}

function Pagination({ pagination, onPageChange }: { pagination: Pagination; onPageChange: (page: number) => void }) {
  if (pagination.pages <= 1) return null;
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots: (number | string)[] = [];
    for (let i = Math.max(2, pagination.page - delta); i <= Math.min(pagination.pages - 1, pagination.page + delta); i++) {
      range.push(i);
    }
    if (pagination.page - delta > 2) { rangeWithDots.push(1, '...'); } else { rangeWithDots.push(1); }
    rangeWithDots.push(...range);
    if (pagination.page + delta < pagination.pages - 1) { rangeWithDots.push('...', pagination.pages); } else if (pagination.pages > 1) { rangeWithDots.push(pagination.pages); }
    return rangeWithDots;
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-12">
      <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page === 1}
        className="px-4 py-2 rounded-lg border border-[#c9a84c]/20 text-white hover:bg-[#1a3a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        ← Previous
      </button>
      <div className="flex gap-1">
        {getPageNumbers().map((page, index) => (
          <button key={index} onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...' || page === pagination.page}
            className={`w-10 h-10 rounded-lg transition-colors ${
              page === pagination.page ? 'bg-[#c9a84c] text-[#0f2419] font-medium'
                : page === '...' ? 'text-[#8aaa7a] cursor-default'
                : 'border border-[#c9a84c]/20 text-white hover:bg-[#1a3a2a]'
            }`}>
            {page}
          </button>
        ))}
      </div>
      <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page === pagination.pages}
        className="px-4 py-2 rounded-lg border border-[#c9a84c]/20 text-white hover:bg-[#1a3a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        Next →
      </button>
    </div>
  );
}

export function CigarGrid({ cigars, loading, pagination, onPageChange }: CigarGridProps) {
  if (loading) return <LoadingSkeleton />;
  if (cigars.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-2xl font-semibold text-white mb-2">No cigars found</h3>
        <p className="text-[#8aaa7a]">Try adjusting your search filters</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cigars.map((cigar) => <CigarCard key={cigar.id} cigar={cigar} />)}
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </>
  );
}
