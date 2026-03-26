import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, ListChecks } from 'lucide-react';
import { PAGE_SIZE, PaginatedReportShell } from './PaginatedReportShell';

const MOCK_ROW_COUNT = 1200;

export interface FeatureSelectionReportModalProps {
  onClose: () => void;
  runId: string;
  activeMethods: string[];
  ivThreshold: number;
  corrThreshold: number;
  psiThreshold: number;
  lastRunHasSelectionReport: boolean;
}

function seededRand(seed: string, i: number): number {
  let h = 0;
  for (let k = 0; k < seed.length; k++) h = (h << 5) - h + seed.charCodeAt(k);
  const x = Math.sin(h * 0.001 + i * 49297) * 10000;
  return x - Math.floor(x);
}

const MOCK_PREFIXES = [
  'device_hf_battery_voltage',
  'txn_amt_7d_sum',
  'credit_util_ratio',
  'age_bin_score',
  'region_risk_tag',
  'app_session_cnt_30d',
];

function genFeatureNames(): string[] {
  const out: string[] = [];
  for (let i = 0; i < MOCK_ROW_COUNT; i++) {
    const base = MOCK_PREFIXES[i % MOCK_PREFIXES.length];
    out.push(`${base}_${String(i + 1).padStart(4, '0')}`);
  }
  return out;
}

export type SelectionReportRow = {
  feature: string;
  finalSelected: boolean;
  iv: number;
  gini_train: number;
  gini_test: number;
  psi: number;
} & Record<string, number | string | boolean>;

function buildMockRows(runId: string, methods: string[]): SelectionReportRow[] {
  const names = genFeatureNames();
  if (methods.length === 0) {
    return names.map((feature, i) => {
      const r = seededRand(runId, i + 501);
      return {
        feature,
        finalSelected: true,
        iv: 0.01 + r * 0.2,
        gini_train: -0.15 + r * 0.3,
        gini_test: -0.12 + r * 0.28,
        psi: r * 0.15,
      };
    });
  }

  const nSelected = Math.max(1, Math.floor(names.length * (0.18 + seededRand(runId, 999) * 0.12)));

  return names.map((feature, i) => {
    const r = seededRand(runId, i + 501);
    const row: SelectionReportRow = {
      feature,
      finalSelected: false,
      iv: 0.005 + r * 0.22,
      gini_train: -0.2 + r * 0.35,
      gini_test: -0.18 + r * 0.33,
      psi: r * 0.18,
    };

    if (i < nSelected) {
      for (const m of methods) {
        row[m] = 1;
      }
      row.finalSelected = true;
    } else {
      const failIdx = Math.floor(seededRand(runId, i + 777) * methods.length);
      for (let mi = 0; mi < methods.length; mi++) {
        row[methods[mi]] = mi === failIdx ? 0 : seededRand(runId, i * 17 + mi) > 0.08 ? 1 : 0;
      }
      if (methods.every((m) => Number(row[m]) === 1)) {
        row[methods[failIdx]] = 0;
      }
      row.finalSelected = methods.every((m) => Number(row[m]) === 1);
    }

    return row;
  });
}

function sortRows(rows: SelectionReportRow[]): SelectionReportRow[] {
  return [...rows].sort((a, b) => {
    if (a.finalSelected !== b.finalSelected) return a.finalSelected ? -1 : 1;
    return a.feature.localeCompare(b.feature);
  });
}

function fmt4(n: number) {
  return Number.isFinite(n) ? n.toFixed(4) : '—';
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-sm text-slate-500 max-w-md leading-relaxed">{children}</p>
    </div>
  );
}

