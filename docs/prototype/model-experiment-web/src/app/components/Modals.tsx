import React, { useState, useEffect, useRef } from 'react';
import {
  X, ChevronDown, Package,
  Check, Info, Copy, Clock, User,
  Search, AlertTriangle, ChevronRight, Tag,
} from 'lucide-react';
import {
  TrainingTask, TaskInstance, HistoryVersion, BIZ_TEAMS, BizTeam, REGISTERED_MODELS, ALL_OWNERS,
  Framework, Region, ModelLevel,
} from './data';

/* ─── Modal Shell ─── */
interface ModalProps {
  title: string;
  subtitle?: string;
  /** When set, replaces the default title + subtitle block (close button stays). */
  headerContent?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Extra classes on the panel (e.g. overflow-hidden for split layouts). */
  panelClassName?: string;
  /** Classes on the scrollable body wrapper (default: vertical scroll). */
  bodyClassName?: string;
  /** Override default header strip (border/background/padding). */
  headerClassName?: string;
}

export function Modal({
  title,
  subtitle,
  headerContent,
  onClose,
  children,
  size = 'md',
  panelClassName = '',
  bodyClassName = 'overflow-y-auto flex-1 min-h-0',
  headerClassName,
}: ModalProps) {
  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  }[size];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative w-full ${sizeClass} bg-white rounded-[1.25rem] shadow-[0_25px_80px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 flex flex-col max-h-[92vh] ${panelClassName}`}
      >
        <div
          className={
            headerClassName
              ?? 'flex items-start justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100/90 bg-gradient-to-br from-slate-50/90 via-white to-teal-50/30 shrink-0'
          }
        >
          <div className="min-w-0 flex-1">
            {headerContent ?? (
              <>
                <h3 className="text-slate-900 tracking-tight">{title}</h3>
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Form Field ─── */
interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, required, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label} {required && <span className="text-rose-500 normal-case">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  'h-10 px-3.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 placeholder-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] hover:border-[#13c2c2]/55 focus:outline-none focus:border-[#13c2c2] focus:ring-[3px] focus:ring-[#13c2c2]/12 transition-all w-full';
const selectCls =
  'h-10 px-3.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] hover:border-[#13c2c2]/55 focus:outline-none focus:border-[#13c2c2] focus:ring-[3px] focus:ring-[#13c2c2]/12 transition-all w-full appearance-none cursor-pointer';

/** Compact controls for Create/Edit experiment modal only */
const minimalInputCls =
  'h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#13c2c2] focus:ring-2 focus:ring-[#13c2c2]/20 w-full';
const minimalTriggerCls =
  'flex items-center gap-2 h-9 px-3 w-full rounded-md border border-slate-200 bg-white text-sm text-left transition-colors focus:outline-none focus:border-[#13c2c2] focus:ring-2 focus:ring-[#13c2c2]/20';

function MinimalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─── Region tag badge ─── */
const REGION_COLOR: Record<string, string> = {
  SG: 'bg-blue-50 text-blue-600 border-blue-200',
  ID: 'bg-green-50 text-green-700 border-green-200',
  TH: 'bg-purple-50 text-purple-600 border-purple-200',
  MY: 'bg-amber-50 text-amber-600 border-amber-200',
  PH: 'bg-rose-50 text-rose-600 border-rose-200',
  VN: 'bg-teal-50 text-teal-600 border-teal-200',
};
function RegionTag({ tag }: { tag: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${REGION_COLOR[tag] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {tag}
    </span>
  );
}

/* ─── Model @ Version Cascade Select ─── */
interface ModelVersionCascadeProps {
  value: string;           // stored as "model_name @ vX"
  onChange: (val: string) => void;
  error?: string;
}
function ModelVersionCascade({ value, onChange, error }: ModelVersionCascadeProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Parse current value
  const [selModel, selVersion] = value ? value.split(' @ ') : ['', ''];

  const filtered = REGISTERED_MODELS.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  // Default hovered model = selected model or first in list
  const activeHover = hoveredModel ?? (open ? (selModel || filtered[0]?.name || null) : null);
  const activeModelData = REGISTERED_MODELS.find(m => m.name === activeHover);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setHoveredModel(selModel || null);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSelect = (modelName: string, version: string) => {
    onChange(`${modelName} @ ${version}`);
    setOpen(false);
    setQuery('');
    setHoveredModel(null);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
    setHoveredModel(null);
  };

  const modelData = REGISTERED_MODELS.find(m => m.name === selModel);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`${minimalTriggerCls}
          ${error ? 'border-rose-400 ring-2 ring-rose-400/25' : open ? 'border-[#13c2c2] ring-2 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
      >
        {value ? (
          <>
            <span className="flex-1 font-mono text-slate-800 truncate text-sm">{selModel}</span>
            <span className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#13c2c2]/10 text-[#0e9e9e]">{selVersion}</span>
            {modelData && <RegionTag tag={modelData.regionTag} />}
            <button type="button" onClick={handleClear} className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors ml-0.5">
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-slate-400">Select model @ version…</span>
            <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown: two-pane cascade */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex"
               style={{ minHeight: '220px', maxHeight: '280px' }}>

            {/* Left pane — model list */}
            <div className="w-[54%] border-r border-slate-100 flex flex-col shrink-0">
              {/* Search */}
              <div className="px-2.5 pt-2.5 pb-1.5 border-b border-slate-50">
                <div className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-slate-50 border border-slate-100">
                  <Search size={11} className="text-slate-300 shrink-0" />
                  <input
                    ref={searchRef}
                    className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-300"
                    placeholder="Search model…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setHoveredModel(null); }}
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="text-slate-300 hover:text-slate-500">
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
              {/* Model rows */}
              <div className="overflow-y-auto flex-1 py-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No models found</p>
                ) : filtered.map(m => {
                  const isHovered = activeHover === m.name;
                  const isSelected = selModel === m.name;
                  return (
                    <div
                      key={m.name}
                      className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors gap-1.5
                        ${isHovered ? 'bg-[#13c2c2]/8' : 'hover:bg-slate-50'}`}
                      onMouseEnter={() => setHoveredModel(m.name)}
                    >
                      <span className={`flex-1 text-xs font-mono truncate ${isHovered ? 'text-[#0e9e9e]' : isSelected ? 'text-[#0e9e9e]' : 'text-slate-700'}`}>
                        {m.name}
                      </span>
                      <RegionTag tag={m.regionTag} />
                      <ChevronRight size={10} className={`shrink-0 ${isHovered ? 'text-[#13c2c2]' : 'text-slate-300'}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right pane — version list */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 pt-2.5 pb-1.5 border-b border-slate-50">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest truncate">
                  {activeHover ? activeHover : 'Hover a model'}
                </p>
              </div>
              <div className="overflow-y-auto flex-1 py-1">
                {!activeModelData ? (
                  <div className="flex flex-col items-center justify-center h-full gap-1.5 text-slate-300 py-8">
                    <Tag size={18} className="opacity-50" />
                    <p className="text-xs">Hover a model</p>
                  </div>
                ) : activeModelData.versions.map((ver, idx) => {
                  const isActive = selModel === activeModelData.name && selVersion === ver;
                  const isLatest = idx === 0;
                  return (
                    <div
                      key={ver}
                      className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors gap-2
                        ${isActive ? 'bg-[#13c2c2]/10' : 'hover:bg-slate-50'}`}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(activeModelData.name, ver); }}
                    >
                      <span className={`text-xs font-semibold font-mono ${isActive ? 'text-[#0e9e9e]' : 'text-slate-700'}`}>
                        {ver}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLatest && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                            latest
                          </span>
                        )}
                        {isActive && <Check size={11} className="text-[#13c2c2]" strokeWidth={2.5} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Template = optional experiment name (visible list) ─── */
interface ExperimentTemplateSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  error?: string;
}
function ExperimentTemplateSelect({ value, onChange, options, error }: ExperimentTemplateSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${minimalTriggerCls}
          ${error ? 'border-rose-400 ring-2 ring-rose-400/25' : open ? 'border-[#13c2c2] ring-2 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
      >
        <span className={`flex-1 text-left truncate ${!value ? 'text-slate-400' : 'text-slate-800'}`}>
          {value || 'Optional — select experiment…'}
        </span>
        {value
          ? <X size={12} className="text-slate-300 hover:text-slate-500 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(''); }} />
          : <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg py-1 max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No experiments available</p>
            ) : (
              options.map((name) => (
                <div
                  key={name}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors truncate
                    ${value === name ? 'bg-[#13c2c2]/8 text-[#0e9e9e]' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => { onChange(name); setOpen(false); }}
                >
                  {name}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Biz Team Select ─── */
interface BizTeamSelectProps {
  value: BizTeam | '';
  onChange: (v: BizTeam | '') => void;
  error?: string;
}
function BizTeamSelect({ value, onChange, error }: BizTeamSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${minimalTriggerCls}
          ${error ? 'border-rose-400 ring-2 ring-rose-400/25' : open ? 'border-[#13c2c2] ring-2 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
      >
        <span className={`flex-1 text-left truncate ${!value ? 'text-slate-400' : 'text-slate-800'}`}>
          {value || 'Select biz team…'}
        </span>
        {value
          ? <X size={12} className="text-slate-300 hover:text-slate-500 shrink-0" onClick={(e) => { e.stopPropagation(); onChange(''); }} />
          : <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg py-1">
            {BIZ_TEAMS.map((t) => (
              <div
                key={t}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors
                  ${value === t ? 'bg-[#13c2c2]/8 text-[#0e9e9e] font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => { onChange(t); setOpen(false); }}
              >
                {t}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Multi Owner Select ─── */
interface MultiOwnerSelectProps {
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}
function MultiOwnerSelect({ value, onChange, error }: MultiOwnerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ALL_OWNERS.filter(o =>
    !value.includes(o) && o.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const remove = (o: string) => onChange(value.filter(x => x !== o));
  const add = (o: string) => { onChange([...value, o]); setQuery(''); inputRef.current?.focus(); };

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex flex-wrap gap-1.5 min-h-9 px-2 py-1.5 rounded-md border border-slate-200 bg-white cursor-text transition-colors
          ${error ? 'border-rose-400 ring-2 ring-rose-400/25' : open ? 'border-[#13c2c2] ring-2 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {/* selected pills */}
        {value.map(o => (
          <span key={o} className="flex items-center gap-1 pl-2 pr-1 h-5 bg-[#13c2c2]/10 text-[#0e9e9e] rounded text-xs font-medium">
            {o}
            <button
              type="button"
              className="hover:text-rose-500 transition-colors"
              onMouseDown={(e) => { e.stopPropagation(); remove(o); }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {/* search input */}
        <input
          ref={inputRef}
          className="flex-1 min-w-[80px] h-5 text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none"
          placeholder={value.length === 0 ? 'Search and select owners…' : ''}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
      </div>

      {open && filtered.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg py-1 max-h-40 overflow-y-auto">
            {filtered.map(o => (
              <div
                key={o}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-[#13c2c2]/8 hover:text-[#0e9e9e] cursor-pointer transition-colors"
                onMouseDown={(e) => { e.preventDefault(); add(o); }}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#13c2c2] to-teal-600 flex items-center justify-center text-white text-[9px] font-bold">
                  {o[0].toUpperCase()}
                </div>
                {o}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Create / Edit Task Modal ─── */
interface CreateEditModalProps {
  task?: TrainingTask;
  isCopy?: boolean;
  visibleExperiments: TrainingTask[];
  onClose: () => void;
  onSubmit: (data: Partial<TrainingTask>) => void;
}

export function CreateEditModal({ task, isCopy, visibleExperiments, onClose, onSubmit }: CreateEditModalProps) {
  const isEdit = !!task && !isCopy;

  const templateOptionNames = visibleExperiments
    .map((t) => t.taskName)
    .filter((name) => !isEdit || name !== task?.taskName);

  const [form, setForm] = useState({
    expName:     isCopy ? `${task?.taskName || ''} (Copy)` : (task?.taskName || ''),
    model:       task?.modelName ? `${task.modelName}${task.modelVersion ? ` @ ${task.modelVersion}` : ''}` : '',
    modelLevel:  (isCopy || isEdit ? (task?.modelLevel ?? 'sub') : 'sub') as ModelLevel,
    templateExperimentName: isCopy ? (task?.taskName || '') : (task?.templateExperimentName || ''),
    owners:      task?.owner ? task.owner.split(',').map(s => s.trim()).filter(Boolean) : [] as string[],
    bizTeam:     (task?.bizTeam || '') as BizTeam | '',
    description: task?.description || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.expName.trim())     e.expName  = 'Experiment name is required';
    if (!form.model.trim())       e.model    = 'Model is required';
    if (form.owners.length === 0) e.owners   = 'At least one owner is required';
    if (!form.bizTeam)            e.bizTeam  = 'Biz team is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (form.templateExperimentName && !templateOptionNames.includes(form.templateExperimentName)) {
      e.templateExperimentName = 'Selected template experiment is not in your visible list';
    }
    if (!isEdit && (form.modelLevel !== 'sub' && form.modelLevel !== 'mega')) {
      e.modelLevel = 'Model level is required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resolveFramework = (): Framework => {
    if (task && (isEdit || isCopy)) return task.framework;
    return 'LightGBM';
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const modelParts = form.model.split(' @ ').map((s) => s.trim());
    const modelName = modelParts[0] || form.model;
    const modelVersion = modelParts[1];
    const payload: Partial<TrainingTask> = {
      taskName:    form.expName,
      modelName,
      ...(modelVersion ? { modelVersion } : {}),
      framework:   resolveFramework(),
      owner:       form.owners.join(', '),
      bizTeam:     form.bizTeam as BizTeam,
      description: form.description,
      ...(form.templateExperimentName.trim()
        ? { templateExperimentName: form.templateExperimentName.trim() }
        : { templateExperimentName: undefined }),
    };
    if (!isEdit) {
      payload.modelLevel = form.modelLevel;
    }
    if (isCopy && task?.pipelineEnv?.length) {
      payload.pipelineEnv = task.pipelineEnv.map((r) => ({ ...r }));
    }
    onSubmit(payload);
    onClose();
  };

  const headline = isEdit
    ? 'Edit Model Experiment'
    : isCopy
      ? 'Copy Model Experiment'
      : 'Create Model Experiment';
  const submitLabel = isEdit ? 'Save Changes' : isCopy ? 'Create Copy' : 'To Canvas';

  return (
    <Modal
      title={headline}
      headerContent={(
        <div>
          <h3 className="text-base font-semibold text-slate-900">{headline}</h3>
          {(isEdit || isCopy) && task && (
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit ? `Editing: ${task.taskName}` : `From: ${task.taskName}`}
            </p>
          )}
        </div>
      )}
      headerClassName="flex items-start justify-between gap-4 shrink-0 border-b border-slate-200 bg-white px-4 py-3"
      onClose={onClose}
      size="lg"
      panelClassName="overflow-hidden"
      bodyClassName="flex flex-1 flex-col min-h-0 overflow-hidden bg-white"
    >
      {/* sm+: single sheet without inner scroll; narrow viewports may scroll */}
      <div className="flex flex-1 flex-col min-h-0 max-h-[85vh] overflow-y-auto sm:max-h-none sm:overflow-hidden">
        <div className="px-4 py-3 space-y-3 sm:space-y-2.5 flex-1 min-h-0">
          <MinimalField label="Experiment name" required>
            <input
              className={`${minimalInputCls} ${errors.expName ? 'border-rose-400 ring-2 ring-rose-400/20' : ''}`}
              placeholder="Experiment name"
              value={form.expName}
              onChange={(e) => setForm({ ...form, expName: e.target.value })}
            />
            {errors.expName && <p className="text-xs text-rose-600 mt-0.5">{errors.expName}</p>}
          </MinimalField>

          {isEdit && (
            <MinimalField label="Model level">
              <div className={`${minimalInputCls} flex items-center bg-slate-50 text-slate-600`}>
                <span className="font-mono text-xs uppercase">{form.modelLevel}</span>
                <span className="text-[10px] text-slate-400 ml-auto">Read-only</span>
              </div>
            </MinimalField>
          )}

          <MinimalField label="Model" required>
            <ModelVersionCascade
              value={form.model}
              onChange={(v) => setForm({ ...form, model: v })}
              error={errors.model}
            />
            {errors.model && <p className="text-xs text-rose-600 mt-0.5">{errors.model}</p>}
          </MinimalField>

          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MinimalField label="Model level" required>
                <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
                  {(['sub', 'mega'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setForm({ ...form, modelLevel: lvl })}
                      className={`flex-1 h-8 rounded text-xs font-semibold uppercase tracking-wide transition-colors
                        ${form.modelLevel === lvl
                          ? 'bg-white text-[#0d9e9e] shadow-sm ring-1 ring-slate-200'
                          : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                {errors.modelLevel && <p className="text-xs text-rose-600 mt-0.5">{errors.modelLevel}</p>}
              </MinimalField>
              <MinimalField label="Template">
                <ExperimentTemplateSelect
                  value={form.templateExperimentName}
                  onChange={(v) => setForm({ ...form, templateExperimentName: v })}
                  options={templateOptionNames}
                  error={errors.templateExperimentName}
                />
                {errors.templateExperimentName && (
                  <p className="text-xs text-rose-600 mt-0.5">{errors.templateExperimentName}</p>
                )}
              </MinimalField>
            </div>
          )}

          {isEdit && (
            <MinimalField label="Template">
              <ExperimentTemplateSelect
                value={form.templateExperimentName}
                onChange={(v) => setForm({ ...form, templateExperimentName: v })}
                options={templateOptionNames}
                error={errors.templateExperimentName}
              />
              {errors.templateExperimentName && (
                <p className="text-xs text-rose-600 mt-0.5">{errors.templateExperimentName}</p>
              )}
            </MinimalField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MinimalField label="Owner" required>
              <MultiOwnerSelect
                value={form.owners}
                onChange={(v) => setForm({ ...form, owners: v })}
                error={errors.owners}
              />
              {errors.owners && <p className="text-xs text-rose-600 mt-0.5">{errors.owners}</p>}
            </MinimalField>
            <MinimalField label="Biz team" required>
              <BizTeamSelect
                value={form.bizTeam}
                onChange={(v) => setForm({ ...form, bizTeam: v })}
                error={errors.bizTeam}
              />
              {errors.bizTeam && <p className="text-xs text-rose-600 mt-0.5">{errors.bizTeam}</p>}
            </MinimalField>
          </div>

          <MinimalField label="Description" required>
            <textarea
              className={`${minimalInputCls} min-h-[4.25rem] py-2 resize-none ${errors.description ? 'border-rose-400 ring-2 ring-rose-400/20' : ''}`}
              rows={2}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {errors.description && <p className="text-xs text-rose-600 mt-0.5">{errors.description}</p>}
          </MinimalField>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-9 px-4 rounded-md bg-[#13c2c2] text-sm font-medium text-white hover:bg-[#11adad]"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── History Modal ─── */
interface HistoryModalProps {
  task: TrainingTask;
  onClose: () => void;
}

/* ── Copy Button ── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for non-https
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none
        ${copied
          ? 'bg-emerald-500 text-white'
          : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'
        }`}
    >
      {copied
        ? <><Check size={12} />Copied!</>
        : <><Copy size={12} />Copy</>
      }
    </button>
  );
}

export function HistoryModal({ task, onClose }: HistoryModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<HistoryVersion | null>(
    task.history.length > 0 ? task.history[0] : null
  );

  const configJson = selectedVersion ? JSON.stringify(selectedVersion.config, null, 2) : '';

  return (
    <Modal title="Version History" subtitle={task.taskName} onClose={onClose} size="xl">
      <div className="flex h-[500px]">
        {/* ── Left: version list ── */}
        <div className="w-[200px] shrink-0 border-r border-slate-100 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">
            Versions
          </p>
          {task.history.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No history yet</p>
          ) : (
            task.history.map((v, idx) => {
              const isActive = selectedVersion?.version === v.version;
              return (
                <button
                  key={v.version}
                  onClick={() => setSelectedVersion(v)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all
                    ${isActive
                      ? 'bg-[#13c2c2] text-white shadow-sm'
                      : 'hover:bg-slate-50 text-slate-700'
                    }`}
                >
                  {/* index bubble */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                    ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                      {v.version}
                    </p>
                    <p className={`text-[11px] truncate ${isActive ? 'text-[#e0fafa]' : 'text-slate-400'}`}>
                      {v.createdBy}
                    </p>
                  </div>
                  {idx === 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0
                      ${isActive ? 'bg-white/25 text-white' : 'bg-[#13c2c2]/10 text-[#0e9e9e]'}`}>
                      Latest
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* ── Right: config detail ── */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-w-0">
          {!selectedVersion ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
              <Info size={28} />
              <p className="text-sm">Select a version to view its config</p>
            </div>
          ) : (
            <>
              {/* Version meta row */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-slate-900 mb-1">{selectedVersion.version}</h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      {selectedVersion.createdAt}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <User size={11} />
                      {selectedVersion.createdBy}
                    </span>
                  </div>
                </div>
              </div>

              {/* Config JSON block */}
              <div className="flex flex-col gap-0 rounded-xl overflow-hidden border border-slate-800/60">
                {/* Code toolbar */}
                <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Configuration · JSON
                  </span>
                  <CopyButton text={configJson} />
                </div>
                {/* Code body */}
                <pre className="text-xs bg-slate-900 text-emerald-400 p-4 overflow-auto font-mono leading-relaxed m-0">
                  {configJson}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Artifact Modal ─── */
interface ArtifactModalProps {
  instance: TaskInstance;
  onClose: () => void;
}

export function ArtifactModal({ instance, onClose }: ArtifactModalProps) {
  const [tab, setTab] = useState<'parameters' | 'metrics'>('parameters');
  const artifacts = instance.artifacts;

  return (
    <Modal title="Model Artifacts" subtitle={`Instance: ${instance.id}`} onClose={onClose} size="md">
      {!artifacts ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
          <Package size={32} className="opacity-40" />
          <p className="text-sm">No artifact data available</p>
        </div>
      ) : (
        <div>
          <div className="flex border-b border-slate-100 px-6">
            {(['parameters', 'metrics'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm capitalize border-b-2 transition-colors -mb-px ${tab === t ? 'border-teal-600 text-teal-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="p-6">
            {tab === 'parameters' && (
              <div className="flex flex-col gap-1">
                {Object.entries(artifacts.parameters).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-500 font-mono">{key}</span>
                    <span className="text-sm font-medium text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded">{String(val)}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'metrics' && (
              <div className="flex flex-col gap-1">
                {Object.entries(artifacts.metrics).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-500 font-mono">{key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-teal-600"
                          style={{ width: `${Math.min(val * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-800 font-mono w-16 text-right">{val.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
              <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-600">Artifacts stored via MLFlow. View full experiment at <span className="font-medium underline cursor-pointer">mlflow.internal/runs/{instance.id}</span></p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── Trigger Confirm Modal ─── */
interface TriggerModalProps {
  task: TrainingTask;
  onClose: () => void;
  onConfirm: () => void;
}

export function TriggerModal({ task, onClose, onConfirm }: TriggerModalProps) {
  return (
    <Modal title="Trigger Training Instance" onClose={onClose} size="sm">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">This will create a new instance</p>
            <p className="text-xs text-amber-600 mt-1">A new training run will be submitted to the cluster using the latest configuration.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500">Task</span>
            <span className="font-medium text-slate-800">{task.taskName}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500">Framework</span>
            <span className="font-medium text-slate-800">{task.framework}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Region</span>
            <span className="font-medium text-slate-800">{task.region}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
        <button onClick={onClose} className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className="h-9 px-5 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 shadow-sm flex items-center gap-2">
          <Check size={14} />
          Confirm Trigger
        </button>
      </div>
    </Modal>
  );
}

/* ─── Notification Toast ─── */
interface ToastMsg {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counter = useRef(0);

  const show = (message: string, type: ToastMsg['type'] = 'success') => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  return { toasts, show };
}

export function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  const icons = {
    success: <Check size={16} className="text-emerald-600" />,
    error: <X size={16} className="text-rose-600" />,
    info: <Info size={16} className="text-blue-600" />,
  };
  const styles = {
    success: 'border-emerald-200 bg-emerald-50',
    error: 'border-rose-200 bg-rose-50',
    info: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles[t.type]}`}>
          {icons[t.type]}
          <span className="text-sm text-slate-700">{t.message}</span>
        </div>
      ))}
    </div>
  );
}