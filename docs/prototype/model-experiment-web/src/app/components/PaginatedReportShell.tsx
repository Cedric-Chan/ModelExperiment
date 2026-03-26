import React, { useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE = 100;

const DEFAULT_PLACEHOLDER = 'Filter by feature (var)…';

export function PaginatedReportShell({
  query,
  onQueryChange,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
  filteredCount,
  page,
  totalPages,
  onPageChange,
  toolbarEnd,
  children,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  searchPlaceholder?: string;
  filteredCount: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  toolbarEnd?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pageNums = useMemo(() => {
    const nums: number[] = [];
    const delta = 2;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - delta && p <= page + delta)) nums.push(p);
    }
    return nums;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col min-h-0 flex-1 border border-slate-100 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/80 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder-slate-400
              focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20"
          />
        </div>
        {toolbarEnd}
        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
          {filteredCount.toLocaleString()} match{filteredCount !== 1 ? 'es' : ''}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto max-h-[min(48vh,520px)]">{children}</div>
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-slate-100 bg-white shrink-0 flex-wrap">
        <span className="text-[11px] text-slate-400">
          {filteredCount.toLocaleString()} row{filteredCount !== 1 ? 's' : ''} · {PAGE_SIZE} / page
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500
              hover:border-[#13c2c2] hover:text-[#13c2c2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          {pageNums.map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && pageNums[i - 1] !== p - 1 && <span className="w-6 text-center text-[10px] text-slate-400">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[1.75rem] h-7 px-1 text-[11px] rounded border transition-colors
                  ${page === p ? 'bg-[#13c2c2] border-[#13c2c2] text-white font-semibold' : 'border-slate-200 text-slate-600 hover:border-[#13c2c2] hover:text-[#13c2c2]'}`}
              >
                {p}
              </button>
            </React.Fragment>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500
              hover:border-[#13c2c2] hover:text-[#13c2c2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
