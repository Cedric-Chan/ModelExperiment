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
    <label className="text-xs text-gray-500 tracking-wide block select-none">
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
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-8 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg
          placeholder:text-gray-400 text-gray-700
          focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X size={12} />
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-teal-500 rounded-full" />
          <span className="text-sm text-gray-500 tracking-wide uppercase">Filters</span>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
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
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
