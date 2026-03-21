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

/* ─── Label (FeatureStore: uppercase gray) ─── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block select-none text-sm font-medium tracking-wide text-gray-600">
      {children}
    </label>
  );
}

/* ─── Fuzzy search input ─── */
interface TextInputProps {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}
function SearchInput({ value, placeholder, onChange }: TextInputProps) {
  return (
    <div className="relative w-full">
      <Search
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-9 text-[15px] text-gray-800
          placeholder:text-gray-400
          transition-all focus:border-teal-400 focus:bg-white focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ─── FilterBar (visual parity with FeatureStore WideTable FilterBar; instant filter, no Query) ─── */
export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const hasFilter = Boolean(filters.expName || filters.model || filters.owner);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-50 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-teal-500" />
          <span className="text-base font-semibold uppercase tracking-wide text-gray-600">Filters</span>
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>EXPERIMENT NAME</Label>
            <SearchInput
              value={filters.expName}
              placeholder="Search experiment name…"
              onChange={(v) => onChange({ ...filters, expName: v })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>MODEL</Label>
            <SearchInput
              value={filters.model}
              placeholder="Search model name…"
              onChange={(v) => onChange({ ...filters, model: v })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>OWNER</Label>
            <SearchInput
              value={filters.owner}
              placeholder="Search owner…"
              onChange={(v) => onChange({ ...filters, owner: v })}
            />
          </div>
        </div>

        {hasFilter && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-[15px] text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50"
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
