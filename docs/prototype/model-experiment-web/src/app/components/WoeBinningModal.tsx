import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  X, ArrowLeft, Search, Download,
  ChevronLeft, ChevronRight, BarChart3,
} from 'lucide-react';

/* ─────────────── Types ─────────────── */
interface WoeFeature {
  name: string;
  dataType: string;
  binningMethod: string;
  iv: number;
  bins: number;
}

interface BinRow {
  index: number;
  label: string;
  woe: number | null;
  total: number | null;
  positive: number | null;
  negative: number | null;
  totalRate: string | null;
  positiveRate: string | null;
  negativeRate: string | null;
}

/* ─────────────── Mock Feature List ─────────────── */
const MOCK_FEATURES: WoeFeature[] = [
  { name: 'f1',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.1823, bins: 10 },
  { name: 'f3',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.1654, bins: 10 },
  { name: 'f2',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.1421, bins: 9  },
  { name: 'f4',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.1198, bins: 9  },
  { name: 'f7',  dataType: 'double', binningMethod: 'TreeBinning',     iv: 0.1087, bins: 8  },
  { name: 'f12', dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0976, bins: 12 },
  { name: 'f9',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0854, bins: 10 },
  { name: 'f15', dataType: 'int',    binningMethod: 'EqualFrequency',  iv: 0.0743, bins: 8  },
  { name: 'f6',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0712, bins: 11 },
  { name: 'f11', dataType: 'double', binningMethod: 'TreeBinning',     iv: 0.0681, bins: 7  },
  { name: 'f18', dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0634, bins: 9  },
  { name: 'f5',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0598, bins: 10 },
  { name: 'f20', dataType: 'int',    binningMethod: 'EqualFrequency',  iv: 0.0521, bins: 6  },
  { name: 'f8',  dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0487, bins: 9  },
  { name: 'f14', dataType: 'string', binningMethod: 'CategoryBinning', iv: 0.0432, bins: 5  },
  { name: 'f10', dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0398, bins: 8  },
  { name: 'f17', dataType: 'double', binningMethod: 'TreeBinning',     iv: 0.0312, bins: 7  },
  { name: 'f13', dataType: 'int',    binningMethod: 'EqualFrequency',  iv: 0.0287, bins: 6  },
  { name: 'f19', dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0214, bins: 8  },
  { name: 'f16', dataType: 'string', binningMethod: 'CategoryBinning', iv: 0.0187, bins: 4  },
  { name: 'f21', dataType: 'double', binningMethod: 'OptimalBinning',  iv: 0.0154, bins: 7  },
  { name: 'f22', dataType: 'int',    binningMethod: 'EqualFrequency',  iv: 0.0098, bins: 5  },
];

