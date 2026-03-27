// Types
export interface FavouriteCigar {
  id: number;
  name: string;
  brand: string;
  min_price: number;
  max_price: number;
  image_url?: string;
  strength?: string;
  format?: string;
  retailer_count: number;
  addedAt: string; // ISO date string
}

const STORAGE_KEY = 'cigarscanner_favourites';

// Helper to safely access localStorage
const getStorage = (): FavouriteCigar[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setStorage = (favourites: FavouriteCigar[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

// Get all favourites, sorted by addedAt descending
export const getFavourites = (): FavouriteCigar[] => {
  const favourites = getStorage();
  return favourites.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
};

// Add to favourites
export const addFavourite = (cigar: Omit<FavouriteCigar, 'addedAt'>): void => {
  const favourites = getStorage();
  const exists = favourites.some(fav => fav.id === cigar.id);
  
  if (!exists) {
    const newFavourite: FavouriteCigar = {
      ...cigar,
      addedAt: new Date().toISOString()
    };
    favourites.push(newFavourite);
    setStorage(favourites);
  }
};

// Remove from favourites by id
export const removeFavourite = (id: number): void => {
  const favourites = getStorage();
  const filtered = favourites.filter(fav => fav.id !== id);
  setStorage(filtered);
};

// Check if favourited
export const isFavourite = (id: number): boolean => {
  const favourites = getStorage();
  return favourites.some(fav => fav.id === id);
};

// Toggle favourite, returns new state (true=added, false=removed)
export const toggleFavourite = (cigar: Omit<FavouriteCigar, 'addedAt'>): boolean => {
  if (isFavourite(cigar.id)) {
    removeFavourite(cigar.id);
    return false;
  } else {
    addFavourite(cigar);
    return true;
  }
};

// Get count
export const getFavouriteCount = (): number => {
  const favourites = getStorage();
  return favourites.length;
};