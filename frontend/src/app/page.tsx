'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchResponse, SupplierAuthStatus } from '@/types';
import AuthHeader from '@/components/AuthHeader';
import {
  getManualSupplierSessionJob,
  getSupplierAuthStatuses,
  initManualSupplierSession,
  openProgressStream,
  refreshSupplierAuthStatuses,
  startProgressiveSearch
} from '@/utils/api';
import ResultsTable from '@/components/ResultsTable';
type Tab = 'search' | 'config';

const DEFAULT_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_PROGRESS_POLL_MS || '5000');
const SUPPLIER_AUTH_POLL_INTERVAL_MS = 60000;
const MANUAL_JOB_POLL_MS = 3000;

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
  const [manualSessionLoadingSupplier, setManualSessionLoadingSupplier] = useState<string | null>(null);
  const [manualSessionNotice, setManualSessionNotice] = useState<string | null>(null);
  const [supplierAuthStatuses, setSupplierAuthStatuses] = useState<SupplierAuthStatus[]>([]);
  const [supplierAuthLastUpdate, setSupplierAuthLastUpdate] = useState<string | null>(null);
  const [supplierAuthLoading, setSupplierAuthLoading] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [supplierSelectionTouched, setSupplierSelectionTouched] = useState(false);
  const [manualSessionJobId, setManualSessionJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const pendingSuppliers = Math.max(progressInfo.total - progressInfo.completed, 0);
  const hasProgressTotals = progressInfo.total > 0;
  const computedPercent = hasProgressTotals
    ? (progressInfo.completed / Math.max(progressInfo.total, 1)) * 100
    : (loading || currentRunId ? 20 : 0);
  const progressPercent = Math.min(100, Math.max(0, computedPercent));
  const formattedLastUpdate = lastProgressUpdate ? new Date(lastProgressUpdate).toLocaleTimeString() : null;
  const selectedSupplierCount = selectedSupplierIds.length;
  const hasSelectedSuppliers = selectedSupplierCount > 0;
  const allSuppliersSelected =
    supplierAuthStatuses.length > 0 && selectedSupplierCount === supplierAuthStatuses.length;
  const someSuppliersSelected =
    selectedSupplierCount > 0 && selectedSupplierCount < supplierAuthStatuses.length;
  const supplierSelectionSet = useMemo(() => new Set(selectedSupplierIds), [selectedSupplierIds]);

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

  const loadSupplierAuthStatus = async (forceRefresh = false) => {
    try {
      setSupplierAuthLoading(true);
      const payload = forceRefresh
        ? await refreshSupplierAuthStatuses()
        : await getSupplierAuthStatuses();
      setSupplierAuthStatuses(payload.items || []);
      setSupplierAuthLastUpdate(payload.updated_at || new Date().toISOString());
    } catch (err) {
      console.error('Failed to load supplier auth status', err);
    } finally {
      setSupplierAuthLoading(false);
    }
  };

  const scheduleSupplierAuthRefreshBurst = () => {
    const delays = [1500, 4000, 9000];
    for (const delayMs of delays) {
      setTimeout(() => {
        loadSupplierAuthStatus(true).catch(() => {});
      }, delayMs);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    loadSupplierAuthStatus(true);
    const ref = setInterval(() => {
      loadSupplierAuthStatus(false);
    }, SUPPLIER_AUTH_POLL_INTERVAL_MS);
    return () => clearInterval(ref);
  }, [authChecked]);

  useEffect(() => {
    const availableIds = supplierAuthStatuses.map((supplier) => supplier.supplier_id);
    const availableSet = new Set(availableIds);

    setSelectedSupplierIds((previous) => {
      if (!supplierSelectionTouched) {
        return availableIds;
      }
      return previous.filter((supplierId) => availableSet.has(supplierId));
    });
  }, [supplierAuthStatuses, supplierSelectionTouched]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSuppliersSelected;
  }, [someSuppliersSelected]);

  const isManualSessionRequired = (supplierName?: string, details?: string): boolean => {
    const name = String(supplierName || '').toUpperCase();
    const body = String(details || '').toUpperCase();
    return name.includes('GSMART') && body.includes('GSMART_SESSION_EXPIRED');
  };

  const detectBrowserPreference = (): string => {
    if (typeof navigator === 'undefined') return '';
    const ua = String(navigator.userAgent || '').toLowerCase();
    if (ua.includes('edg/')) return 'msedge';
    if (ua.includes('chrome/')) return 'chrome';
    return '';
  };

  const startSupplierSession = async (supplierName: string) => {
    const normalized = String(supplierName || '').trim().toUpperCase();
    if (!normalized) return;

    setError(null);
    setManualSessionNotice(
      `A iniciar sessão manual de ${normalized}. Se não vires a janela, verifica o browser/alt-tab.`
    );
    setManualSessionLoadingSupplier(normalized);

    try {
      const response = await initManualSupplierSession(
        normalized,
        activeQuery || query || '364624',
        detectBrowserPreference(),
        'cdp'
      );
      setManualSessionNotice(response.message || `${normalized} session initialization started.`);
      if (response.job_id) {
        setManualSessionJobId(response.job_id);
      } else {
        setManualSessionLoadingSupplier(null);
        await loadSupplierAuthStatus(true);
      }
    } catch (err: any) {
      const message = String(err?.message || `Failed to initialize ${normalized} session`);
      if (message.toLowerCase().includes('already in progress')) {
        setManualSessionNotice(
          `Já existe uma inicialização de sessão ${normalized} em curso. Conclui o login/captcha na janela aberta.`
        );
      } else {
        setError(message);
      }
      setManualSessionLoadingSupplier(null);
    }
  };

  useEffect(() => {
    if (!manualSessionJobId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await getManualSupplierSessionJob(manualSessionJobId);
        if (cancelled) return;

        if (job.status === 'success') {
          setManualSessionNotice(job.message || `${job.supplier_name} session initialized successfully.`);
          setManualSessionLoadingSupplier(null);
          setManualSessionJobId(null);
          await loadSupplierAuthStatus(true);
          scheduleSupplierAuthRefreshBurst();
          return;
        }

        if (job.status === 'error') {
          const message = job.error || job.message || `Failed to initialize ${job.supplier_name} session`;
          if (String(message).includes('CDP_NOT_AVAILABLE')) {
            setManualSessionNotice(message);
          } else {
            setError(message);
          }
          setManualSessionLoadingSupplier(null);
          setManualSessionJobId(null);
          await loadSupplierAuthStatus(true);
          scheduleSupplierAuthRefreshBurst();
          return;
        }

        setManualSessionNotice(job.message || `Manual login in progress for ${job.supplier_name}.`);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to poll manual session job', err);
      }
    };

    poll();
    const ref = setInterval(poll, MANUAL_JOB_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(ref);
    };
  }, [manualSessionJobId]);

  const handleCancelSearch = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setLoading(false);
    setCurrentRunId(null);
    setProgressInfo({ total: 0, completed: 0, done: false });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Introduza um termo de pesquisa');
      return;
    }
    if (!hasSelectedSuppliers) {
      setError('Seleccione pelo menos um fornecedor para pesquisar');
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
    setManualSessionNotice(null);
    setActiveQuery(trimmedQuery);

    try {
      const startResponse = await startProgressiveSearch(trimmedQuery, false, selectedSupplierIds);

      if (startResponse.fallback) {
        setSearchResponse(startResponse.fallback);
        setProgressInfo({ total: 0, completed: 0, done: true });
        setLoading(false);
        return;
      }

      if (!startResponse.run_id) {
        throw new Error('Não foi possível iniciar a pesquisa');
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
      setError(err.message || 'Falha ao iniciar a pesquisa');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentRunId) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    const es = openProgressStream(
      currentRunId,
      (data) => {
        setSearchResponse({
          query: data.query,
          items: data.items || [],
          per_supplier: data.per_supplier || [],
          message: data.message,
          summary: data.summary
        });
        setProgressInfo({
          total: data.total_suppliers ?? 0,
          completed: data.completed_suppliers ?? 0,
          done: Boolean(data.done)
        });
        setLastProgressUpdate(data.last_update || new Date().toISOString());

        if (data.done) {
          es.close();
          esRef.current = null;
          setLoading(false);
          setCurrentRunId(null);
        }
      },
      () => {
        // Ignore onerror if stream already completed normally
        if (!esRef.current) return;
        console.error('SSE connection error for run:', currentRunId);
        setError('Falha na ligação ao servidor de pesquisa');
        setLoading(false);
        setCurrentRunId(null);
      }
    );

    esRef.current = es;

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [currentRunId]);

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

  const getSupplierStateBadgeClass = (state: SupplierAuthStatus['state']): string => {
    if (state === 'READY') return 'badge-success';
    if (state === 'CHECKING') return 'badge-info';
    if (state === 'MANUAL_REQUIRED') return 'badge-warning';
    if (state === 'DISABLED') return 'badge-info';
    return 'badge-error';
  };

  const getSupplierStateLabel = (state: SupplierAuthStatus['state']): string => {
    if (state === 'READY') return 'OK';
    if (state === 'CHECKING') return 'A verificar';
    if (state === 'MANUAL_REQUIRED') return 'Login manual';
    if (state === 'DISABLED') return 'Desactivado';
    return 'Erro';
  };

  const toggleSupplierSelection = (supplierId: string) => {
    setSupplierSelectionTouched(true);
    setSelectedSupplierIds((previous) =>
      previous.includes(supplierId)
        ? previous.filter((id) => id !== supplierId)
        : [...previous, supplierId]
    );
  };

  const selectReadySuppliers = () => {
    setSupplierSelectionTouched(true);
    setSelectedSupplierIds(
      supplierAuthStatuses
        .filter((supplier) => supplier.state === 'READY')
        .map((supplier) => supplier.supplier_id)
    );
  };

  const toggleSelectAllSuppliers = () => {
    setSupplierSelectionTouched(true);
    setSelectedSupplierIds((previous) => {
      if (previous.length === supplierAuthStatuses.length) {
        return [];
      }
      return supplierAuthStatuses.map((supplier) => supplier.supplier_id);
    });
  };

  const renderSearchTab = () => (
    <div className="space-y-6">
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Pesquisar produtos
            </label>
            <p className="text-xs text-gray-500 mb-2">
              A pesquisa será feita em {selectedSupplierCount} fornecedor{selectedSupplierCount === 1 ? '' : 'es'} seleccionado{selectedSupplierCount === 1 ? '' : 's'}.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ex: 'filtro oleo' ou '364624'"
                className="input flex-1"
                disabled={loading}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !hasSelectedSuppliers}>
                {loading ? 'A pesquisar...' : hasSelectedSuppliers ? 'Pesquisar' : 'Seleccione fornecedores'}
              </button>
              {loading && (
                <button type="button" className="btn btn-secondary" onClick={handleCancelSearch}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sessões dos fornecedores</h3>
            <p className="text-sm text-gray-600">
              Apenas fornecedores activos. Estado actualizado a cada {(SUPPLIER_AUTH_POLL_INTERVAL_MS / 1000).toFixed(0)}s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={allSuppliersSelected}
                onChange={toggleSelectAllSuppliers}
                disabled={supplierAuthStatuses.length === 0}
              />
              <span>Seleccionar todos</span>
            </label>
            <span className="text-xs font-medium text-gray-700">
              {selectedSupplierCount}/{supplierAuthStatuses.length} seleccionados
            </span>
            <button
              className="btn btn-ghost btn-xs"
              onClick={selectReadySuppliers}
              disabled={supplierAuthStatuses.length === 0}
            >
              Apenas prontos
            </button>
            {supplierAuthLastUpdate && (
              <span className="text-xs text-gray-500">
                Actualizado às {new Date(supplierAuthLastUpdate).toLocaleTimeString()}
              </span>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => loadSupplierAuthStatus(true)}
              disabled={supplierAuthLoading}
            >
              {supplierAuthLoading ? 'A actualizar...' : 'Actualizar agora'}
            </button>
          </div>
        </div>

        {supplierAuthStatuses.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhum fornecedor activo encontrado.</div>
        ) : (
          <div className="space-y-2">
            {supplierAuthStatuses.map((supplier) => (
              <div
                key={supplier.supplier_id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded border cursor-pointer ${
                  supplierSelectionSet.has(supplier.supplier_id)
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-transparent'
                }`}
                onClick={() => toggleSupplierSelection(supplier.supplier_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleSupplierSelection(supplier.supplier_id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={supplierSelectionSet.has(supplier.supplier_id)}
                    onChange={() => toggleSupplierSelection(supplier.supplier_id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${supplier.supplier_name}`}
                  />
                  <span className="font-medium">{supplier.supplier_name}</span>
                  <span className={`badge ${getSupplierStateBadgeClass(supplier.state)}`}>
                    {getSupplierStateLabel(supplier.state)}
                  </span>
                  {supplier.reason_text && (
                    <span className="text-xs text-gray-600">{supplier.reason_text}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {supplier.state === 'MANUAL_REQUIRED' && supplier.manual_supported && (
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        startSupplierSession(supplier.supplier_name);
                      }}
                      disabled={manualSessionLoadingSupplier === supplier.supplier_name.toUpperCase()}
                    >
                      {manualSessionLoadingSupplier === supplier.supplier_name.toUpperCase()
                        ? 'A iniciar...'
                        : 'Login manual'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {manualSessionNotice && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {manualSessionNotice}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">A consultar fornecedores</p>
                <p className="text-xl font-semibold text-gray-900">
                  {progressInfo.total ? `${progressInfo.completed} / ${progressInfo.total} concluídos` : 'A preparar fornecedores'}
                </p>
              </div>
            </div>
            <div className="text-xs text-indigo-700">
              {formattedLastUpdate ? `Actualizado às ${formattedLastUpdate}` : 'À espera dos primeiros resultados'}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Progresso</span>
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
              <span className="badge badge-success badge-sm">{progressInfo.completed} concluídos</span>
              <span className="badge badge-warning badge-sm">{pendingSuppliers} em curso</span>
            </div>
            <span>Actualiza a cada {(pollInterval / 1000).toFixed(0)}s</span>
          </div>
        </div>
      )}

      {searchResponse && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Resultados para &quot;{searchResponse.query}&quot;
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-600">Produtos encontrados:</span>
                <span className="ml-2 font-semibold">{searchResponse.items.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Fornecedores:</span>
                <span className="ml-2 font-semibold">
                  {searchResponse.summary?.suppliers_total ?? searchResponse.per_supplier.length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Disponíveis:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {searchResponse.summary?.available_items ?? searchResponse.items.filter((item) => (item.availability ?? 0) > 0).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Com erros:</span>
                <span className="ml-2 font-semibold text-red-600">
                  {searchResponse.summary?.suppliers_error ?? searchResponse.per_supplier.filter((s) => s.status === 'error').length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Em curso:</span>
                <span className="ml-2 font-semibold text-amber-600">
                  {searchResponse.summary?.suppliers_pending ?? searchResponse.per_supplier.filter((s) => s.status === 'pending').length}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Estado dos fornecedores</h3>
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
                          {supplier.items_found} artigos
                        </span>
                        {supplier.status === 'error' && (
                          <>
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => {
                                setErrorLogSupplier(supplier.supplier_name);
                                const combined = [supplier.error_message, supplier.error_details].filter(Boolean).join('\n');
                                setErrorLogText(combined || 'Sem detalhes de erro disponíveis.');
                              }}
                            >
                              Log erro
                            </button>
                            {isManualSessionRequired(
                              supplier.supplier_name,
                              [supplier.error_message, supplier.error_details].filter(Boolean).join('\n')
                            ) && (
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => startSupplierSession('GSMART')}
                                disabled={manualSessionLoadingSupplier === 'GSMART'}
                              >
                                {manualSessionLoadingSupplier === 'GSMART' ? 'A iniciar...' : 'Login manual'}
                              </button>
                            )}
                          </>
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
              <h3 className="text-lg font-semibold text-gray-900">Produtos</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span>Sem stock</span>
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
        A verificar autenticação...
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
              <div className="flex items-center gap-2">
                {isManualSessionRequired(errorLogSupplier || '', errorLogText || '') && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => startSupplierSession('GSMART')}
                    disabled={manualSessionLoadingSupplier === 'GSMART'}
                  >
                    {manualSessionLoadingSupplier === 'GSMART' ? 'A iniciar...' : 'Iniciar sessão manual'}
                  </button>
                )}
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
        </div>
      )}
    </div>
  );
}
