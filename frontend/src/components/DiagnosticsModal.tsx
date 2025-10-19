import React, { useEffect, useState } from 'react';
import { SearchRun } from '@/types';
import { getSearchRun } from '@/utils/api';

interface DiagnosticsModalProps {
  searchRunId: string;
  supplierName: string;
  onClose: () => void;
}

const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  searchRunId,
  supplierName,
  onClose,
}) => {
  const [searchRun, setSearchRun] = useState<SearchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = await getSearchRun(searchRunId);
        setSearchRun(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load diagnostics');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [searchRunId]);

  const formatDuration = (ms: number | undefined): string => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Diagnostics: {supplierName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center py-8 text-gray-500">Loading diagnostics...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {searchRun && (
            <div className="space-y-4">
              {/* Status */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Status</h3>
                <span
                  className={`badge ${
                    searchRun.status === 'success' ? 'badge-success' : 'badge-error'
                  }`}
                >
                  {searchRun.status}
                </span>
              </div>

              {/* Error Information */}
              {searchRun.status === 'error' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Step Failed
                    </h3>
                    <p className="text-gray-800">{searchRun.step_failed || 'Unknown'}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Error Type
                    </h3>
                    <p className="text-gray-800">
                      {searchRun.error_message || 'No error message'}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Error Details
                    </h3>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 text-sm font-mono">
                      {searchRun.error_details || 'No details available'}
                    </p>
                  </div>
                </>
              )}

              {/* Search URL */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Effective Search URL
                </h3>
                <a
                  href={searchRun.search_url_effective}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all text-sm"
                >
                  {searchRun.search_url_effective}
                </a>
              </div>

              {/* HTTP Status */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">HTTP Status</h3>
                <p className="text-gray-800">
                  {searchRun.http_status_search || 'N/A'}
                </p>
              </div>

              {/* Engine */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Engine</h3>
                <span className="badge badge-info">{searchRun.engine}</span>
              </div>

              {/* Durations */}
              {searchRun.durations && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Performance
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Search:</span>
                      <span className="ml-2 font-medium">
                        {formatDuration(searchRun.durations.search_ms)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Extract:</span>
                      <span className="ml-2 font-medium">
                        {formatDuration(searchRun.durations.extract_ms)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <span className="ml-2 font-medium">
                        {formatDuration(searchRun.durations.total_ms)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Selector Counts */}
              {searchRun.selector_counts && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Items Found
                  </h3>
                  <p className="text-gray-800">
                    {searchRun.selector_counts.items || 0} products
                  </p>
                </div>
              )}

              {/* Debug Snapshot */}
              {searchRun.debug_snapshot_url && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Raw HTML Snapshot
                  </h3>
                  <a
                    href={searchRun.debug_snapshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    View snapshot
                  </a>
                </div>
              )}

              {/* Timestamp */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Timestamp</h3>
                <p className="text-gray-800 text-sm">
                  {new Date(searchRun.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="btn btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticsModal;
