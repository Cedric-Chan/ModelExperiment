import React from 'react';
import { TaskStatus, InstanceStatus } from './data';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = {
    ENABLED: {
      label: 'ENABLED',
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      dot: 'bg-emerald-500',
    },
    DRAFT: {
      label: 'DRAFT',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
      dot: 'bg-slate-400',
    },
    DISABLED: {
      label: 'DISABLED',
      className: 'bg-orange-50 text-orange-700 border border-orange-200',
      dot: 'bg-orange-500',
    },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

interface InstanceStatusBadgeProps {
  status: InstanceStatus;
}

export function InstanceStatusBadge({ status }: InstanceStatusBadgeProps) {
  const configMap: Record<string, { label: string; className: string; dot: string; pulse: boolean }> = {
    QUEUING: {
      label: 'QUEUING',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
      dot: 'bg-slate-400',
      pulse: false,
    },
    WAITING: {
      label: 'WAITING',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
      dot: 'bg-slate-400',
      pulse: false,
    },
    RUNNING: {
      label: 'RUNNING',
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
      dot: 'bg-blue-500',
      pulse: true,
    },
    SUCCESS: {
      label: 'SUCCESS',
      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      dot: 'bg-emerald-500',
      pulse: false,
    },
    FAILED: {
      label: 'FAILED',
      className: 'bg-rose-50 text-rose-700 border border-rose-200',
      dot: 'bg-rose-500',
      pulse: false,
    },
    KILLED: {
      label: 'KILLED',
      className: 'bg-gray-100 text-gray-600 border border-gray-200',
      dot: 'bg-gray-500',
      pulse: false,
    },
  };

  const config = configMap[status] ?? {
    label: status ?? 'UNKNOWN',
    className: 'bg-slate-100 text-slate-500 border border-slate-200',
    dot: 'bg-slate-400',
    pulse: false,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${config.className}`}>
      <span className={`relative flex h-1.5 w-1.5`}>
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`} />
      </span>
      {config.label}
    </span>
  );
}

interface RegionBadgeProps {
  region: string;
}

export function RegionBadge({ region }: RegionBadgeProps) {
  return (
    <span className="inline-block shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-sm text-indigo-700">
      {region}
    </span>
  );
}