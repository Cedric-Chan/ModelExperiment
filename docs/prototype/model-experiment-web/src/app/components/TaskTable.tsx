import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronRight, ChevronDown, RefreshCw,
  AlertTriangle, Plus, Settings, Bell, X, HelpCircle
} from 'lucide-react';
import { TrainingTask, TaskInstance, CURRENT_USER, IS_ADMIN } from './data';
import { TaskStatusBadge, InstanceStatusBadge, RegionBadge } from './StatusBadge';

/* ─── Description Tooltip ─── */
function DescTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  if (!text) return <span className="text-xs text-slate-400 italic">—</span>;
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <p className="text-xs text-slate-500 truncate cursor-default">{text}</p>
      {show && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
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

  if (disabled) {
    return (
      <button disabled className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-slate-300 cursor-not-allowed ${className}`}>
        {label}
      </button>
    );
  }

  if (isDanger) {
    return (
      <button onClick={onClick} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ${className}`}>
        {label}
      </button>
    );
  }

  return (
    <button onClick={onClick} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium text-[#13c2c2] hover:bg-[#13c2c2]/10 transition-colors cursor-pointer ${className}`}>
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
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
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
          <button onClick={() => setPendingItem(null)} className="h-6 px-2.5 rounded text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">No</button>
          <button
            onClick={() => { pendingItem.onClick?.(); setPendingItem(null); }}
            className={`h-6 px-2.5 rounded text-xs text-white transition-colors ${pendingItem.danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#13c2c2] hover:bg-[#10a3a3]'}`}
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
      <div onClick={handleToggle} className="cursor-pointer">{trigger}</div>
      {menuPortal}
      {confirmPortal}
    </div>
  );
}

/* ─── PopConfirm ─── */
interface PopConfirmProps {
  message: string;
  onConfirm: () => void;
  children: React.ReactNode;
  danger?: boolean;
  confirmLabel?: string;
}

