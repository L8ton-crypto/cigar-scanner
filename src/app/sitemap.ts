import { MetadataRoute } from 'next'
import { sql, ensureDb } from '@/lib/db'
import { slugify } from '@/lib/slugify'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureDb();
  
  const brands = await sql`SELECT DISTINCT brand FROM cs_products ORDER BY brand`;
  const products = await sql`SELECT id FROM cs_products ORDER BY id`;
  
  const baseUrl = 'https://cigar-scanner-app.vercel.app';
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/brands`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/deals`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    ...brands.map(b => ({
      url: `${baseUrl}/brand/${slugify(b.brand as string)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map(p => ({
      url: `${baseUrl}/cigar/${p.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}