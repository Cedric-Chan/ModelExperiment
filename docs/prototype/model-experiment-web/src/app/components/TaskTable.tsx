import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronRight, ChevronDown, RefreshCw,
  AlertTriangle, Plus, Settings, Bell, X, HelpCircle
} from 'lucide-react';
import { TrainingTask, TaskInstance, CURRENT_USER, IS_ADMIN } from './data';
import { TaskStatusBadge, InstanceStatusBadge, RegionBadge } from './StatusBadge';
import { PopConfirm } from './PopConfirm';

/* ─── Description Tooltip ─── */
function DescTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  if (!text) return <span className="text-[15px] italic text-gray-300">—</span>;
  return (
    <div className="relative max-w-full" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <p className="cursor-default truncate text-[15px] text-gray-600" title={text}>
        {text}
      </p>
      {show && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-72 rounded-lg bg-slate-800 px-3 py-2 text-[15px] leading-relaxed text-white shadow-xl">
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 rotate-45 rounded-sm" />
          {text}
        </div>
      )}
    </div>
  );
}

/* ─── Action Button ─── */
interface ActionBtnProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'primary' | 'warning';
  className?: string;
}

function ActionBtn({ label, onClick, disabled, variant = 'default', className = '' }: ActionBtnProps) {
  const isDanger = variant === 'danger';

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30 focus-visible:ring-offset-1';

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center rounded px-2 py-1 text-[15px] font-medium text-slate-300 cursor-not-allowed ${className}`}
      >
        {label}
      </button>
    );
  }

  if (isDanger) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center rounded px-2 py-1 text-[15px] font-medium text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-1 ${className}`}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded px-2 py-1 text-[15px] font-medium text-teal-600 transition-colors hover:bg-teal-50/80 hover:text-teal-700 cursor-pointer ${focusRing} ${className}`}
    >
      {label}
    </button>
  );
}

/* ─── Dropdown ─── */
interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  confirm?: { message: string; confirmLabel?: string };
}

function Dropdown({ trigger, items }: { trigger: React.ReactNode; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 160 });
  const [pendingItem, setPendingItem] = useState<DropdownItem | null>(null);
  const [confirmPos, setConfirmPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu && !pendingItem) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pendingItem]);

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open]);

  useEffect(() => {
    if (!open && !pendingItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingItem) setPendingItem(null);
      else setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pendingItem]);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX,
        minWidth: Math.max(160, rect.width),
      });
    }
    setOpen(prev => !prev);
  };

  const handleItemClick = (item: DropdownItem, e: React.MouseEvent<HTMLButtonElement>) => {
    if (item.disabled) return;
    if (item.confirm) {
      const rect = e.currentTarget.getBoundingClientRect();
      setConfirmPos({ top: rect.top + window.scrollY, left: rect.right + window.scrollX + 8 });
      setPendingItem(item);
      setOpen(false);
    } else {
      item.onClick?.();
      setOpen(false);
    }
  };

  const menuPortal = open ? ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: menuPos.top,
        left: menuPos.left,
        transform: 'translateX(-100%)',
        minWidth: menuPos.minWidth,
        zIndex: 9990,
      }}
      className="bg-white rounded-xl border border-slate-200 shadow-xl py-1"
    >
      {items.map((item, i) => (
        item.divider ? (
          <div key={i} className="my-1 border-t border-slate-100" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={(e) => handleItemClick(item, e)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#13c2c2]/25
              ${item.disabled ? 'text-slate-300 cursor-not-allowed' : item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            {item.icon && <span className="w-3.5 h-3.5 opacity-70">{item.icon}</span>}
            {item.label}
          </button>
        )
      ))}
    </div>,
    document.body
  ) : null;

  const confirmPortal = pendingItem ? ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setPendingItem(null)} />
      <div
        style={{ position: 'absolute', top: confirmPos.top, left: confirmPos.left, transform: 'translateY(-50%)', zIndex: 9999 }}
        className="bg-white rounded-xl border border-slate-200 shadow-2xl p-3 w-60"
      >
        <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-l border-b border-slate-200 rotate-45" />
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${pendingItem.danger ? 'text-rose-500' : 'text-amber-500'}`} />
          <p className="text-xs text-slate-600 leading-relaxed">{pendingItem.confirm?.message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingItem(null)}
            className="h-6 px-2.5 rounded text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => { pendingItem.onClick?.(); setPendingItem(null); }}
            className={`h-6 px-2.5 rounded text-xs text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${pendingItem.danger ? 'bg-rose-500 hover:bg-rose-600 focus-visible:ring-rose-400' : 'bg-[#13c2c2] hover:bg-[#10a3a3] focus-visible:ring-[#13c2c2]/50'}`}
          >
            {pendingItem.confirm?.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className="relative" ref={triggerRef}>
      <div onClick={handleToggle} className="cursor-pointer inline-flex rounded">
        {trigger}
      </div>
      {menuPortal}
      {confirmPortal}
    </div>
  );
}

