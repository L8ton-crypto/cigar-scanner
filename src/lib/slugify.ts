export function slugify(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function deslugify(slug: string): string {
  // Convert slug back to display-friendly format (used for fallback display only)
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}