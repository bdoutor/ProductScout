import React, { useEffect, useMemo, useState } from 'react';
import { ProductItem } from '@/types';

interface ResultsTableProps {
  items: ProductItem[];
  onViewDetails?: (item: ProductItem) => void;
  isLoading?: boolean;
  showOutOfStock?: boolean;
}

type SortColumn = 'store' | 'product' | 'code' | 'price' | 'availability';
type SortDirection = 'asc' | 'desc';
type AvailabilityFilter = 'all' | 'in_stock' | 'out_of_stock' | 'unknown';

interface SortConfig {
  column: SortColumn;
  direction: SortDirection;
}

interface ColumnFilters {
  store: string;
  product: string;
  code: string;
  price: string;
  availability: AvailabilityFilter;
}

const RESULTS_PER_PAGE = 25;
const STOCK_LABEL_REGEX = /(stock|dispon(?:i|\u00ED)vel|available)/i;
const OUT_OF_STOCK_REGEX = /(out\s*of\s*stock|sem\s*stock|sem\s+disponibilidade|indispon(?:i|\u00ed)vel|esgotado)/i;

const DEFAULT_FILTERS: ColumnFilters = {
  store: '',
  product: '',
  code: '',
  price: '',
  availability: 'all',
};

const hasStock = (item: ProductItem): boolean => {
  const availability = typeof item.availability === 'number' ? item.availability : null;
  const label = item.availability_label ? item.availability_label.trim() : null;

  if (availability !== null && availability > 0) {
    return true;
  }
  if (availability !== null && availability <= 0) {
    return false;
  }

  if (label && OUT_OF_STOCK_REGEX.test(label.toLowerCase())) {
    return false;
  }

  if (label) {
    const numeric = parseInt(label.replace(/[^\d-]/g, ''), 10);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return true;
    }
    if (/[>+]/.test(label) || STOCK_LABEL_REGEX.test(label)) {
      return true;
    }
  }
  return false;
};

const formatPrice = (price: number | null): string => {
  if (price === null || isNaN(price)) return 'N/A';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
};

const getAvailabilityText = (item: ProductItem): string => {
  const availability = item.availability;
  const label = item.availability_label ? item.availability_label.trim() : null;

  if (typeof availability === 'number' && availability < 0) {
    return 'Contacte o fornecedor';
  }

  if (hasStock(item)) {
    if (label) {
      return label;
    }
    if (typeof availability === 'number' && availability > 1) {
      return `${availability} em stock`;
    }
    return 'Em stock';
  }

  if ((availability === null || Number.isNaN(availability)) && !label) {
    return 'Desconhecido';
  }

  return label || 'Sem stock';
};

const getAvailabilityBucket = (item: ProductItem): AvailabilityFilter => {
  const availability = item.availability;
  const label = item.availability_label ? item.availability_label.trim() : null;

  if (typeof availability === 'number' && availability < 0) {
    return 'unknown';
  }
  if (hasStock(item)) {
    return 'in_stock';
  }
  if ((availability === null || Number.isNaN(availability)) && !label) {
    return 'unknown';
  }
  return 'out_of_stock';
};