/* ─── Alert Modal ─── */
interface AlertEventRow {
  id: string;
  eventName: string;
  eventDefinition: string;
  eventType: 'System' | 'Built-in';
  hasConfig: boolean;
  rollingWindow?: number;
  alertInterval?: number;
  threshold?: string;
  active: boolean;
}

const DEFAULT_ALERT_EVENTS: AlertEventRow[] = [
  {
    id: 'RUN_SUCCESS',
    eventName: 'RUN_SUCCESS',
    eventDefinition: 'Run success notification',
    eventType: 'System',
    hasConfig: false,
    active: false,
  },
  {
    id: 'RUN_FAILED',
    eventName: 'RUN_FAILED',
    eventDefinition: 'Run failure notification',
    eventType: 'System',
    hasConfig: false,
    active: true,
  },
  {
    id: 'RUN_OVER_THRESHOLD',
    eventName: 'RUN_OVER_THRESHOLD',
    eventDefinition: 'Run threshold alert',
    eventType: 'Built-in',
    hasConfig: true,
    rollingWindow: 5,
    alertInterval: 1,
    threshold: '> 0.1',
    active: false,
  },
];

function MiniToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/40 focus-visible:ring-offset-2 ${value ? 'bg-[#13c2c2]' : 'bg-slate-300'}`}
    >
      <span
        className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ml-0.5 ${value ? 'translate-x-[18px]' : 'translate-x-0'}`}
      />
    </button>
  );
}

function MiniTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <HelpCircle size={12} className="text-slate-400 cursor-default" />
      {show && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-44 bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl leading-snug pointer-events-none whitespace-normal">
          {text}
        </span>
      )}
    </span>
  );
}

function AlertModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [events, setEvents] = useState<AlertEventRow[]>(DEFAULT_ALERT_EVENTS.map(e => ({ ...e })));
  const [alertReceiver, setAlertReceiver] = useState('');
  const [alertGroup, setAlertGroup] = useState('');
  const [urgentCall, setUrgentCall] = useState(false);
  const [alertToDoD, setAlertToDoD] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const toggleEvent = (id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, active: !e.active } : e));
  };

  const updateConfig = (id: string, field: keyof AlertEventRow, value: string | number) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const modal = ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[820px] max-w-[95vw] flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Bell size={14} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Alert List</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Exp&nbsp;<span className="font-mono text-slate-500">{taskId}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Alert Events Table */}
        <div className="overflow-y-auto flex-1 px-6 pt-4">
          <table className="w-full border-collapse">
            <colgroup>
              <col style={{ width: 170 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 80 }} />
              <col />
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100">
                {['Alert Event', 'Event Definition', 'Event Type', 'Config', 'Active'].map(h => (
                  <th key={h} className="py-2.5 pr-4 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {events.map(ev => (
                <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Alert Event */}
                  <td className="py-3.5 pr-4 align-top">
                    <span className="font-mono text-[11px] text-slate-700">{ev.eventName}</span>
                  </td>
                  {/* Event Definition */}
                  <td className="py-3.5 pr-4 align-top">
                    <span className="text-xs text-slate-600">{ev.eventDefinition}</span>
                  </td>
                  {/* Event Type */}
                  <td className="py-3.5 pr-4 align-top">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold
                      ${ev.eventType === 'System'
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>
                      {ev.eventType}
                    </span>
                  </td>
                  {/* Config */}
                  <td className="py-3.5 pr-4 align-top">
                    {!ev.hasConfig ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {/* Rolling Window */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">Rolling Window</span>
                          <MiniTooltip text="Time window (minutes) to evaluate the metric" />
                          <span className="text-slate-300 mx-0.5">:</span>
                          {editing ? (
                            <input
                              type="number"
                              value={ev.rollingWindow}
                              onChange={e => updateConfig(ev.id, 'rollingWindow', Number(e.target.value))}
                              className="w-12 h-5 px-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-[#13c2c2]/60 text-slate-700"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-700">{ev.rollingWindow}</span>
                          )}
                        </div>
                        {/* Threshold */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">Threshold</span>
                          <MiniTooltip text="Alert fires when metric exceeds this value" />
                          <span className="text-slate-300 mx-0.5">:</span>
                          {editing ? (
                            <input
                              type="text"
                              value={ev.threshold}
                              onChange={e => updateConfig(ev.id, 'threshold', e.target.value)}
                              className="w-14 h-5 px-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-[#13c2c2]/60 text-slate-700"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-700">{ev.threshold}</span>
                          )}
                        </div>
                        {/* Alert Interval */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">Alert Interval</span>
                          <MiniTooltip text="Minimum interval (minutes) between consecutive alerts" />
                          <span className="text-slate-300 mx-0.5">:</span>
                          {editing ? (
                            <input
                              type="number"
                              value={ev.alertInterval}
                              onChange={e => updateConfig(ev.id, 'alertInterval', Number(e.target.value))}
                              className="w-12 h-5 px-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-[#13c2c2]/60 text-slate-700"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-700">{ev.alertInterval}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  {/* Active */}
                  <td className="py-3.5 align-top">
                    <div className="flex flex-col items-start gap-1">
                      <MiniToggle value={ev.active} onChange={() => toggleEvent(ev.id)} />
                      <span className={`text-[9px] font-semibold uppercase tracking-wide ${ev.active ? 'text-[#13c2c2]' : 'text-slate-400'}`}>
                        {ev.active ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Divider */}
          <div className="border-t border-slate-100 mt-2 mb-4" />

          {/* Bottom Config Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 pb-2">
            {/* Alert Receiver */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-600">Alert Receiver</span>
                <MiniTooltip text="Email address(es) to receive alert notifications" />
                <span className="text-slate-400 ml-1">:</span>
              </div>
              <input
                type="email"
                placeholder="username@example.com"
                value={alertReceiver}
                onChange={e => setAlertReceiver(e.target.value)}
                disabled={!editing}
                className="flex-1 h-7 px-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#13c2c2]/60 text-slate-700 placeholder-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            {/* Alert Group */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600 shrink-0">Alert Group<span className="text-slate-400 ml-2">:</span></span>
              <div className="flex-1 relative">
                <select
                  disabled={!editing}
                  value={alertGroup}
                  onChange={e => setAlertGroup(e.target.value)}
                  className="w-full h-7 pl-2.5 pr-6 text-xs border border-slate-200 rounded-lg appearance-none focus:outline-none focus:border-[#13c2c2]/60 text-slate-400 bg-white disabled:bg-slate-50"
                >
                  <option value="">Please Select Alert Group</option>
                  <option value="ml-team">ML Team</option>
                  <option value="risk-team">Risk Team</option>
                  <option value="ops-team">Ops Team</option>
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Urgent Call */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-600">Urgent Call</span>
                <MiniTooltip text="Trigger an urgent phone call when alert fires" />
                <span className="text-slate-400 ml-1">:</span>
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <MiniToggle value={urgentCall} onChange={v => editing && setUrgentCall(v)} />
                <span className={`text-[9px] font-semibold uppercase tracking-wide ${urgentCall ? 'text-[#13c2c2]' : 'text-slate-400'}`}>
                  {urgentCall ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Alert to DoD Group */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-600">Alert to DoD Group</span>
                <MiniTooltip text="Also send alert to the DoD on-call group" />
                <span className="text-slate-400 ml-1">:</span>
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <MiniToggle value={alertToDoD} onChange={v => editing && setAlertToDoD(v)} />
                <span className={`text-[9px] font-semibold uppercase tracking-wide ${alertToDoD ? 'text-[#13c2c2]' : 'text-slate-400'}`}>
                  {alertToDoD ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          {editing ? (
            <button
              onClick={() => setEditing(false)}
              className="h-8 px-5 rounded-lg bg-[#13c2c2] text-white text-xs hover:bg-[#10a3a3] transition-colors shadow-sm"
            >
              Save
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="h-8 px-5 rounded-lg bg-[#13c2c2] text-white text-xs hover:bg-[#10a3a3] transition-colors shadow-sm"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return modal;
}

/* ─── Instance Row (Run Table) ─── */
interface InstanceRowProps {
  instance: TaskInstance;
  onView: () => void;
  onContinue: () => void;
  onKill: () => void;
  onArtifact: () => void;
}

function InstanceRow({ instance, onView, onContinue, onKill, onArtifact }: InstanceRowProps) {
  const s = instance.status;
  const canContinue = s === 'CHECKING';
  const canKill = ['RUNNING', 'QUEUING', 'WAITING', 'CHECKING'].includes(s);

  const moreItems: DropdownItem[] = [
    {
      label: 'Artifact',
      onClick: onArtifact,
    },
    {
      label: 'View Log',
      onClick: () => window.open('#ray-log', '_blank'),
    },
  ];

  return (
    <tr className="group hover:bg-blue-50/30 transition-colors border-b border-slate-100 last:border-0">
      <td className="whitespace-nowrap py-2.5 pl-12 pr-2 font-mono text-[15px] font-medium text-blue-600">
        {instance.id}
      </td>
      <td className="whitespace-nowrap px-2 py-2.5"><InstanceStatusBadge status={instance.status} /></td>
      <td className="max-w-[180px] px-2 py-2.5 text-[15px] text-gray-600">
        <DescTooltip text={instance.notes ?? ''} />
      </td>
      <td className="whitespace-nowrap truncate px-2 py-2.5 font-mono text-[15px] text-gray-600">{instance.triggerTime}</td>
      <td className="whitespace-nowrap truncate px-2 py-2.5 font-mono text-[15px] text-gray-600">{instance.startTime}</td>
      <td className="whitespace-nowrap truncate px-2 py-2.5 font-mono text-[15px] text-gray-600">{instance.finishTime}</td>
      <td className="whitespace-nowrap truncate px-2 py-2.5 font-mono text-[15px] text-gray-700">{instance.duration}</td>
      <td className="py-2.5 pl-2 pr-3">
        <div className="flex items-center gap-0.5 flex-nowrap">
          {/* View — always available */}
          <ActionBtn label="View" onClick={onView} />
          {/* Continue — CHECKING only */}
          {canContinue ? (
            <ActionBtn label="Continue" variant="primary" onClick={onContinue} />
          ) : (
            <ActionBtn label="Continue" disabled />
          )}
          {/* Kill */}
          {canKill ? (
            <PopConfirm message="Kill this run instance?" onConfirm={onKill} danger confirmLabel="Kill">
              <ActionBtn label="Kill" variant="danger" />
            </PopConfirm>
          ) : (
            <ActionBtn label="Kill" disabled />
          )}
          {/* More ▾ — Artifact + Log */}
          <Dropdown
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-[15px] font-medium text-teal-600 transition-colors hover:bg-teal-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30"
              >
                More <ChevronDown size={12} />
              </button>
            }
            items={moreItems}
          />
        </div>
      </td>
    </tr>
  );
}

/* ─── Task Row (Experiment Table) ─── */
interface TaskRowProps {
  task: TrainingTask;
  onEdit: () => void;
  onCopy: () => void;
  onStatusChange: (status: 'ENABLED' | 'DISABLED') => void;
  onDelete: () => void;
  onInstanceView: (instanceId: string) => void;
  onInstanceContinue: (instanceId: string) => void;
  onInstanceKill: (instanceId: string) => void;
  onInstanceArtifact: (instance: TaskInstance) => void;
}

// Column pixel widths — must match <colgroup> exactly
const COL = {
  toggle: 36,   // col 1
  expId:  106,  // col 2
  expName: 186, // col 3
  // col 4–8 are non-sticky, auto-laid out by table-fixed
};
const STICKY2 = COL.toggle;             // left offset for EXP ID
const STICKY3 = COL.toggle + COL.expId; // left offset for EXP Name

function TaskRow({
  task, onEdit, onCopy,
  onStatusChange, onDelete,
  onInstanceView, onInstanceContinue, onInstanceKill, onInstanceArtifact
}: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const canManage = CURRENT_USER === task.owner || IS_ADMIN;

  // Shared cell bg classes (sticky cells need explicit bg to cover content behind them)
  const stickyBg = expanded
    ? 'bg-teal-50/60'
    : 'bg-white group-hover:bg-gray-50';

  return (
    <>
      <tr className={`border-b border-gray-50 transition-colors group cursor-default ${expanded ? 'bg-teal-50/60' : 'hover:bg-gray-50'}`}>

        {/* Col 1 — toggle (sticky) */}
        <td className={`py-2.5 pl-2.5 pr-2 sticky left-0 z-10 transition-colors ${stickyBg}`}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={task.instances.length === 0 ? 'No runs to expand' : expanded ? 'Collapse runs' : 'Expand runs'}
            onClick={(e) => { e.stopPropagation(); if (task.instances.length > 0) setExpanded(!expanded); }}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/35
              ${task.instances.length === 0
                ? 'border-gray-200 text-gray-200 cursor-default'
                : expanded
                  ? 'bg-teal-500 border-teal-500 text-white'
                  : 'border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-500'}`}
            disabled={task.instances.length === 0}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>

        {/* Col 2 — Exp ID (sticky) */}
        <td
          className={`py-2.5 pr-2 sticky z-10 transition-colors ${stickyBg}`}
          style={{ left: STICKY2 }}
        >
          <span className="block truncate font-mono text-[15px] text-gray-600">{task.id}</span>
        </td>

        {/* Col 3 — Exp Name (sticky) — has right-side shadow to indicate stickiness */}
        <td
          className={`py-2.5 pr-2 sticky z-10 transition-colors ${stickyBg} after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200`}
          style={{ left: STICKY3, position: 'sticky' }}
        >
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="block truncate text-[16px] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-teal-600">{task.taskName}</span>
            {task.instances.length > 0 && (
              <span className="text-[13px] text-slate-500">{task.instances.length} run{task.instances.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </td>

        {/* Col 4 — Model */}
        <td className="py-2.5 pr-2">
          <div className="flex flex-wrap items-center gap-1 overflow-hidden">
            <span className="truncate font-mono text-[15px] text-gray-800">{task.modelName}</span>
            {task.modelVersion && (
              <span className="shrink-0 rounded border border-teal-100 bg-teal-50 px-1.5 py-0.5 text-[13px] font-semibold leading-tight text-teal-700">
                {task.modelVersion}
              </span>
            )}
            <RegionBadge region={task.region} />
          </div>
        </td>

        {/* Col 5 — Owner */}
        <td className="py-2.5 pr-2">
          <div className="flex items-center gap-1 overflow-hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-[11px] font-medium text-white">
              {task.owner[0].toUpperCase()}
            </div>
            <span className="truncate text-[15px] text-gray-700">{task.owner}</span>
          </div>
        </td>

        {/* Col 6 — Biz Team */}
        <td className="py-2.5 pr-2">
          <span className="inline-block max-w-full truncate rounded-md border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[15px] text-purple-700">{task.bizTeam ?? '—'}</span>
        </td>

        {/* Col 7 — Description */}
        <td className="py-2.5 pr-2">
          <DescTooltip text={task.description} />
        </td>

        {/* Col 8 — Update Time */}
        <td className="py-2.5 pr-2">
          <span className="block truncate font-mono text-[15px] text-gray-600">{task.updateTime}</span>
        </td>

        {/* Col 9 — Actions */}
        <td className="py-2.5 pl-0.5 pr-2">
          <div className="flex items-center gap-0.5 flex-nowrap">
            <ActionBtn label="Edit" onClick={onEdit} />
            <ActionBtn label="Copy" onClick={onCopy} />
            <ActionBtn label="Alert" onClick={() => setShowAlertModal(true)} />
            <PopConfirm
              message="Permanently delete this experiment? This action cannot be undone."
              onConfirm={onDelete}
              danger
              confirmLabel="Delete"
            >
              <ActionBtn label="Delete" variant="danger" disabled={!canManage} />
            </PopConfirm>
          </div>
        </td>
      </tr>

      {/* Alert Modal */}
      {showAlertModal && (
        <AlertModal taskId={task.id} onClose={() => setShowAlertModal(false)} />
      )}

      {/* Expanded run sub-table */}
      {expanded && (
        <tr className="bg-slate-50/80 border-b border-gray-100">
          <td colSpan={9} className="p-0 align-top">
            <div className="ml-10 mr-4 my-2 rounded-lg border border-slate-200 overflow-hidden shadow-inner bg-white">
              <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse" style={{ minWidth: 1000 }}>
                <colgroup>
                  <col style={{ width: 160 }} />
                  <col style={{ width: 95 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 108 }} />
                  <col style={{ width: 104 }} />
                  <col style={{ width: 104 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 200 }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200">
                    {[
                      { label: 'Run ID',       cls: 'pl-12 pr-2' },
                      { label: 'Run Status',   cls: 'px-2' },
                      { label: 'Notes',        cls: 'px-2' },
                      { label: 'Trigger Time', cls: 'px-2' },
                      { label: 'Start Time',   cls: 'px-2' },
                      { label: 'Finish Time',  cls: 'px-2' },
                      { label: 'Duration',     cls: 'px-2' },
                      { label: 'Actions',      cls: 'pl-2 pr-3' },
                    ].map(h => (
                      <th key={h.label} className={`py-2.5 ${h.cls} text-left text-[15px] font-medium tracking-wide text-slate-600 whitespace-nowrap`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {task.instances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[15px] text-gray-500">No runs found for this experiment.</td>
                    </tr>
                  ) : (
                    task.instances.map((inst) => (
                      <InstanceRow
                        key={inst.id}
                        instance={inst}
                        onView={() => onInstanceView(inst.id)}
                        onContinue={() => onInstanceContinue(inst.id)}
                        onKill={() => onInstanceKill(inst.id)}
                        onArtifact={() => onInstanceArtifact(inst)}
                      />
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Toolbar ─── */
interface ToolbarProps {
  total: number;
  filtered: number;
  onRefresh: () => void;
  onCreateTask: () => void;
  refreshing: boolean;
  ownByMe: boolean;
  onOwnByMeChange: (v: boolean) => void;
}

export function Toolbar({ total, filtered, onRefresh, onCreateTask, refreshing, ownByMe, onOwnByMeChange }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="h-5 w-1 shrink-0 rounded-full bg-teal-500" />
        <span className="text-base text-gray-800">
          Experiments list
          <span className="ml-2 text-[15px] text-gray-500">
            (Showing <strong className="font-semibold text-gray-700">{filtered}</strong> of{' '}
            <strong className="font-semibold text-gray-700">{total}</strong>)
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onOwnByMeChange(!ownByMe)}
          aria-pressed={ownByMe}
          className={`flex select-none items-center gap-2 rounded-lg border px-4 py-2 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30 focus-visible:ring-offset-2 ${
            ownByMe
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          <span
            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
              ownByMe ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'
            }`}
          >
            {ownByMe && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4L3.2 5.8L6.5 2.2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          Owned by me
        </button>

        <button
          type="button"
          onClick={onRefresh}
          title="Refresh list"
          aria-busy={refreshing}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30"
        >
          <RefreshCw size={17} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
        </button>

        <button
          type="button"
          onClick={onCreateTask}
          className="flex items-center gap-2 rounded-lg bg-[#13c2c2] px-5 py-2.5 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-[#10a3a3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/50 focus-visible:ring-offset-2"
        >
          <Plus size={16} />
          Create Exp.
        </button>
      </div>
    </div>
  );
}

/* ─── Pagination ─── */
interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-1 py-1">
      <span className="text-[15px] text-slate-600">
        {total === 0 ? 'No results' : `${start}–${end} of ${total} experiments`}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-[15px] text-slate-600">
          <span>Per page:</span>
          <div className="relative">
            <select
              className="h-9 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-7 text-[15px] text-slate-800 focus:border-[#13c2c2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/20"
              value={pageSize}
              onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            >
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-[#13c2c2]/40 hover:text-[#13c2c2] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/25"
        >
          <ChevronRight size={16} className="rotate-180" />
        </button>

        <div className="flex items-center gap-1">
          {pages.map(p => (
            <button
              type="button"
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/30
                ${p === page ? 'bg-[#13c2c2] text-white shadow-sm' : 'border border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100'}`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-[#13c2c2]/40 hover:text-[#13c2c2] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#13c2c2]/25"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Table ─── */
interface TaskTableProps {
  tasks: TrainingTask[];
  onEdit: (task: TrainingTask) => void;
  onCopy: (task: TrainingTask) => void;
  onStatusChange: (taskId: string, status: 'ENABLED' | 'DISABLED') => void;
  onDelete: (taskId: string) => void;
  onInstanceView: (taskId: string, instanceId: string) => void;
  onInstanceContinue: (taskId: string, instanceId: string) => void;
  onInstanceKill: (taskId: string, instanceId: string) => void;
  onInstanceArtifact: (instance: TaskInstance) => void;
  page: number;
  pageSize: number;
}

export function TaskTable({
  tasks, onEdit, onCopy,
  onStatusChange, onDelete,
  onInstanceView, onInstanceContinue, onInstanceKill, onInstanceArtifact,
  page, pageSize,
}: TaskTableProps) {
  const paginated = tasks.slice((page - 1) * pageSize, page * pageSize);

  const thCls = 'whitespace-nowrap px-2 py-2.5 text-left text-[15px] font-semibold tracking-wide text-gray-600';

  return (
    <div className="w-full overflow-x-auto">
      {/*
        table-fixed: column widths are governed by <colgroup> — not by content.
        This is the ONLY reliable way to prevent content overflow between columns.
        min-w ensures the table never collapses below a usable size.
      */}
      <table className="w-full table-fixed border-collapse" style={{ minWidth: 1180 }}>
        <colgroup>
          {/* Col 1: toggle */}
          <col style={{ width: COL.toggle }} />
          {/* Col 2: Exp ID */}
          <col style={{ width: COL.expId }} />
          {/* Col 3: Exp Name */}
          <col style={{ width: COL.expName }} />
          {/* Col 4: Model */}
          <col style={{ width: 186 }} />
          {/* Col 5: Owner */}
          <col style={{ width: 128 }} />
          {/* Col 6: Biz Team */}
          <col style={{ width: 108 }} />
          {/* Col 7: Description */}
          <col style={{ width: 196 }} />
          {/* Col 8: Update Time */}
          <col style={{ width: 156 }} />
          {/* Col 9: Actions */}
          <col style={{ width: 164 }} />
        </colgroup>

        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {/* Col 1 — toggle header (sticky) */}
            <th className="sticky left-0 z-20 w-11 bg-gray-50 py-2.5 pl-2.5 pr-2" />

            {/* Col 2 — Exp ID (sticky) */}
            <th
              className={`${thCls} sticky z-20 bg-gray-50`}
              style={{ left: STICKY2 }}
            >
              Exp Id
            </th>

            {/* Col 3 — Exp Name (sticky) */}
            <th
              className={`${thCls} sticky z-20 bg-gray-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200`}
              style={{ left: STICKY3, position: 'sticky' }}
            >
              Exp Name
            </th>

            <th className={thCls}>Model</th>
            <th className={thCls}>Owner</th>
            <th className={thCls}>Biz Team</th>
            <th className={thCls}>Description</th>
            <th className={thCls}>Update Time</th>
            <th className={`${thCls} pr-2`}>Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-20 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Settings size={36} className="opacity-20 mb-2" />
                  <p className="text-lg font-semibold text-gray-600">No model experiments found</p>
                  <p className="text-base text-gray-500">Try adjusting your filters to find what you&apos;re looking for</p>
                </div>
              </td>
            </tr>
          ) : (
            paginated.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={() => onEdit(task)}
                onCopy={() => onCopy(task)}
                onStatusChange={(status) => onStatusChange(task.id, status)}
                onDelete={() => onDelete(task.id)}
                onInstanceView={(id) => onInstanceView(task.id, id)}
                onInstanceContinue={(id) => onInstanceContinue(task.id, id)}
                onInstanceKill={(id) => onInstanceKill(task.id, id)}
                onInstanceArtifact={onInstanceArtifact}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}