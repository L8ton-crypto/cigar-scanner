'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { CigarGrid } from '@/components/CigarGrid';
import { SearchFilters } from '@/components/SearchFilters';
import { ScanModal } from '@/components/ScanModal';

interface Cigar {
  id: number;
  name: string;
  brand: string;
  price: number;
  currency: string;
  image_url?: string;
  strength?: string;
  format?: string;
  url: string;
  retailer: string;
}

interface FiltersState {
  search: string;
  brand: string;
  strength: string;
  minPrice: string;
  maxPrice: string;
}

export default function Home() {
  const [cigars, setCigars] = useState<Cigar[]>([]);
  const [brands, setBrands] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 24
  });
  
  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    brand: '',
    strength: '',
    minPrice: '',
    maxPrice: ''
  });

  // Fetch cigars
  useEffect(() => {
    fetchCigars();
  }, [filters, pagination.page]);

  // Fetch brands on mount
  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchCigars = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`/api/cigars?${params}`);
      const data = await response.json();
      
      setCigars(data.cigars);
      setPagination(prev => ({
        ...prev,
        pages: data.pages,
        total: data.total
      }));
    } catch (error) {
      console.error('Error fetching cigars:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands');
      const data = await response.json();
      setBrands(data.brands);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const handleFiltersChange = (newFilters: FiltersState) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen text-white font-[var(--font-inter)]">
      {/* Header */}
      <header className="border-b border-[#c9a84c]/20 bg-[#0a1a10]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Image 
              src="/logo.jpg" 
              alt="Hearth & Leaf" 
              width={48} 
              height={48}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-bold font-[var(--font-playfair)] text-[#c9a84c]">
                Hearth & Leaf
              </h1>
              <p className="text-sm text-[#8aaa7a]">CigarScanner</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.jpg" 
              alt="Hearth & Leaf" 
              width={120} 
              height={120}
              className="rounded-2xl shadow-lg border border-[#c9a84c]/20"
            />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold font-[var(--font-playfair)] text-white mb-4">
            Hearth & Leaf
            <span className="block text-[#c9a84c] text-3xl md:text-4xl mt-2">
              CigarScanner
            </span>
          </h1>
          
          <p className="text-xl text-[#8aaa7a] mb-8 max-w-2xl mx-auto">
            Identify any cigar. Find the best price.
          </p>

          {/* Scan Button */}
          <button
            onClick={() => setShowScanModal(true)}
            className="inline-flex items-center gap-3 bg-[#c9a84c] hover:bg-[#b8974a] 
                     text-[#0f2419] font-semibold px-8 py-4 rounded-xl text-lg 
                     transition-all transform hover:scale-105 hover:shadow-lg
                     hover:shadow-[#c9a84c]/20"
          >
            <span className="text-2xl">📷</span>
            Scan a Cigar
          </button>
        </div>

        {/* Search & Filters */}
        <div className="mb-8">
          <SearchFilters 
            filters={filters}
            brands={brands}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="mb-6">
            <p className="text-[#8aaa7a]">
              Found {pagination.total.toLocaleString()} cigars
              {filters.search && ` matching "${filters.search}"`}
              {filters.brand && ` from ${filters.brand}`}
            </p>
          </div>
        )}

        {/* Cigars Grid */}
        <CigarGrid 
          cigars={cigars}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      </main>

      {/* Scan Modal */}
      {showScanModal && (
        <ScanModal onClose={() => setShowScanModal(false)} />
      )}
    </div>
  );
}