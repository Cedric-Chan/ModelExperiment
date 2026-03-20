import React from 'react';
import { Search, X } from 'lucide-react';

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

/* ─── Label ─── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block select-none">
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
        size={13}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-8 pr-8 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-700
          placeholder-slate-300
          hover:border-[#13c2c2]/50
          focus:outline-none focus:border-[#13c2c2] focus:ring-2 focus:ring-[#13c2c2]/15
          transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/* ─── FilterBar ─── */
export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const hasFilter = filters.expName || filters.model || filters.owner;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4">
      <div className="flex items-end gap-5 flex-wrap">

        {/* Exp Name */}
        <div className="flex flex-col min-w-[220px] flex-1 max-w-[360px]">
          <Label>Experiment Name</Label>
          <SearchInput
            value={filters.expName}
            placeholder="Search experiment name…"
            onChange={(v) => onChange({ ...filters, expName: v })}
          />
        </div>

        {/* Model */}
        <div className="flex flex-col min-w-[180px] flex-1 max-w-[280px]">
          <Label>Model</Label>
          <SearchInput
            value={filters.model}
            placeholder="Search model name…"
            onChange={(v) => onChange({ ...filters, model: v })}
          />
        </div>

        {/* Owner */}
        <div className="flex flex-col min-w-[160px] flex-1 max-w-[240px]">
          <Label>Owner</Label>
          <SearchInput
            value={filters.owner}
            placeholder="Search owner…"
            onChange={(v) => onChange({ ...filters, owner: v })}
          />
        </div>

        {/* Reset */}
        {hasFilter && (
          <div className="flex flex-col justify-end shrink-0">
            {/* phantom label height */}
            <div className="mb-1.5 h-[15px]" />
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 text-sm text-slate-400
                hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50/60 transition-all"
            >
              <X size={13} />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
