'use client';

import { useState, useEffect, MouseEvent } from 'react';
import { toggleFavourite, isFavourite } from '@/lib/favourites';

interface FavouriteButtonProps {
  cigar: {
    id: number;
    name: string;
    brand: string;
    min_price: number;
    max_price: number;
    image_url?: string;
    strength?: string;
    format?: string;
    retailer_count: number;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onToggle?: (isFavourite: boolean) => void;
}

export function FavouriteButton({ cigar, size = 'md', className = '', onToggle }: FavouriteButtonProps) {
  const [isFav, setIsFav] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Check initial state from localStorage
  useEffect(() => {
    setIsFav(isFavourite(cigar.id));
  }, [cigar.id]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newState = toggleFavourite(cigar);
    setIsFav(newState);
    onToggle?.(newState);
    
    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const iconSize = size === 'sm' ? '20px' : size === 'md' ? '24px' : '28px';

  return (
    <button
      onClick={handleClick}
      className={`transition-transform duration-200 hover:scale-110 ${
        isAnimating ? 'scale-125' : ''
      } ${className}`}
      style={{
        width: iconSize,
        height: iconSize,
      }}
      aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={isFav ? '#ef4444' : 'none'}
        stroke={isFav ? '#ef4444' : '#8aaa7a'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-colors duration-200 ${
          !isFav ? 'hover:stroke-[#c9a84c]' : ''
        }`}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}