import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

export interface FilterValues {
  expName: string;
  model: string;
  owner: string;
}

export const defaultFilters: FilterValues = {
  expName: '',
  model: '',
  owner: '',
};

interface FilterBarProps {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  onReset: () => void;
}

/* ─── Fuzzy search input ─── */
interface TextInputProps {
  id?: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}
function SearchInput({ id, value, placeholder, onChange }: TextInputProps) {
  return (
    <div className="relative w-full min-w-0">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-[15px] text-gray-800
          placeholder:text-gray-400
          transition-colors focus:border-[#13c2c2] focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear filter"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-300 hover:text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

const labelCls =
  'block select-none text-xs font-medium text-gray-600';

/* ─── FilterBar (compact single-row on large screens) ─── */
export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const hasFilter = Boolean(filters.expName || filters.model || filters.owner);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-2">
        <div className="flex shrink-0 items-center gap-2 lg:pb-0.5">
          <div className="h-5 w-1 shrink-0 rounded-full bg-teal-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-exp-name" className={labelCls}>
              Experiment name
            </label>
            <SearchInput
              id="filter-exp-name"
              value={filters.expName}
              placeholder="Search experiment name…"
              onChange={(v) => onChange({ ...filters, expName: v })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-model" className={labelCls}>
              Model
            </label>
            <SearchInput
              id="filter-model"
              value={filters.model}
              placeholder="Search model name…"
              onChange={(v) => onChange({ ...filters, model: v })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-owner" className={labelCls}>
              Owner
            </label>
            <SearchInput
              id="filter-owner"
              value={filters.owner}
              placeholder="Search owner…"
              onChange={(v) => onChange({ ...filters, owner: v })}
            />
          </div>
        </div>

        {hasFilter && (
          <div className="flex justify-end sm:justify-end lg:ml-auto lg:shrink-0">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[15px] text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/25 focus-visible:ring-offset-2"
            >
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
