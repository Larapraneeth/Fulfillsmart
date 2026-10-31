import { useState, useEffect } from 'react';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';

export interface OrdersPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  isLoading?: boolean;
}

export function OrdersPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: OrdersPaginationProps) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages && parsed !== currentPage) {
      onPageChange(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const fromRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toRecord = Math.min(currentPage * pageSize, totalCount);

  const canGoPrevious = currentPage > 1 && !isLoading;
  const canGoNext = currentPage < totalPages && !isLoading;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-midnight-900 border border-midnight-700/80 rounded-xl font-mono text-xs">
      {/* Records Count Summary */}
      <div className="text-midnight-400">
        Showing{' '}
        <span className="text-midnight-100 font-semibold">{fromRecord.toLocaleString()}</span>
        {' '}–{' '}
        <span className="text-midnight-100 font-semibold">{toRecord.toLocaleString()}</span>
        {' '}of{' '}
        <span className="text-tactical-teal font-semibold">{totalCount.toLocaleString()}</span>
        {' '}orders
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 mr-2">
          <label htmlFor="page-size-select" className="text-midnight-400 text-[11px]">
            Rows:
          </label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            className="bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/60 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded px-2 py-1 text-xs font-mono text-midnight-200 transition-colors disabled:opacity-50"
            aria-label="Select number of orders per page"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        {/* First Page Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!canGoPrevious}
          className="h-8 w-8 p-0 text-midnight-300 border-midnight-700"
          title="First Page"
          aria-label="Go to first page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>

        {/* Previous Page Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrevious}
          className="h-8 w-8 p-0 text-midnight-300 border-midnight-700"
          title="Previous Page"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Page Jump Input Form */}
        <form onSubmit={handlePageJump} className="flex items-center gap-1.5 mx-1">
          <span className="text-midnight-400 text-[11px]">Page</span>
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageJump}
            disabled={isLoading}
            className="w-12 text-center bg-midnight-950 border border-midnight-700 hover:border-midnight-600 focus:border-tactical-teal/70 focus:outline-none focus:ring-1 focus:ring-tactical-teal/50 rounded px-1 py-1 text-xs font-mono text-tactical-teal font-semibold transition-colors disabled:opacity-50"
            aria-label={`Current page number. Out of ${totalPages}`}
          />
          <span className="text-midnight-400 text-[11px]">of {totalPages.toLocaleString()}</span>
        </form>

        {/* Next Page Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          className="h-8 w-8 p-0 text-midnight-300 border-midnight-700"
          title="Next Page"
          aria-label="Go to next page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        {/* Last Page Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext}
          className="h-8 w-8 p-0 text-midnight-300 border-midnight-700"
          title="Last Page"
          aria-label="Go to last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
