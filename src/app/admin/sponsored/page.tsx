'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface SponsoredRow {
  id: number;
  product_id: number;
  product_name: string | null;
  product_brand: string | null;
  sponsor_name: string | null;
  notes: string | null;
  weight: number;
  active: boolean;
  start_at: string;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  is_live: boolean;
}

interface CreateForm {
  product_id: string;
  sponsor_name: string;
  notes: string;
  weight: string;
  start_at: string;
  end_at: string;
}

const EMPTY_FORM: CreateForm = {
  product_id: '',
  sponsor_name: '',
  notes: '',
  weight: '1',
  start_at: '',
  end_at: '',
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export default function SponsoredAdminPage() {
  const [rows, setRows] = useState<SponsoredRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Pre-fill key from query string so a deep link /admin/sponsored?key=... works.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = new URL(window.location.href).searchParams.get('key');
    if (k) setAdminKey(k);
  }, []);

  const load = useCallback(async () => {
    if (!adminKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sponsored?key=${encodeURIComponent(adminKey)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRows(data.sponsored || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(row: SponsoredRow) {
    if (!adminKey) return;
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/admin/sponsored/${row.id}?key=${encodeURIComponent(adminKey)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !row.active }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(row: SponsoredRow) {
    if (!adminKey) return;
    if (!confirm(`Delete sponsored row #${row.id}? This is permanent.`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/admin/sponsored/${row.id}?key=${encodeURIComponent(adminKey)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function createRow(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey) return;
    const productId = parseInt(form.product_id, 10);
    if (!productId || isNaN(productId)) {
      setError('product_id must be a number');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/sponsored?key=${encodeURIComponent(adminKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: productId,
            sponsor_name: form.sponsor_name || undefined,
            notes: form.notes || undefined,
            weight: parseInt(form.weight, 10) || 1,
            start_at: form.start_at || undefined,
            end_at: form.end_at || undefined,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f2419] text-white">
      <nav className="border-b border-[#c9a84c]/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#8aaa7a] hover:text-white transition-colors">
            ← Back to Catalog
          </Link>
          <span className="text-[#c9a84c]/40">|</span>
          <span className="text-[#c9a84c] font-semibold">Sponsored Listings</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Sponsored Listings Admin</h1>
        <p className="text-[#8aaa7a] text-sm mb-6">
          Manage which products show a Sponsored badge. The feature stays invisible until at
          least one row exists with active=true and is within its start/end window.
        </p>

        <label className="block mb-4">
          <span className="text-[#8aaa7a] text-sm">Admin key (CRON_SECRET)</span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="paste CRON_SECRET"
            className="mt-1 w-full sm:w-96 bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2 text-white"
          />
        </label>

        {error && (
          <div className="bg-red-900/40 border border-red-500/40 rounded-md px-4 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Create form */}
        <section className="bg-[#1a3a2a]/60 rounded-xl p-4 sm:p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">Add a sponsored row</h2>
          <form onSubmit={createRow} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label>
              <span className="text-[#8aaa7a]">product_id *</span>
              <input
                required
                type="number"
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="mt-1 w-full bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2"
              />
            </label>
            <label>
              <span className="text-[#8aaa7a]">sponsor_name</span>
              <input
                type="text"
                maxLength={200}
                value={form.sponsor_name}
                onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })}
                className="mt-1 w-full bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2"
              />
            </label>
            <label>
              <span className="text-[#8aaa7a]">weight (1-1000)</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="mt-1 w-full bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2"
              />
            </label>
            <label>
              <span className="text-[#8aaa7a]">notes</span>
              <input
                type="text"
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2"
              />
            </label>
            <label>
              <span className="text-[#8aaa7a]">start_at (optional)</span>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                className="mt-1 w-full bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2"
              />
            </label>
            <label>
              <span className="text-[#8aaa7a]">end_at (optional)</span>
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                className="mt-1 w-full bg-[#0a1a10] border border-[#c9a84c]/30 rounded-md px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating || !adminKey}
                className="bg-[#c9a84c] hover:bg-[#b59538] disabled:opacity-40 text-[#0f2419] font-bold px-4 py-2 rounded-md"
              >
                {creating ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </section>

        {/* Existing rows */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Existing rows ({rows.length})</h2>
          {loading && <p className="text-[#8aaa7a] text-sm">Loading...</p>}
          {!loading && !adminKey && (
            <p className="text-[#8aaa7a] text-sm">Enter the admin key to load rows.</p>
          )}
          {!loading && adminKey && rows.length === 0 && (
            <p className="text-[#8aaa7a] text-sm">
              No sponsored rows yet. The Sponsored badge will not render anywhere until you add one.
            </p>
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[#8aaa7a] border-b border-[#c9a84c]/20">
                  <tr>
                    <th className="py-2 pr-3">id</th>
                    <th className="py-2 pr-3">product</th>
                    <th className="py-2 pr-3">sponsor</th>
                    <th className="py-2 pr-3">weight</th>
                    <th className="py-2 pr-3">window</th>
                    <th className="py-2 pr-3">status</th>
                    <th className="py-2 pr-3">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#c9a84c]/10">
                      <td className="py-2 pr-3 align-top">{r.id}</td>
                      <td className="py-2 pr-3 align-top">
                        <div className="text-white">{r.product_name || `#${r.product_id}`}</div>
                        <div className="text-[#8aaa7a] text-xs">
                          {r.product_brand || ''} (id {r.product_id})
                        </div>
                      </td>
                      <td className="py-2 pr-3 align-top">{r.sponsor_name || '-'}</td>
                      <td className="py-2 pr-3 align-top">{r.weight}</td>
                      <td className="py-2 pr-3 align-top text-xs">
                        <div>start: {formatDate(r.start_at)}</div>
                        <div>end: {formatDate(r.end_at)}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        {r.is_live ? (
                          <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-md text-xs">
                            live
                          </span>
                        ) : r.active ? (
                          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-md text-xs">
                            scheduled / expired
                          </span>
                        ) : (
                          <span className="bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-md text-xs">
                            inactive
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === r.id}
                            onClick={() => toggleActive(r)}
                            className="bg-[#0a1a10] border border-[#c9a84c]/40 hover:bg-[#1a3a2a] text-xs px-2 py-1 rounded-md"
                          >
                            {r.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => deleteRow(r)}
                            className="bg-red-900/40 border border-red-500/40 hover:bg-red-900/60 text-xs px-2 py-1 rounded-md"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
