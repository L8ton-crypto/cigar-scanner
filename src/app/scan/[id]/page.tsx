import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql, ensureDb } from '@/lib/db';
import SharedScanView from './SharedScanView';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  await ensureDb();
  const results = await sql`SELECT identification FROM cs_scans WHERE id = ${id}`;
  
  if (results.length === 0) {
    return { title: 'Scan Not Found — Hearth & Leaf' };
  }
  
  const scan = results[0];
  const ident = scan.identification as any;
  const title = ident.name 
    ? `${ident.name} — Scanned on Hearth & Leaf`
    : 'Cigar Scan — Hearth & Leaf';
  const description = ident.description 
    || `${ident.brand || 'Unknown'} ${ident.name || 'cigar'} identified with ${Math.round((ident.confidence || 0) * 100)}% confidence`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'Hearth & Leaf CigarScanner',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function SharedScanPage({ params }: Props) {
  const { id } = await params;
  await ensureDb();
  
  const results = await sql`
    SELECT id, identification, matches, similar, thumbnail, created_at
    FROM cs_scans WHERE id = ${id}
  `;
  
  if (results.length === 0) {
    notFound();
  }
  
  const scan = results[0];
  
  return <SharedScanView scan={{
    id: scan.id,
    identification: scan.identification as any,
    matches: scan.matches as any[],
    similar: scan.similar as any[],
    thumbnail: scan.thumbnail as string | null,
    createdAt: scan.created_at as string,
  }} />;
}