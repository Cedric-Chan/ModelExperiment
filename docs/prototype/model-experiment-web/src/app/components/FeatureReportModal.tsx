import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, FileText } from 'lucide-react';

export type FeatureReportTabOpt = 'performance' | 'trend' | 'stability' | 'mono';

const ALL_TABS: FeatureReportTabOpt[] = ['performance', 'trend', 'stability', 'mono'];

export interface FeatureReportModalProps {
  onClose: () => void;
  runId: string;
  configFeatureReportOn: boolean;
  reportTabs: FeatureReportTabOpt[];
  stabilityDimLabel: string;
  lastRunFeatureReportOn: boolean;
}

function seededRand(seed: string, i: number): number {
  let h = 0;
  for (let k = 0; k < seed.length; k++) h = (h << 5) - h + seed.charCodeAt(k);
  const x = Math.sin(h * 0.001 + i * 49297) * 10000;
  return x - Math.floor(x);
}

const MOCK_VARS = [
  'device_hf_battery_voltage',
  'device_hf_has_record',
  'txn_amt_7d_sum',
  'credit_util_ratio',
  'age_bin_score',
  'region_risk_tag',
  'app_session_cnt_30d',
  'contact_book_size',
];

function buildPerformanceMock(runId: string) {
  return MOCK_VARS.map((v, i) => {
    const r = seededRand(runId, i + 11);
    return {
      var: v,
      auc: 0.62 + r * 0.18,
      ks: 0.15 + r * 0.22,
      zero_rate: r * 0.35,
      missing_rate: r * 0.12,
      iv: 0.02 + r * 0.16,
      missing_treat: r > 0.5 ? 'zero, ignore NA' : 'empirical',
      remark: r > 0.85 ? ', high zero rate' : r > 0.75 ? ', high missing rate' : '',
    };
  });
}

function buildTrendMock(runId: string) {
  const rows: Record<string, string | number>[] = [];
  MOCK_VARS.slice(0, 5).forEach((v, vi) => {
    const bins = vi % 2 === 0 ? 6 : 5;
    for (let b = 0; b < bins; b++) {
      const r = seededRand(runId, vi * 100 + b);
      const total = Math.round(8000 + r * 120000);
      const bad = Math.round(total * (0.04 + r * 0.12));
      rows.push({
        var: v,
        bin: b === 0 ? '01.(-inf, x]' : `${String(b + 1).padStart(2, '0')}.(a,b]`,
        total,
        total_ratio: r * 0.25,
        bad,
        bad_rate: bad / total,
        woe: -0.8 + r * 1.6,
        iv: 0.001 + r * 0.04,
        type: vi % 2 === 0 ? 'num_normal' : 'cat_normal',
        remark: total < 200 ? ', total<200' : r < 0.06 ? ', ratio<0.05' : '',
      });
    }
  });
  return rows;
}

function buildStabilityMock(runId: string, dimLabel: string) {
  const segs = [`${dimLabel}_A`, `${dimLabel}_B`, `${dimLabel}_C`];
  const metrics = ['auc', 'ks', 'psi'];
  const rows: Record<string, string | number>[] = [];
  MOCK_VARS.slice(0, 6).forEach((v, vi) => {
    metrics.forEach((m, mi) => {
      const r0 = seededRand(runId, vi * 30 + mi);
      const row: Record<string, string | number> = { var: v, metrics: m };
      segs.forEach((s, si) => {
        row[s] = m === 'psi' ? 0.02 + seededRand(runId, vi + si + 99) * 0.08 : 0.55 + seededRand(runId, vi + si) * 0.12;
      });
      rows.push(row);
    });
  });
  return { rows, dimCols: segs };
}

function buildMonoMock(runId: string) {
  return MOCK_VARS.map((v, i) => {
    const r = seededRand(runId, i + 200);
    return {
      var: v,
      type: i % 3 === 0 ? 'num_normal' : i % 3 === 1 ? 'cat_normal' : 'num_normal',
      fit_trend: r > 0.5 ? 'ASC' : 'DESC',
      trans_trend: r > 0.45 ? 'ASC' : 'DESC',
      fit_lift: 1.2 + r * 2.5,
      trans_lift: 1.1 + r * 2.2,
    };
  });
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-sm text-slate-500 max-w-md leading-relaxed">{children}</p>
    </div>
  );
}

function fmt4(n: number) {
  return Number.isFinite(n) ? n.toFixed(4) : '—';
}
function fmt2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}
function fmtPct(n: number) {
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '—';
}

