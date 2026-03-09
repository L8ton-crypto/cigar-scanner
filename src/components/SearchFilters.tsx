'use client';

import { useState, useRef } from 'react';

interface FiltersState {
  search: string;
  brand: string;
  strength: string;
  minPrice: string;
  maxPrice: string;
}

interface SearchFiltersProps {
  filters: FiltersState;
  brands: { name: string; count: number }[];
  onFiltersChange: (filters: FiltersState) => void;
}

const strengthOptions = [
  { value: '', label: 'All Strengths' },
  { value: 'Mild', label: 'Mild' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Full', label: 'Full' },
  { value: 'Strong', label: 'Strong' }
];

export function SearchFilters({ filters, brands, onFiltersChange }: SearchFiltersProps) {
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (field: keyof FiltersState, value: string) => {
    const newFilters = { ...filters, [field]: value };
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      brand: '',
      strength: '',
      minPrice: '',
      maxPrice: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-xl p-4 sm:p-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search cigars, brands..."
          value={filters.search}
          onChange={(e) => handleInputChange('search', e.target.value)}
          className="w-full bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-4 py-3 text-white placeholder-[#8aaa7a] focus:border-[#c9a84c] focus:outline-none transition-colors"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8aaa7a]">
          🔍
        </div>
      </div>

      {/* Filters - 2x2 grid on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {/* Brand Filter */}
        <div className="relative" ref={brandDropdownRef}>
          <button
            onClick={() => setShowBrandDropdown(!showBrandDropdown)}
            className="w-full bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-left text-white hover:border-[#c9a84c]/40 focus:border-[#c9a84c] focus:outline-none transition-colors flex justify-between items-center text-sm sm:text-base"
          >
            <span className={`truncate ${filters.brand ? 'text-white' : 'text-[#8aaa7a]'}`}>
              {filters.brand || 'All Brands'}
            </span>
            <span className="text-[#8aaa7a] ml-1">▼</span>
          </button>

          {showBrandDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
              <button
                onClick={() => {
                  handleInputChange('brand', '');
                  setShowBrandDropdown(false);
                }}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#1a3a2a] transition-colors border-b border-[#c9a84c]/10"
              >
                All Brands
              </button>
              {brands.map((brand) => (
                <button
                  key={brand.name}
                  onClick={() => {
                    handleInputChange('brand', brand.name);
                    setShowBrandDropdown(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-[#1a3a2a] transition-colors flex justify-between items-center"
                >
                  <span>{brand.name}</span>
                  <span className="text-[#8aaa7a] text-sm">({brand.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Strength Filter */}
        <select
          value={filters.strength}
          onChange={(e) => handleInputChange('strength', e.target.value)}
          className="bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-white focus:border-[#c9a84c] focus:outline-none transition-colors text-sm sm:text-base"
        >
          {strengthOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#0f2419]">
              {option.label}
            </option>
          ))}
        </select>

        {/* Price Range - both inputs in one grid cell */}
        <div className="flex gap-1 sm:gap-2">
          <input
            type="number"
            placeholder="Min £"
            value={filters.minPrice}
            onChange={(e) => handleInputChange('minPrice', e.target.value)}
            className="w-full min-w-0 bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-2 py-2 sm:px-3 sm:py-3 text-white placeholder-[#8aaa7a] focus:border-[#c9a84c] focus:outline-none transition-colors text-sm sm:text-base"
            min="0"
            step="0.01"
          />
          <input
            type="number"
            placeholder="Max £"
            value={filters.maxPrice}
            onChange={(e) => handleInputChange('maxPrice', e.target.value)}
            className="w-full min-w-0 bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-2 py-2 sm:px-3 sm:py-3 text-white placeholder-[#8aaa7a] focus:border-[#c9a84c] focus:outline-none transition-colors text-sm sm:text-base"
            min="0"
            step="0.01"
          />
        </div>

        {/* Clear Filters */}
        <button
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="bg-[#0f2419] border border-[#c9a84c]/20 rounded-lg px-3 py-2 sm:px-4 sm:py-3 text-[#c9a84c] hover:bg-[#1a3a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
        >
          Clear Filters
        </button>
      </div>

      {/* Strength Pills */}
      <div className="flex flex-wrap gap-2">
        {strengthOptions.slice(1).map((option) => (
          <button
            key={option.value}
            onClick={() => handleInputChange('strength', filters.strength === option.value ? '' : option.value)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filters.strength === option.value
                ? 'bg-[#c9a84c] text-[#0f2419] font-medium'
                : 'border border-[#c9a84c]/20 text-[#8aaa7a] hover:border-[#c9a84c]/40 hover:text-[#c9a84c]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="border-t border-[#c9a84c]/20 pt-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-[#8aaa7a] text-sm">Active:</span>
            {filters.search && (
              <span className="bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-1 rounded text-sm flex items-center gap-1">
                &ldquo;{filters.search}&rdquo;
                <button onClick={() => handleInputChange('search', '')} className="text-[#c9a84c] hover:text-white">×</button>
              </span>
            )}
            {filters.brand && (
              <span className="bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-1 rounded text-sm flex items-center gap-1">
                {filters.brand}
                <button onClick={() => handleInputChange('brand', '')} className="text-[#c9a84c] hover:text-white">×</button>
              </span>
            )}
            {filters.strength && (
              <span className="bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-1 rounded text-sm flex items-center gap-1">
                {filters.strength}
                <button onClick={() => handleInputChange('strength', '')} className="text-[#c9a84c] hover:text-white">×</button>
              </span>
            )}
            {(filters.minPrice || filters.maxPrice) && (
              <span className="bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-1 rounded text-sm flex items-center gap-1">
                £{filters.minPrice || '0'}-£{filters.maxPrice || '∞'}
                <button onClick={() => { handleInputChange('minPrice', ''); handleInputChange('maxPrice', ''); }} className="text-[#c9a84c] hover:text-white">×</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
