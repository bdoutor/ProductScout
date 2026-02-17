'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchResponse } from '@/types';
import AuthHeader from '@/components/AuthHeader';
import { getProgressiveSearchProgress, startProgressiveSearch } from '@/utils/api';
import ResultsTable from '@/components/ResultsTable';
type Tab = 'search' | 'config';

const DEFAULT_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_PROGRESS_POLL_MS || '5000');

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState({ total: 0, completed: 0, done: false });
  const [lastProgressUpdate, setLastProgressUpdate] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [attemptedAugerRecheck, setAttemptedAugerRecheck] = useState(false);
  const [errorLogText, setErrorLogText] = useState<string | null>(null);
  const [errorLogSupplier, setErrorLogSupplier] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSuppliers = Math.max(progressInfo.total - progressInfo.completed, 0);
  const hasProgressTotals = progressInfo.total > 0;
  const computedPercent = hasProgressTotals
    ? (progressInfo.completed / Math.max(progressInfo.total, 1)) * 100
    : (loading || currentRunId ? 20 : 0);
  const progressPercent = Math.min(100, Math.max(0, computedPercent));
  const formattedLastUpdate = lastProgressUpdate ? new Date(lastProgressUpdate).toLocaleTimeString() : null;

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetch(`/auth/me`, { credentials: 'include' });
        const data = await res.json();
        if (!data?.user && !cancelled) {
          router.push('/login');
        }
      } catch {
        if (!cancelled) router.push('/login');
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => { cancelled = true; };
  }, [router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    const trimmedQuery = query.trim();

    setLoading(true);
    setError(null);
    setSearchResponse(null);
    setCurrentRunId(null);
    setProgressInfo({ total: 0, completed: 0, done: false });
    setLastProgressUpdate(null);
    setAttemptedAugerRecheck(false);
    setShowOutOfStock(false);
    setActiveQuery(trimmedQuery);

    try {
      const startResponse = await startProgressiveSearch(trimmedQuery, true);

      if (startResponse.fallback) {
        setSearchResponse(startResponse.fallback);
        setProgressInfo({ total: 0, completed: 0, done: true });
        setLoading(false);
        return;
      }

      if (!startResponse.run_id) {
        throw new Error('Unable to start search run');
      }

      setPollInterval(startResponse.poll_interval_ms || DEFAULT_POLL_INTERVAL);
      setProgressInfo({
        total: startResponse.total_suppliers || 0,
        completed: 0,
        done: (startResponse.total_suppliers || 0) === 0
      });
      setSearchResponse({ query: trimmedQuery, items: [], per_supplier: [] });
      setCurrentRunId(startResponse.run_id);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to start search');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentRunId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const data = await getProgressiveSearchProgress(currentRunId);
        if (cancelled) return;

        setSearchResponse({
          query: data.query,
          items: data.items || [],
          per_supplier: data.per_supplier || [],
          message: data.message
        });
        setProgressInfo({
          total: data.total_suppliers ?? 0,
          completed: data.completed_suppliers ?? 0,
          done: Boolean(data.done)
        });
        setLastProgressUpdate(data.last_update || new Date().toISOString());

        if (data.done) {
          setLoading(false);
          setCurrentRunId(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Progress poll failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to retrieve progress');
        setLoading(false);
        setCurrentRunId(null);
      }
    };

    fetchProgress();
    pollRef.current = setInterval(fetchProgress, pollInterval);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [currentRunId, pollInterval]);

  useEffect(() => {
    if (!searchResponse || !progressInfo.done || attemptedAugerRecheck || !activeQuery) {
      return;
    }

    if (searchResponse.items.length > 0) {
      return;
    }

    const augerSucceeded = (searchResponse.per_supplier || []).some(
      (supplier) => supplier.status === 'success' && supplier.supplier_name?.toLowerCase().includes('auger')
    );

    if (!augerSucceeded) {
      return;
    }

    let cancelled = false;
    setAttemptedAugerRecheck(true);

    (async () => {
      try {
        const supRes = await fetch('/api/suppliers', { credentials: 'include' });
        if (!supRes.ok) {
          throw new Error(`Failed to fetch suppliers: ${supRes.statusText}`);
        }
        const allSup = await supRes.json();
        const auger = allSup.find((s: any) => String(s.name).toLowerCase().includes('auger'));
        if (!auger?.id || cancelled) {
          return;
        }

        const diag = await fetch('/api/test-supplier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ supplier_id: auger.id, query: activeQuery, debug: true })
        });

        if (!diag.ok || cancelled) {
          return;
        }

        const diagJson = await diag.json();
        if (!Array.isArray(diagJson.items) || cancelled) {
          return;
        }

        setSearchResponse((prev) => {
          if (!prev) return prev;
          const others = (prev.per_supplier || []).filter((s) => !s.supplier_name?.toLowerCase().includes('auger'));
          return {
            ...prev,
            items: diagJson.items || [],
            per_supplier: [
              ...others,
              {
                supplier_name: 'AUGER',
                supplier_id: auger.id,
                status: 'success',
                items_found: diagJson.items?.length || 0
              }
            ]
          };
        });
      } catch (err) {
        console.error('Error during AUGER recheck:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchResponse, progressInfo.done, attemptedAugerRecheck, activeQuery]);

  const goToConfig = () => router.push('/admin');

  const renderSearchTab = () => (
    <div className="space-y-6">
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search products
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., 'brake pads' or 'oil filter 1234567'"
                className="input flex-1"
                disabled={loading}
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {(loading || currentRunId) && (
        <div className="card space-y-4 border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white shadow-inner flex items-center justify-center text-indigo-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Gathering suppliers</p>
                <p className="text-xl font-semibold text-gray-900">
                  {progressInfo.total ? `${progressInfo.completed} / ${progressInfo.total} completed` : 'Preparing suppliers'}
                </p>
              </div>
            </div>
            <div className="text-xs text-indigo-700">
              {formattedLastUpdate ? `Updated at ${formattedLastUpdate}` : 'Waiting for first results'}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/80 shadow-inner overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(4, progressPercent)}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="badge badge-success badge-sm">{progressInfo.completed} done</span>
              <span className="badge badge-warning badge-sm">{pendingSuppliers} pending</span>
            </div>
            <span>Refreshes every {(pollInterval / 1000).toFixed(0)}s</span>
          </div>
        </div>
      )}

      {searchResponse && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Results for &quot;{searchResponse.query}&quot;
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total products:</span>
                <span className="ml-2 font-semibold">{searchResponse.items.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Stores:</span>
                <span className="ml-2 font-semibold">
                  {searchResponse.per_supplier.length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Available:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {searchResponse.items.filter((item) => (item.availability ?? 0) > 0).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">With errors:</span>
                <span className="ml-2 font-semibold text-red-600">
                  {searchResponse.per_supplier.filter((s) => s.status === 'error').length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Pending:</span>
                <span className="ml-2 font-semibold text-amber-600">
                  {searchResponse.per_supplier.filter((s) => s.status === 'pending').length}
                </span>
              </div>
            </div>

            {searchResponse.message && (
              <div className="mt-3 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                {searchResponse.message}
              </div>
            )}
          </div>

          {searchResponse.per_supplier.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Stores Status</h3>
              <div className="space-y-2">
                {searchResponse.per_supplier.map((supplier, index) => {
                  const badgeClass = supplier.status === 'success'
                    ? 'badge-success'
                    : supplier.status === 'error'
                      ? 'badge-error'
                      : 'badge-warning';
                  return (
                    <div
                      key={supplier.supplier_id || supplier.supplier_name || index}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{supplier.supplier_name}</span>
                        <span className={`badge ${badgeClass}`}>
                          {supplier.status}
                        </span>
                        <span className="text-sm text-gray-600">
                          {supplier.items_found} items
                        </span>
                        {supplier.status === 'error' && (
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              setErrorLogSupplier(supplier.supplier_name);
                              const combined = [supplier.error_message, supplier.error_details].filter(Boolean).join('\n');
                              setErrorLogText(combined || 'No error details returned.');
                            }}
                          >
                            Log erro
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Products</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span>Out of stock</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={showOutOfStock}
                  onChange={(e) => setShowOutOfStock(e.target.checked)}
                />
              </label>
            </div>
            <ResultsTable
              items={searchResponse.items}
              isLoading={loading && searchResponse.items.length === 0}
              showOutOfStock={showOutOfStock}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderConfigTab = () => (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Config</h2>
      <p className="text-gray-600 mb-4">
        Manage supplier credentials and settings.
      </p>
      <button onClick={goToConfig} className="btn btn-primary">Open Admin</button>
    </div>
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        Checking authentication...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderSearchTab()}
      </main>

      {errorLogText && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Erro fornecedor</p>
                <h4 className="text-lg font-semibold text-gray-900">{errorLogSupplier || 'Desconhecido'}</h4>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setErrorLogText(null);
                  setErrorLogSupplier(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 max-h-80 overflow-auto text-sm whitespace-pre-wrap text-gray-800">
              {errorLogText}
            </div>
            <div className="flex items-center justify-between">
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${errorLogSupplier || 'Supplier'}: ${errorLogText || ''}`
                    );
                  } catch (err) {
                    console.error('Clipboard copy failed', err);
                  }
                }}
              >
                Copiar erro
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setErrorLogText(null);
                  setErrorLogSupplier(null);
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