function passChip(on: boolean) {
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
        on ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
      }`}
    >
      {on ? 'Pass' : 'Fail'}
    </span>
  );
}

export function FeatureSelectionReportModal({
  onClose,
  runId,
  activeMethods,
  ivThreshold,
  corrThreshold,
  psiThreshold,
  lastRunHasSelectionReport,
}: FeatureSelectionReportModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    const built = buildMockRows(runId, activeMethods);
    return sortRows(built);
  }, [runId, activeMethods]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedOnly]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedRows.filter((row) => {
      if (selectedOnly && !row.finalSelected) return false;
      if (!q) return true;
      return row.feature.toLowerCase().includes(q);
    });
  }, [sortedRows, searchQuery, selectedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const methodCols = activeMethods;

  const bodyContent = !lastRunHasSelectionReport ? (
    <EmptyHint>
      The last run has no selection report path (artifact <span className="font-mono">Report path</span> empty or missing).
      After a successful Feature Selection job, expect{' '}
      <span className="font-mono">{'selection_report_{model_name}.csv'}</span>{' '}
      under <span className="font-mono">fp_fs_output_path</span> (see ray_fs_v2).
    </EmptyHint>
  ) : (
    <>
      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 mb-3 text-[11px] text-slate-600 space-y-1.5 shrink-0">
        <p>
          <span className="font-semibold text-slate-700">Methods (order):</span>{' '}
          <span className="font-mono text-slate-800">{methodCols.length ? methodCols.join(' → ') : '—'}</span>
        </p>
        <p>
          <span className="font-semibold text-slate-700">Thresholds:</span> IV ≥ {fmt4(ivThreshold)} · Corr &lt; {fmt4(corrThreshold)} · PSI
          &lt; {fmt4(psiThreshold)}
        </p>
        <p className="text-slate-500">
          <span className="font-semibold text-slate-600">Final selected</span> matches downstream logic: all configured method columns must be{' '}
          <span className="font-mono">1</span> (any <span className="font-mono">0</span> ⇒ dropped, same as ray_tune <span className="font-mono">read_data</span>).
        </p>
        <p className="text-amber-800/90">
          Columns <span className="font-mono">by_*</span> mirror <span className="font-mono">selection_report</span> CSV. Values{' '}
          <span className="font-mono">iv</span>, <span className="font-mono">gini_train</span>, <span className="font-mono">gini_test</span>,{' '}
          <span className="font-mono">psi</span> are <strong>prototype mock</strong> (not in the CSV; real metrics live in selector detail in Python).
        </p>
      </div>

      <PaginatedReportShell
        query={searchQuery}
        onQueryChange={setSearchQuery}
        searchPlaceholder="Filter by feature name…"
        filteredCount={filtered.length}
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        toolbarEnd={
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(e) => setSelectedOnly(e.target.checked)}
              className="rounded border-slate-300 text-[#13c2c2] focus:ring-[#13c2c2]/30"
            />
            Final selected only
          </label>
        }
      >
        {slice.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">No rows match the filter.</div>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[960px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sky-50 border-b border-slate-200">
                <th className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  final
                </th>
                <th className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  feature
                </th>
                {methodCols.map((m) => (
                  <th
                    key={m}
                    className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                  >
                    {m}
                  </th>
                ))}
                <th className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  iv (mock)
                </th>
                <th className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  gini_train (mock)
                </th>
                <th className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  gini_test (mock)
                </th>
                <th className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  psi (mock)
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.feature} className="hover:bg-slate-50/80">
                  <td className="border border-slate-100 px-2 py-1.5">
                    {row.finalSelected ? (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                        Selected
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Dropped
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs text-slate-800">{row.feature}</td>
                  {methodCols.map((m) => (
                    <td key={m} className="border border-slate-100 px-2 py-1.5 text-center">
                      {passChip(Number(row[m]) === 1)}
                    </td>
                  ))}
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{fmt4(row.iv)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{fmt4(row.gini_train)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{fmt4(row.gini_test)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{fmt4(row.psi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PaginatedReportShell>
    </>
  );

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden"
        style={{ width: '92vw', maxWidth: 1280, height: '88vh', maxHeight: 920 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#13c2c2]/10 border border-[#13c2c2]/20 flex items-center justify-center shrink-0">
              <ListChecks size={18} className="text-[#13c2c2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-800">Selection report (last run)</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                <span className="font-mono">{runId}</span>
                <span className="text-slate-300"> · </span>
                <span className="text-slate-500">{MOCK_ROW_COUNT.toLocaleString()} features (mock table)</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col">{bodyContent}</div>
      </div>
    </div>,
    document.body,
  );
}