export function FeatureReportModal({
  onClose,
  runId,
  configFeatureReportOn,
  reportTabs,
  stabilityDimLabel,
  lastRunFeatureReportOn,
}: FeatureReportModalProps) {
  const [tab, setTab] = useState<FeatureReportTabOpt>('performance');

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const perf = useMemo(() => buildPerformanceMock(runId), [runId]);
  const trend = useMemo(() => buildTrendMock(runId), [runId]);
  const stability = useMemo(() => buildStabilityMock(runId, stabilityDimLabel || 'dim'), [runId, stabilityDimLabel]);
  const mono = useMemo(() => buildMonoMock(runId), [runId]);

  function tabBody(t: FeatureReportTabOpt): React.ReactNode {
    if (!configFeatureReportOn) {
      return (
        <EmptyHint>
          Feature report is disabled in pipeline ENV. Open <strong>WOE Transform → Config</strong> and enable{' '}
          <span className="font-mono text-slate-600">feature_report</span>, then re-run the node.
        </EmptyHint>
      );
    }
    if (!reportTabs.includes(t)) {
      return (
        <EmptyHint>
          This section was not selected for the report. Add <span className="font-mono text-slate-600">{t}</span> to{' '}
          <span className="font-mono text-slate-600">woe_transform_report_tabs</span> in WOE Transform Config.
        </EmptyHint>
      );
    }
    if (!lastRunFeatureReportOn) {
      return (
        <EmptyHint>
          The last successful run did not emit a feature report (check artifact <span className="font-mono">feature_report</span> /{' '}
          <span className="font-mono">feature_report_save_path</span>). Enable feature report and re-run, or pick a run that
          generated the Excel report.
        </EmptyHint>
      );
    }

    if (t === 'performance') {
      return (
        <div className="overflow-auto max-h-[min(52vh,560px)] border border-slate-100 rounded-lg">
          <table className="w-full text-sm border-collapse min-w-[880px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sky-50 border-b border-slate-200">
                {['var', 'auc', 'ks', 'zero_rate', 'missing_rate', 'iv', 'missing_treat', 'remark'].map((c) => (
                  <th
                    key={c}
                    className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perf.map((row) => (
                <tr key={row.var} className="hover:bg-slate-50/80">
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs text-slate-800">{row.var}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt4(row.auc)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt4(row.ks)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmtPct(row.zero_rate)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmtPct(row.missing_rate)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt4(row.iv)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-xs text-slate-600">{row.missing_treat}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-xs text-amber-700">{row.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (t === 'trend') {
      return (
        <div className="overflow-auto max-h-[min(52vh,560px)] border border-slate-100 rounded-lg">
          <table className="w-full text-sm border-collapse min-w-[960px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sky-50 border-b border-slate-200">
                {['var', 'bin', 'total', 'total_ratio', 'bad', 'bad_rate', 'woe', 'iv', 'type', 'remark'].map((c) => (
                  <th
                    key={c}
                    className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((row, idx) => (
                <tr key={`${row.var}-${idx}`} className="hover:bg-slate-50/80">
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs">{row.var}</td>
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-[11px]">{row.bin}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{row.total}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmtPct(row.total_ratio as number)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{row.bad}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmtPct(row.bad_rate as number)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt4(row.woe as number)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt4(row.iv as number)}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-xs">{row.type}</td>
                  <td className="border border-slate-100 px-2 py-1.5 text-xs text-amber-700">{(row.remark as string) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (t === 'stability') {
      const { rows, dimCols } = stability;
      const headers = ['var', 'metrics', ...dimCols];
      return (
        <div className="overflow-auto max-h-[min(52vh,560px)] border border-slate-100 rounded-lg">
          <p className="text-[10px] text-slate-400 px-2 py-1.5 border-b border-slate-100 bg-slate-50/80">
            Stability metrics sheet (<span className="font-mono">df_metrics</span> / PSI wide) · dim segments: {dimCols.join(', ')}
          </p>
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sky-50 border-b border-slate-200">
                {headers.map((c) => (
                  <th
                    key={c}
                    className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.var}-${row.metrics}-${idx}`} className="hover:bg-slate-50/80">
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs">{row.var}</td>
                  <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs">{row.metrics}</td>
                  {dimCols.map((dc) => (
                    <td key={dc} className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">
                      {row.metrics === 'psi' ? fmt4(row[dc] as number) : fmt4(row[dc] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="overflow-auto max-h-[min(52vh,560px)] border border-slate-100 rounded-lg">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-sky-50 border-b border-slate-200">
              {['var', 'type', 'fit_trend', 'trans_trend', 'fit_lift', 'trans_lift'].map((c) => (
                <th
                  key={c}
                  className="border border-slate-200 px-2 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mono.map((row) => (
              <tr key={row.var} className="hover:bg-slate-50/80">
                <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs">{row.var}</td>
                <td className="border border-slate-100 px-2 py-1.5 text-xs">{row.type}</td>
                <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs">{row.fit_trend}</td>
                <td className="border border-slate-100 px-2 py-1.5 font-mono text-xs">{row.trans_trend}</td>
                <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt2(row.fit_lift)}</td>
                <td className="border border-slate-100 px-2 py-1.5 text-right tabular-nums">{fmt2(row.trans_lift)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

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
              <FileText size={18} className="text-[#13c2c2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-800">Feature report (last run)</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                <span className="font-mono">{runId}</span>
                {stabilityDimLabel ? (
                  <>
                    {' '}
                    · stability dim <span className="font-mono text-slate-500">{stabilityDimLabel}</span>
                  </>
                ) : null}
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

        <div className="flex border-b border-slate-100 px-3 gap-0.5 shrink-0 bg-slate-50/50">
          {ALL_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors
                ${tab === t ? 'border-[#13c2c2] text-[#13c2c2]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-4">{tabBody(tab)}</div>
      </div>
    </div>,
    document.body,
  );
}
