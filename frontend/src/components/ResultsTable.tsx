import React from 'react';
import { ProductItem } from '@/types';

interface ResultsTableProps {
  items: ProductItem[];
  onViewDetails?: (item: ProductItem) => void;
  isLoading?: boolean;
  showOutOfStock?: boolean;
}

const MAX_ROWS_PER_SUPPLIER = 5;
const STOCK_LABEL_REGEX = /(stock|dispon(?:i|\u00ED)vel|available)/i;
const OUT_OF_STOCK_REGEX = /(out\s*of\s*stock|sem\s*stock|sem\s+disponibilidade|indispon[ií]vel|esgotado)/i;

const hasStock = (item: ProductItem): boolean => {
  const availability = typeof item.availability === 'number' ? item.availability : null;
  const label = item.availability_label ? item.availability_label.trim() : null;

  // Explicit zero/negative availability wins
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

const priceComparator = (a: ProductItem, b: ProductItem): number => {
  const priceA = typeof a.price === 'number' ? a.price : Number.POSITIVE_INFINITY;
  const priceB = typeof b.price === 'number' ? b.price : Number.POSITIVE_INFINITY;
  if (priceA === priceB) {
    return (a.store || '').localeCompare(b.store || '');
  }
  return priceA - priceB;
};

const ResultsTable: React.FC<ResultsTableProps> = ({ items, isLoading = false, showOutOfStock = false }) => {
  const formatPrice = (price: number | null): string => {
    if (price === null || isNaN(price)) return 'N/A';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
  };

  const formatAvailability = (item: ProductItem): React.ReactNode => {
    const availability = item.availability;
    const label = item.availability_label ? item.availability_label.trim() : null;

    if (typeof availability === 'number' && availability < 0) {
      return <span className="text-gray-400">Contact store</span>;
    }

    if (hasStock(item)) {
      const baseValue = label || (typeof availability === 'number' && availability > 1 ? `${availability}` : null);
      const display = baseValue ? `${baseValue} in stock` : 'In stock';
      return <span className="badge badge-success">{display}</span>;
    }

    if ((availability === null || Number.isNaN(availability)) && !label) {
      return <span className="text-gray-400">Unknown</span>;
    }

    return <span className="badge badge-error">Out of stock</span>;
  };

  const buildDisplayItems = (): ProductItem[] => {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const grouped = new Map<string, ProductItem[]>();

    items.forEach((item) => {
      const key = item.store || 'Unknown';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    const limited: ProductItem[] = [];

    grouped.forEach((groupItems) => {
      const sortedGroup = [...groupItems].sort(priceComparator);
      const stocked = sortedGroup.filter(hasStock);
      const outOfStockItems = sortedGroup.filter((product) => !hasStock(product));
      const ordered = [...stocked, ...outOfStockItems];
      const bucket: ProductItem[] = [];

      for (const candidate of ordered) {
        if (!showOutOfStock && !hasStock(candidate)) {
          continue;
        }
        bucket.push(candidate);
        if (bucket.length === MAX_ROWS_PER_SUPPLIER) {
          break;
        }
      }

      limited.push(...bucket);
    });

    return limited.sort(priceComparator);
  };

  if (isLoading && (!Array.isArray(items) || items.length === 0)) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-2 text-gray-600">Searching products...</p>
      </div>
    );
  }

  if (!Array.isArray(items)) {
    return (
      <div className="text-center py-12 text-red-600">
        Error: Invalid results format
      </div>
    );
  }

  const displayItems = buildDisplayItems();
  const hiddenDueToStock = !showOutOfStock && items.some((item) => !hasStock(item));

  if (displayItems.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No products found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {hiddenDueToStock
              ? 'All current results are out of stock. Enable the "Out of stock" toggle to view them.'
              : "We couldn't find any products matching your search."}
          </p>
          {!hiddenDueToStock && (
            <div className="mt-6">
              <ul className="text-sm text-gray-600 space-y-2 text-left max-w-sm mx-auto">
                <li className="flex items-center">
                  <span className="mr-2">-</span>
                  Check if the product code is correct
                </li>
                <li className="flex items-center">
                  <span className="mr-2">-</span>
                  Try using fewer or different keywords
                </li>
                <li className="flex items-center">
                  <span className="mr-2">-</span>
                  Remove any special characters
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
            <th className="text-left">Store</th>
            <th className="text-left">Product</th>
            <th className="text-left">Code</th>
            <th className="text-right">Price</th>
            <th className="text-left">Availability</th>
            <th className="text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, index) => (
            <tr
              key={`${item.store}-${item.code}-${index}`}
              className={`
                hover:bg-gray-50
                ${!hasStock(item) ? 'opacity-60' : ''}
                ${!item.price ? 'opacity-75' : ''}
              `}
            >
              <td className="font-medium">{item.store || 'Unknown'}</td>
              <td className="max-w-md">
                <div className="truncate font-normal" title={item.name}>{item.name || 'Unnamed Product'}</div>
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
                    View on site
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <span className="text-gray-400 text-sm">No link available</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 text-right text-sm text-gray-500">
        Showing {displayItems.length} of {items.length} result{items.length !== 1 ? 's' : ''} (max {MAX_ROWS_PER_SUPPLIER} per store)
        {!showOutOfStock ? ' - in stock only' : ''}
      </div>
    </div>
  );
};

export default ResultsTable;