const ResultsTable: React.FC<ResultsTableProps> = ({ items, isLoading = false, showOutOfStock = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<ColumnFilters>(DEFAULT_FILTERS);

  const filteredItems = useMemo((): ProductItem[] => {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const baseItems = showOutOfStock ? items : items.filter(hasStock);

    return baseItems.filter((item) => {
      const storeText = (item.store || '').toLowerCase();
      const productText = (item.name || '').toLowerCase();
      const codeText = (item.code || '').toLowerCase();
      const priceText = `${item.price ?? ''} ${formatPrice(item.price).toLowerCase()}`;
      const availabilityBucket = getAvailabilityBucket(item);

      const storeMatch = !filters.store || storeText.includes(filters.store.toLowerCase());
      const productMatch = !filters.product || productText.includes(filters.product.toLowerCase());
      const codeMatch = !filters.code || codeText.includes(filters.code.toLowerCase());
      const priceMatch = !filters.price || priceText.includes(filters.price.toLowerCase());
      const availabilityMatch = filters.availability === 'all' || availabilityBucket === filters.availability;

      return storeMatch && productMatch && codeMatch && priceMatch && availabilityMatch;
    });
  }, [items, showOutOfStock, filters]);

  const displayItems = useMemo((): ProductItem[] => {
    if (!sortConfig) {
      return filteredItems;
    }

    const getSortValue = (item: ProductItem): string | number => {
      switch (sortConfig.column) {
        case 'store':
          return item.store || '';
        case 'product':
          return item.name || '';
        case 'code':
          return item.code || '';
        case 'price':
          return typeof item.price === 'number' ? item.price : Number.POSITIVE_INFINITY;
        case 'availability':
          return getAvailabilityText(item).toLowerCase();
        default:
          return '';
      }
    };

    const directionFactor = sortConfig.direction === 'asc' ? 1 : -1;

    return filteredItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const valueA = getSortValue(a.item);
        const valueB = getSortValue(b.item);

        let comparison = 0;
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          comparison = valueA - valueB;
        } else {
          comparison = String(valueA).localeCompare(String(valueB), 'pt', { sensitivity: 'base' });
        }

        if (comparison !== 0) {
          return comparison * directionFactor;
        }

        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [filteredItems, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(displayItems.length / RESULTS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [items, showOutOfStock, sortConfig, filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (column: SortColumn) => {
    setSortConfig((previous) => {
      if (!previous || previous.column !== column) {
        return { column, direction: 'asc' };
      }
      if (previous.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      return null;
    });
  };

  const setFilter = <K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const getSortIndicator = (column: SortColumn): string => {
    if (!sortConfig || sortConfig.column !== column) {
      return ' ';
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const formatAvailability = (item: ProductItem): React.ReactNode => {
    const availabilityText = getAvailabilityText(item);
    const availability = item.availability;
    const label = item.availability_label ? item.availability_label.trim() : null;

    if (typeof availability === 'number' && availability < 0) {
      return <span className="text-gray-400">{availabilityText}</span>;
    }

    if (hasStock(item)) {
      return <span className="badge badge-success">{availabilityText}</span>;
    }

    if ((availability === null || Number.isNaN(availability)) && !label) {
      return <span className="text-gray-400">{availabilityText}</span>;
    }

    return <span className="badge badge-error">{availabilityText}</span>;
  };

  if (isLoading && (!Array.isArray(items) || items.length === 0)) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full" role="status">
          <span className="sr-only">A carregar...</span>
        </div>
        <p className="mt-2 text-gray-600">A pesquisar produtos...</p>
      </div>
    );
  }

  if (!Array.isArray(items)) {
    return (
      <div className="text-center py-12 text-red-600">
        Erro: formato de resultados inválido
      </div>
    );
  }

  const hiddenDueToStock = !showOutOfStock && items.some((item) => !hasStock(item));
  const pageStart = (currentPage - 1) * RESULTS_PER_PAGE;
  const pageEnd = pageStart + RESULTS_PER_PAGE;
  const pageItems = displayItems.slice(pageStart, pageEnd);
  const currentStart = displayItems.length > 0 ? pageStart + 1 : 0;
  const currentEnd = Math.min(pageEnd, displayItems.length);

  if (displayItems.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum produto encontrado</h3>
          <p className="mt-2 text-sm text-gray-500">
            {hiddenDueToStock
              ? 'Todos os resultados actuais estão sem stock. Active "Sem stock" para os ver.'
              : 'Não foram encontrados produtos correspondentes à pesquisa/filtro.'}
          </p>
          {!hiddenDueToStock && (
            <div className="mt-6">
              <ul className="text-sm text-gray-600 space-y-2 text-left max-w-sm mx-auto">
                <li className="flex items-center">
                  <span className="mr-2">-</span>
                  Verifique se a referência está correcta
                </li>
                <li className="flex items-center">
                  <span className="mr-2">-</span>
                  Tente usar menos palavras-chave ou palavras diferentes
                </li>
                <li className="flex items-center">
                  <span className="mr-2">-</span>
                  Remova caracteres especiais
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table w-full">
        <thead>
          <tr>
            <th className="text-left">
              <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => handleSort('store')}>
                Fornecedor {getSortIndicator('store')}
              </button>
            </th>
            <th className="text-left">
              <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => handleSort('product')}>
                Produto {getSortIndicator('product')}
              </button>
            </th>
            <th className="text-left">
              <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => handleSort('code')}>
                Referência {getSortIndicator('code')}
              </button>
            </th>
            <th className="text-right">
              <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => handleSort('price')}>
                Preço {getSortIndicator('price')}
              </button>
            </th>
            <th className="text-left">
              <button type="button" className="btn btn-ghost btn-xs px-1" onClick={() => handleSort('availability')}>
                Disponibilidade {getSortIndicator('availability')}
              </button>
            </th>
            <th className="text-left">Acções</th>
          </tr>
          <tr>
            <th>
              <input
                type="text"
                className="input input-sm w-full"
                placeholder="Filtrar fornecedor..."
                value={filters.store}
                onChange={(e) => setFilter('store', e.target.value)}
              />
            </th>
            <th>
              <input
                type="text"
                className="input input-sm w-full"
                placeholder="Filtrar produto..."
                value={filters.product}
                onChange={(e) => setFilter('product', e.target.value)}
              />
            </th>
            <th>
              <input
                type="text"
                className="input input-sm w-full"
                placeholder="Filtrar referência..."
                value={filters.code}
                onChange={(e) => setFilter('code', e.target.value)}
              />
            </th>
            <th>
              <input
                type="text"
                className="input input-sm w-full text-right"
                placeholder="Filtrar preço..."
                value={filters.price}
                onChange={(e) => setFilter('price', e.target.value)}
              />
            </th>
            <th>
              <select
                className="select select-sm w-full"
                value={filters.availability}
                onChange={(e) => setFilter('availability', e.target.value as AvailabilityFilter)}
              >
                <option value="all">Todos</option>
                <option value="in_stock">Em stock</option>
                <option value="out_of_stock">Sem stock</option>
                <option value="unknown">Desconhecido</option>
              </select>
            </th>
            <th>
              <button type="button" className="btn btn-xs btn-outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Limpar
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((item, index) => (
            <tr
              key={`${item.store}-${item.code}-${pageStart + index}`}
              className={`
                hover:bg-gray-50
                ${!hasStock(item) ? 'opacity-60' : ''}
                ${!item.price ? 'opacity-75' : ''}
              `}
            >
              <td className="font-medium">{item.store || 'Desconhecido'}</td>
              <td className="max-w-md">
                <div className="truncate font-normal" title={item.name}>{item.name || 'Produto sem nome'}</div>
              </td>
              <td className="text-gray-600 font-mono text-sm">{item.code || '-'}</td>
              <td className="font-semibold text-blue-600 text-right">{formatPrice(item.price)}</td>
              <td>{formatAvailability(item)}</td>
              <td>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm inline-flex items-center gap-1"
                  >
                    Ver no site
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <span className="text-gray-400 text-sm">Sem link</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-between gap-4 text-sm text-gray-500">
        <div>
          A mostrar {currentStart}-{currentEnd} de {displayItems.length} resultado{displayItems.length !== 1 ? 's' : ''}
          {!showOutOfStock ? ' — só em stock' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
          >
            Anterior
          </button>
          <span className="min-w-24 text-center">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
          >
            Seguinte
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsTable;