function PopConfirm({ message, onConfirm, children, danger, confirmLabel = 'Confirm' }: PopConfirmProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    }
    setOpen(true);
  };

  const popup = open ? ReactDOM.createPortal(
    <div
      ref={popupRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
      className="bg-white rounded-xl border border-slate-200 shadow-2xl p-3 w-60"
    >
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] w-2.5 h-2.5 bg-white border-r border-b border-slate-200 rotate-45" />
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="h-6 px-2.5 rounded text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">No</button>
        <button
          onClick={() => { onConfirm(); setOpen(false); }}
          className={`h-6 px-2.5 rounded text-xs text-white transition-colors ${danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#13c2c2] hover:bg-[#10a3a3]'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={triggerRef} className="relative inline-flex">
      <div onClick={handleOpen}>{children}</div>
      {popup}
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
    eventDefinition: 'Run 成功通知',
    eventType: 'System',
    hasConfig: false,
    active: false,
  },
  {
    id: 'RUN_FAILED',
    eventName: 'RUN_FAILED',
    eventDefinition: 'Run 失败通知',
    eventType: 'System',
    hasConfig: false,
    active: true,
  },
  {
    id: 'RUN_OVER_THRESHOLD',
    eventName: 'RUN_OVER_THRESHOLD',
    eventDefinition: 'Run 超阈值告警',
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
      onClick={() => onChange(!value)}
      className={`inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${value ? 'bg-[#13c2c2]' : 'bg-slate-300'}`}
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
  onKill: () => void;
  onArtifact: () => void;
}

function InstanceRow({ instance, onView, onKill, onArtifact }: InstanceRowProps) {
  const s = instance.status;
  const canKill = ['RUNNING'].includes(s);

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
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
      <td className="py-2 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3.5 bg-[#13c2c2]/40 rounded-full shrink-0" />
          <span className="font-mono text-[11px] text-slate-700 truncate">{instance.id}</span>
        </div>
      </td>
      <td className="py-2 pl-3 pr-2"><InstanceStatusBadge status={instance.status} /></td>
      {/* Notes */}
      <td className="py-2 pl-3 pr-2">
        <DescTooltip text={instance.notes ?? ''} />
      </td>
      <td className="py-2 pl-3 pr-2 text-[11px] text-slate-500 font-mono truncate">{instance.triggerTime}</td>
      <td className="py-2 pl-3 pr-2 text-[11px] text-slate-500 font-mono truncate">{instance.startTime}</td>
      <td className="py-2 pl-3 pr-2 text-[11px] text-slate-500 font-mono truncate">{instance.finishTime}</td>
      <td className="py-2 pl-3 pr-2 text-[11px] text-slate-600 font-mono truncate">{instance.duration}</td>
      <td className="py-2 pl-3 pr-4">
        <div className="flex items-center gap-0.5 flex-nowrap">
          {/* View — always available */}
          <ActionBtn label="View" onClick={onView} />
          {/* Kill */}
          {canKill ? (
            <PopConfirm message="Kill this running instance?" onConfirm={onKill} danger confirmLabel="Kill">
              <ActionBtn label="Kill" variant="danger" />
            </PopConfirm>
          ) : (
            <ActionBtn label="Kill" disabled />
          )}
          {/* More ▾ — Artifact + Log */}
          <Dropdown
            trigger={
              <button className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium text-[#13c2c2] hover:bg-[#13c2c2]/10 transition-all">
                More <ChevronDown size={10} />
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
  onTrigger: () => void;
  onCopy: () => void;
  onStatusChange: (status: 'ENABLED' | 'DISABLED') => void;
  onDelete: () => void;
  onInstanceView: (instanceId: string) => void;
  onInstanceKill: (instanceId: string) => void;
  onInstanceArtifact: (instance: TaskInstance) => void;
}

// Column pixel widths — must match <colgroup> exactly
const COL = {
  toggle: 36,   // col 1
  expId:  96,   // col 2
  expName: 144, // col 3
  // col 4–8 are non-sticky, auto-laid out by table-fixed
};
const STICKY2 = COL.toggle;                      // left offset for EXP ID  = 36
const STICKY3 = COL.toggle + COL.expId;          // left offset for EXP Name = 132

function TaskRow({
  task, onEdit, onTrigger, onCopy,
  onStatusChange, onDelete,
  onInstanceView, onInstanceKill, onInstanceArtifact
}: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const canManage = CURRENT_USER === task.owner || IS_ADMIN;

  // Shared cell bg classes (sticky cells need explicit bg to cover content behind them)
  const stickyBg = expanded
    ? 'bg-[#f6fcfc]'
    : 'bg-white group-hover:bg-[#f6fcfc]';

  return (
    <>
      <tr className={`border-b border-slate-100 transition-colors group ${expanded ? 'bg-[#f6fcfc]' : 'hover:bg-[#f6fcfc]'}`}>

        {/* Col 1 — toggle (sticky) */}
        <td className={`py-2.5 pl-3 pr-1 sticky left-0 z-10 transition-colors ${stickyBg}`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-all
              ${task.instances.length > 0
                ? 'text-slate-400 hover:text-[#13c2c2] hover:bg-[#13c2c2]/10'
                : 'text-slate-200 cursor-default'}`}
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
          <span className="font-mono text-[11px] text-slate-500 truncate block">{task.id}</span>
        </td>

        {/* Col 3 — Exp Name (sticky) — has right-side shadow to indicate stickiness */}
        <td
          className={`py-2.5 pr-3 sticky z-10 transition-colors ${stickyBg} after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-slate-200`}
          style={{ left: STICKY3, position: 'sticky' }}
        >
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="text-xs font-medium text-slate-800 group-hover:text-[#10a3a3] transition-colors truncate block">{task.taskName}</span>
            {task.instances.length > 0 && (
              <span className="text-[10px] text-slate-400">{task.instances.length} run{task.instances.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </td>

        {/* Col 4 — Model */}
        <td className="py-2.5 pr-2">
          <div className="flex items-center gap-1 flex-wrap overflow-hidden">
            <span className="font-mono text-[11px] text-slate-700 truncate">{task.modelName}</span>
            {task.modelVersion && (
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#13c2c2]/10 text-[#0e9e9e] border border-[#13c2c2]/20 leading-tight">
                {task.modelVersion}
              </span>
            )}
            <RegionBadge region={task.region} />
          </div>
        </td>

        {/* Col 5 — Owner */}
        <td className="py-2.5 pr-2">
          <div className="flex items-center gap-1 overflow-hidden">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#13c2c2] to-teal-500 flex items-center justify-center text-white text-[9px] font-medium shrink-0">
              {task.owner[0].toUpperCase()}
            </div>
            <span className="text-[11px] text-slate-600 truncate">{task.owner}</span>
          </div>
        </td>

        {/* Col 6 — Biz Team */}
        <td className="py-2.5 pr-2">
          <span className="text-[11px] text-slate-600 truncate block">{task.bizTeam ?? '—'}</span>
        </td>

        {/* Col 7 — Description */}
        <td className="py-2.5 pr-2">
          <DescTooltip text={task.description} />
        </td>

        {/* Col 8 — Update Time */}
        <td className="py-2.5 pr-2">
          <span className="text-[11px] text-slate-500 font-mono truncate block">{task.updateTime}</span>
        </td>

        {/* Col 9 — Actions */}
        <td className="py-2.5 pl-1 pr-3">
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
        <tr className="bg-[#f0fafa] border-b border-slate-200">
          <td colSpan={9} className="py-3 px-4">
            <div className="bg-white border border-slate-200/80 rounded-lg shadow-sm overflow-x-auto">
              <table className="table-fixed border-collapse" style={{ minWidth: 920 }}>
                <colgroup>
                  <col style={{ width: 160 }} />
                  <col style={{ width: 95 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 108 }} />
                  <col style={{ width: 104 }} />
                  <col style={{ width: 104 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 129 }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80">
                    {[
                      { label: 'Run ID',       cls: 'pl-4 pr-2' },
                      { label: 'Run Status',   cls: 'pl-3 pr-2' },
                      { label: 'Notes',        cls: 'pl-3 pr-2' },
                      { label: 'Trigger Time', cls: 'pl-3 pr-2' },
                      { label: 'Start Time',   cls: 'pl-3 pr-2' },
                      { label: 'Finish Time',  cls: 'pl-3 pr-2' },
                      { label: 'Duration',     cls: 'pl-3 pr-2' },
                      { label: 'Actions',      cls: 'pl-3 pr-4' },
                    ].map(h => (
                      <th key={h.label} className={`py-2 ${h.cls} text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {task.instances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-slate-400">No runs found for this experiment.</td>
                    </tr>
                  ) : (
                    task.instances.map((inst) => (
                      <InstanceRow
                        key={inst.id}
                        instance={inst}
                        onView={() => onInstanceView(inst.id)}
                        onKill={() => onInstanceKill(inst.id)}
                        onArtifact={() => onInstanceArtifact(inst)}
                      />
                    ))
                  )}
                </tbody>
              </table>
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
    <div className="flex items-center justify-between gap-4">
      {/* Left: count */}
      <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
        <span>
          Showing <strong className="text-slate-700">{filtered}</strong> of{' '}
          <strong className="text-slate-700">{total}</strong> experiments
        </span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-3">
        {/* Own by me checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none group">
          <div className="relative">
            <input
              type="checkbox"
              checked={ownByMe}
              onChange={(e) => onOwnByMeChange(e.target.checked)}
              className="sr-only peer"
            />
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                ${ownByMe
                  ? 'bg-[#13c2c2] border-[#13c2c2]'
                  : 'bg-white border-slate-300 group-hover:border-[#13c2c2]/60'
                }`}
            >
              {ownByMe && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className={`text-sm transition-colors ${ownByMe ? 'text-[#0e9e9e]' : 'text-slate-500 group-hover:text-slate-700'}`}>
            Owned by me
          </span>
        </label>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Refresh */}
        <button
          onClick={onRefresh}
          title="Refresh list"
          className={`w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white
            text-slate-400 hover:text-[#13c2c2] hover:border-[#13c2c2]/40 transition-all
            ${refreshing ? 'text-[#13c2c2] border-[#13c2c2]/40' : ''}`}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>

        {/* Create Exp. */}
        <button
          onClick={onCreateTask}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#13c2c2] text-white text-sm font-medium hover:bg-[#10a3a3] shadow-sm transition-all active:scale-95"
        >
          <Plus size={15} />
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
    <div className="flex items-center justify-between px-1">
      <span className="text-sm text-slate-500">
        {total === 0 ? 'No results' : `${start}–${end} of ${total} experiments`}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <span>Per page:</span>
          <div className="relative">
            <select
              className="h-8 pl-2 pr-6 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none focus:border-[#13c2c2]/50"
              value={pageSize}
              onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            >
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13c2c2]/40 hover:text-[#13c2c2] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={14} className="rotate-180" />
        </button>

        <div className="flex items-center gap-1">
          {pages.map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all
                ${p === page ? 'bg-[#13c2c2] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'}`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13c2c2]/40 hover:text-[#13c2c2] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Table ─── */
interface TaskTableProps {
  tasks: TrainingTask[];
  onEdit: (task: TrainingTask) => void;
  onTrigger: (task: TrainingTask) => void;
  onCopy: (task: TrainingTask) => void;
  onStatusChange: (taskId: string, status: 'ENABLED' | 'DISABLED') => void;
  onDelete: (taskId: string) => void;
  onInstanceView: (taskId: string, instanceId: string) => void;
  onInstanceKill: (taskId: string, instanceId: string) => void;
  onInstanceArtifact: (instance: TaskInstance) => void;
  page: number;
  pageSize: number;
}

export function TaskTable({
  tasks, onEdit, onTrigger, onCopy,
  onStatusChange, onDelete,
  onInstanceView, onInstanceKill, onInstanceArtifact,
  page, pageSize,
}: TaskTableProps) {
  const paginated = tasks.slice((page - 1) * pageSize, page * pageSize);

  const thCls = "py-3 pr-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider";

  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
      {/*
        table-fixed: column widths are governed by <colgroup> — not by content.
        This is the ONLY reliable way to prevent content overflow between columns.
        min-w ensures the table never collapses below a usable size.
      */}
      <table className="w-full table-fixed border-collapse" style={{ minWidth: 880 }}>
        <colgroup>
          {/* Col 1: toggle */}
          <col style={{ width: COL.toggle }} />
          {/* Col 2: Exp ID */}
          <col style={{ width: COL.expId }} />
          {/* Col 3: Exp Name */}
          <col style={{ width: COL.expName }} />
          {/* Col 4: Model */}
          <col style={{ width: 152 }} />
          {/* Col 5: Owner */}
          <col style={{ width: 112 }} />
          {/* Col 6: Biz Team */}
          <col style={{ width: 96 }} />
          {/* Col 7: Description */}
          <col style={{ width: 160 }} />
          {/* Col 8: Update Time */}
          <col style={{ width: 138 }} />
          {/* Col 9: Actions */}
          <col style={{ width: 152 }} />
        </colgroup>

        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {/* Col 1 — toggle header (sticky) */}
            <th className="py-2.5 pl-3 pr-1 sticky left-0 z-20 bg-slate-50" />

            {/* Col 2 — Exp ID (sticky) */}
            <th
              className={`${thCls} sticky z-20 bg-slate-50`}
              style={{ left: STICKY2 }}
            >
              Exp Id
            </th>

            {/* Col 3 — Exp Name (sticky) */}
            <th
              className={`${thCls} sticky z-20 bg-slate-50 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-slate-200`}
              style={{ left: STICKY3, position: 'sticky' }}
            >
              Exp Name
            </th>

            <th className={thCls}>Model</th>
            <th className={thCls}>Owner</th>
            <th className={thCls}>Biz Team</th>
            <th className={thCls}>Description</th>
            <th className={thCls}>Update Time</th>
            <th className={`${thCls} pr-3`}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-20 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Settings size={36} className="opacity-20 mb-2" />
                  <p className="text-base font-medium text-slate-500">No model experiments found</p>
                  <p className="text-sm">Try adjusting your filters to find what you're looking for</p>
                </div>
              </td>
            </tr>
          ) : (
            paginated.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={() => onEdit(task)}
                onTrigger={() => onTrigger(task)}
                onCopy={() => onCopy(task)}
                onStatusChange={(status) => onStatusChange(task.id, status)}
                onDelete={() => onDelete(task.id)}
                onInstanceView={(id) => onInstanceView(task.id, id)}
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