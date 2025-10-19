'use client';

import React, { useState } from 'react';
import { SearchResponse, SupplierResult } from '@/types';
import { searchProducts } from '@/utils/api';
import ResultsTable from '@/components/ResultsTable';
import DiagnosticsModal from '@/components/DiagnosticsModal';

type Tab = 'search' | 'diagnostics';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<{
    searchRunId: string;
    supplierName: string;
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResponse(null);

    try {
      const response = await searchProducts(query.trim(), false);
      setSearchResponse(response);
    } catch (err: any) {
      setError(err.message || 'Failed to search products');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDiagnostics = (supplier: SupplierResult) => {
    if (supplier.search_run_id) {
      setSelectedDiagnostics({
        searchRunId: supplier.search_run_id,
        supplierName: supplier.supplier_name,
      });
    }
  };

  const renderSearchTab = () => (
    <div className="space-y-6">
      {/* Search Form */}
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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Results */}
      {searchResponse && (
        <div className="space-y-4">
          {/* Summary */}
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
                  {
                    searchResponse.items.filter((item) => (item.availability ?? 0) > 0)
                      .length
                  }
                </span>
              </div>
              <div>
                <span className="text-gray-600">With errors:</span>
                <span className="ml-2 font-semibold text-red-600">
                  {searchResponse.per_supplier.filter((s) => s.status === 'error').length}
                </span>
              </div>
            </div>

            {searchResponse.message && (
              <div className="mt-3 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                {searchResponse.message}
              </div>
            )}
          </div>

          {/* Supplier Status */}
          {searchResponse.per_supplier.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Stores Status</h3>
              <div className="space-y-2">
                {searchResponse.per_supplier.map((supplier, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{supplier.supplier_name}</span>
                      <span
                        className={`badge ${
                          supplier.status === 'success' ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {supplier.status}
                      </span>
                      <span className="text-sm text-gray-600">
                        {supplier.items_found} items
                      </span>
                    </div>
                    {supplier.status === 'error' && supplier.search_run_id && (
                      <button
                        onClick={() => handleViewDiagnostics(supplier)}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        View details
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Products</h3>
            <ResultsTable items={searchResponse.items} />
          </div>
        </div>
      )}
    </div>
  );

  const renderDiagnosticsTab = () => (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Diagnostics</h2>
      <p className="text-gray-600">
        Search for products to see diagnostics. When a store fails, you can view detailed
        error information using the &quot;View details&quot; button in the Search tab.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">ProductScout</h1>
          <p className="text-sm text-gray-600 mt-1">
            Universal automotive parts lookup & comparison
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('search')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'diagnostics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Diagnostics
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'search' ? renderSearchTab() : renderDiagnosticsTab()}
      </main>

      {/* Diagnostics Modal */}
      {selectedDiagnostics && (
        <DiagnosticsModal
          searchRunId={selectedDiagnostics.searchRunId}
          supplierName={selectedDiagnostics.supplierName}
          onClose={() => setSelectedDiagnostics(null)}
        />
      )}
    </div>
  );
}
