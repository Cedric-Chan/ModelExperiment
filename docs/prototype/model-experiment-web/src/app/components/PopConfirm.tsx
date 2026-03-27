import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export interface PopConfirmProps {
  message: string;
  onConfirm: () => void;
  children: React.ReactNode;
  danger?: boolean;
  confirmLabel?: string;
}

/** Click-triggered confirmation popover; portal z-index above full-screen modals. */
export function PopConfirm({ message, onConfirm, children, danger, confirmLabel = 'Confirm' }: PopConfirmProps) {
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
      style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 10050 }}
      className="bg-white rounded-xl border border-slate-200 shadow-2xl p-3 w-60"
    >
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] w-2.5 h-2.5 bg-white border-r border-b border-slate-200 rotate-45" />
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${danger ? 'text-rose-500' : 'text-amber-500'}`} />
        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-6 px-2.5 rounded text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">No</button>
        <button
          type="button"
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