/* ─────────────── Deterministic pseudo-random ─────────────── */
function seededRand(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 10000;
  return x - Math.floor(x);
}
function nameToSeed(name: string): number {
  return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/* ─────────────── Bin detail generator ─────────────── */
function generateBinRows(feature: WoeFeature): BinRow[] {
  const seed = nameToSeed(feature.name);
  const TOTAL_SAMPLES = 150;
  const rows: BinRow[] = [];

  // Build boundary array for numeric features
  const boundaries: number[] = [];
  let cur = 4.0 + seededRand(seed, 0) * 1.5;
  for (let i = 0; i < feature.bins - 1; i++) {
    cur += 0.2 + seededRand(seed, i + 1) * 0.6;
    boundaries.push(parseFloat(cur.toFixed(1)));
  }

  let totalAssigned = 0;
  // Total positive/negative pool
  const totalPos = Math.round(TOTAL_SAMPLES * (0.08 + seededRand(seed, 100) * 0.12));
  const totalNeg = TOTAL_SAMPLES - totalPos;

  for (let i = 0; i < feature.bins; i++) {
    const isLast = i === feature.bins - 1;

    let label: string;
    if (feature.dataType === 'string') {
      label = `cat_${i}`;
    } else if (i === 0) {
      label = `(-inf,${boundaries[0]}]`;
    } else if (isLast) {
      label = `(${boundaries[feature.bins - 2]},+inf]`;
    } else {
      label = `(${boundaries[i - 1]},${boundaries[i]}]`;
    }

    const baseCount = Math.floor(TOTAL_SAMPLES / feature.bins);
    const variation = Math.round((seededRand(seed, i + 10) - 0.5) * baseCount * 0.4);
    const total = isLast
      ? TOTAL_SAMPLES - totalAssigned
      : Math.max(5, baseCount + variation);
    if (!isLast) totalAssigned += total;

    // Positive/Negative split
    const posRatio = 0.05 + seededRand(seed, i + 30) * 0.20;
    const positive = Math.max(1, Math.round(total * posRatio));
    const negative = total - positive;

    // WOE = ln(pEvents / pNonEvents)
    const pEvents = positive / totalPos;
    const pNonEvents = negative / totalNeg;
    const woe =
      pEvents > 0 && pNonEvents > 0
        ? parseFloat((Math.log(pEvents / pNonEvents)).toFixed(4))
        : null;

    rows.push({
      index: i,
      label,
      woe,
      total,
      positive,
      negative,
      totalRate: ((total / TOTAL_SAMPLES) * 100).toFixed(2) + '%',
      positiveRate: ((positive / totalPos) * 100).toFixed(2) + '%',
      negativeRate: ((negative / totalNeg) * 100).toFixed(2) + '%',
    });
  }

  // ELSE row
  rows.push({
    index: -2,
    label: 'ELSE',
    woe: null, total: null, positive: null, negative: null,
    totalRate: null, positiveRate: null, negativeRate: null,
  });

  return rows;
}

/* ─────────────── Helpers ─────────────── */
const PAGE_SIZE = 10;

function dash(v: string | number | null) {
  if (v === null || v === undefined) return <span className="text-slate-300">-</span>;
  return <>{v}</>;
}

/* ─────────────── Feature Detail View ─────────────── */
function FeatureDetailView({ feature, onBack }: { feature: WoeFeature; onBack: () => void }) {
  const bins = useMemo(() => generateBinRows(feature), [feature]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white shrink-0 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-[#13c2c2] hover:border-[#13c2c2]/40 hover:bg-[#13c2c2]/5 transition-colors text-sm shrink-0"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <div className="w-px h-5 bg-slate-200 shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-slate-800 truncate">Feature Binning Detail</span>
          <span className="font-mono text-sm bg-[#13c2c2]/10 text-[#13c2c2] px-2 py-0.5 rounded-md border border-[#13c2c2]/20 shrink-0">
            {feature.name}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">DataType</span>
            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{feature.dataType}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Method</span>
            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">{feature.binningMethod}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">IV</span>
            <span className="text-[11px] font-semibold text-[#13c2c2] bg-[#13c2c2]/10 border border-[#13c2c2]/20 px-2 py-0.5 rounded">{feature.iv.toFixed(4)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Bins</span>
            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{feature.bins}</span>
          </span>
        </div>
      </div>

      {/* Detail Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 700 }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-sky-50">
              <th rowSpan={2} className="border border-slate-200 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 w-16 align-middle">
                Index
              </th>
              <th rowSpan={2} className="border border-slate-200 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 w-40 align-middle">
                Label
              </th>
              <th rowSpan={2} className="border border-slate-200 px-4 py-2.5 text-center text-xs font-semibold text-slate-600 w-24 align-middle">
                WOE
              </th>
              <th colSpan={3} className="border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600">
                Number
              </th>
              <th colSpan={3} className="border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-600">
                Rate
              </th>
            </tr>
            <tr className="bg-sky-50/70">
              <th className="border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 w-20">Total</th>
              <th className="border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 w-24">Positive</th>
              <th className="border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 w-24">Negative</th>
              <th className="border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 w-20">Total</th>
              <th className="border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 w-24">Positive</th>
              <th className="border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-500 w-24">Negative</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((row, idx) => {
              const isElse = row.index === -2;
              const isFirst = idx === 0;
              return (
                <tr
                  key={row.index}
                  className={`transition-colors hover:bg-sky-50/50
                    ${isFirst ? 'bg-sky-100/60' : isElse ? 'bg-slate-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                >
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-slate-700 font-mono">{row.index}</td>
                  <td className={`border border-slate-100 px-4 py-2.5 text-center text-xs font-mono
                    ${isElse ? 'text-rose-500 font-semibold' : isFirst ? 'text-sky-600 font-medium' : 'text-slate-700'}`}>
                    {row.label}
                  </td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-slate-700 font-mono">
                    {row.woe !== null ? (
                      <span className={row.woe >= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                        {row.woe >= 0 ? '+' : ''}{row.woe.toFixed(4)}
                      </span>
                    ) : dash(null)}
                  </td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-slate-700">{dash(row.total)}</td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-emerald-600">{dash(row.positive)}</td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-rose-500">{dash(row.negative)}</td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-slate-700">{dash(row.totalRate)}</td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-emerald-600">
                    {row.positiveRate !== null ? row.positiveRate : <span className="text-slate-300 text-[11px]">null%</span>}
                  </td>
                  <td className="border border-slate-100 px-4 py-2.5 text-center text-xs text-rose-500">
                    {row.negativeRate !== null ? row.negativeRate : <span className="text-slate-300 text-[11px]">null%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────── Feature List View ─────────────── */
function FeatureListView({ onSelectFeature, onClose }: {
  onSelectFeature: (f: WoeFeature) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => MOCK_FEATURES.filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };

  const handleDownload = () => {
    const header = 'Feature Name,Data Type,Binning Method,IV,Bins';
    const rows = MOCK_FEATURES.map(f =>
      `${f.name},${f.dataType},${f.binningMethod},${f.iv.toFixed(4)},${f.bins}`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'woe_binning_result.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Page number display – clamp to show max 7 pages
  const pageNums = useMemo(() => {
    const nums: number[] = [];
    const delta = 2;
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - delta && p <= page + delta)) {
        nums.push(p);
      }
    }
    return nums;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col h-full">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#13c2c2]/10 border border-[#13c2c2]/20 flex items-center justify-center shrink-0">
            <BarChart3 size={18} className="text-[#13c2c2]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">WOE Binning Result</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {MOCK_FEATURES.length} features · <span className="font-mono">run-20250305-0844</span>
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search feature name..."
            className="w-64 pl-9 pr-3 h-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400
              focus:outline-none focus:border-[#13c2c2]/60 focus:ring-2 focus:ring-[#13c2c2]/10 transition-all"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-slate-200 bg-white
            hover:bg-[#13c2c2]/5 hover:border-[#13c2c2]/40 hover:text-[#13c2c2]
            text-slate-600 text-sm font-medium transition-colors shadow-sm"
        >
          <Download size={14} />
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
                Feature Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Data Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Binning Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                IV
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider pr-8">
                Bins
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageData.map((f) => (
              <tr key={f.name} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-3.5">
                  <button
                    onClick={() => onSelectFeature(f)}
                    className="text-sm font-medium text-[#13c2c2] hover:text-[#0d9e9e] hover:underline underline-offset-2 transition-colors"
                  >
                    {f.name}
                  </button>
                </td>
                <td className="px-6 py-3.5 text-sm text-slate-600">{f.dataType}</td>
                <td className="px-6 py-3.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono">
                    {f.binningMethod}
                  </span>
                </td>
                <td className="px-6 py-3.5">
                  <span className="text-sm font-medium text-slate-700">{f.iv.toFixed(4)}</span>
                  {/* IV bar */}
                  <div className="mt-1 h-1 w-20 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#13c2c2]/60"
                      style={{ width: `${Math.min(100, (f.iv / 0.2) * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="px-6 py-3.5 text-sm text-slate-600 text-right pr-8">{f.bins}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {pageData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={32} className="text-slate-200" />
            <p className="text-sm text-slate-400">No features found for &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white shrink-0">
        <span className="text-xs text-slate-400">
          {filtered.length} feature{filtered.length !== 1 ? 's' : ''} total
        </span>

        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500
              hover:border-[#13c2c2] hover:text-[#13c2c2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          {pageNums.map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && pageNums[i - 1] !== p - 1 && (
                <span className="w-7 text-center text-xs text-slate-400">…</span>
              )}
              <button
                onClick={() => setPage(p)}
                className={`w-7 h-7 text-xs rounded border transition-colors
                  ${page === p
                    ? 'bg-[#13c2c2] border-[#13c2c2] text-white font-semibold'
                    : 'border-slate-200 text-slate-600 hover:border-[#13c2c2] hover:text-[#13c2c2]'}`}
              >
                {p}
              </button>
            </React.Fragment>
          ))}

          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500
              hover:border-[#13c2c2] hover:text-[#13c2c2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <span className="text-xs text-slate-400">Page {page} / {totalPages}</span>
      </div>
    </div>
  );
}

/* ─────────────── Main WoeBinningModal ─────────────── */
export function WoeBinningModal({ onClose }: { onClose: () => void }) {
  const [selectedFeature, setSelectedFeature] = useState<WoeFeature | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedFeature) {
          setSelectedFeature(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFeature, onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget && !selectedFeature) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden"
        style={{ width: '88vw', maxWidth: 1200, height: '84vh', maxHeight: 900 }}
        onClick={e => e.stopPropagation()}
      >
        {selectedFeature
          ? <FeatureDetailView feature={selectedFeature} onBack={() => setSelectedFeature(null)} />
          : <FeatureListView onSelectFeature={setSelectedFeature} onClose={onClose} />
        }
      </div>
    </div>,
    document.body,
  );
}
