import React, { useState } from 'react';
import { PanelLeft, LayoutGrid, FlaskConical, Box } from 'lucide-react';
import { cn } from './ui/utils';

export type AppNavId = 'pipelines' | 'experiments' | 'models';

export function AppShell({
  children,
  activeNav = 'pipelines',
}: {
  children: React.ReactNode;
  activeNav?: AppNavId;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const items: { id: AppNavId; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'pipelines', label: 'Pipelines', icon: LayoutGrid },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'models', label: 'Model Registry', icon: Box },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5] text-[13px] text-[#333] font-sans antialiased">
      <aside
        className={cn(
          'flex flex-col border-r border-[#e8e8e8] bg-[#f0f2f5] py-6 px-3 z-10 transition-[width,min-width] duration-200 ease-out',
          collapsed ? 'w-16 min-w-[64px]' : 'w-[260px] min-w-[260px]',
        )}
      >
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'mb-4 flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#e8e8e8] bg-white text-[#666] hover:text-[#13c2c2] transition-colors',
            collapsed ? 'self-center' : 'self-end',
          )}
        >
          <PanelLeft size={16} />
        </button>
        <div
          className={cn(
            'mb-8 flex items-center gap-2.5 pl-2 text-[1.1rem] font-bold text-[#333]',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[6px] bg-[#13c2c2]" aria-hidden />
          {!collapsed && <span className="brand-text">Aimos Model</span>}
        </div>
        <nav className="flex flex-col gap-1">
          {items.map(({ id, label, icon: Icon }) => {
            const active = activeNav === id;
            return (
              <div
                key={id}
                className={cn(
                  'flex cursor-default items-center gap-3 rounded-[6px] border-l-[3px] py-3 px-4 text-[0.9rem] transition-colors',
                  active
                    ? 'border-[#13c2c2] bg-[#13c2c2] text-white'
                    : 'border-transparent text-[#666] hover:bg-black/[0.04] hover:text-[#333]',
                  collapsed && 'justify-center px-2',
                )}
              >
                <Icon size={18} strokeWidth={2} className="shrink-0" />
                {!collapsed && <span className="nav-label">{label}</span>}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
