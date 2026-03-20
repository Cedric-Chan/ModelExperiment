import React, { useState, useMemo } from 'react';
import { TrainingTask, TaskInstance, HistoryVersion, initialMockTasks, IS_ADMIN, CURRENT_USER } from './components/data';
import { FilterBar, FilterValues, defaultFilters } from './components/FilterBar';
import { Toolbar, TaskTable, Pagination } from './components/TaskTable';
import {
  CreateEditModal, HistoryModal, ArtifactModal,
  useToast, ToastContainer
} from './components/Modals';
import { ConfigDetailPage } from './components/ConfigDetailPage';

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; task: TrainingTask }
  | { type: 'copy'; task: TrainingTask }
  | { type: 'history'; task: TrainingTask }
  | { type: 'artifact'; instance: TaskInstance }
  | null;

type ViewState =
  | { type: 'list' }
  | { type: 'config'; task: TrainingTask }
  | { type: 'run'; task: TrainingTask; instance: TaskInstance };

export default function App() {
  const [tasks, setTasks] = useState<TrainingTask[]>(initialMockTasks);
  const [view, setView] = useState<ViewState>({ type: 'list' });
  const [modal, setModal] = useState<ModalState>(null);
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [ownByMe, setOwnByMe] = useState(false);
  const { toasts, show: showToast } = useToast();

  /* ─── Filtered tasks ─── */
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const nameMatch  = !filters.expName || t.taskName.toLowerCase().includes(filters.expName.toLowerCase());
      const modelMatch = !filters.model   || t.modelName.toLowerCase().includes(filters.model.toLowerCase());
      const ownerMatch = !filters.owner   || t.owner.toLowerCase().includes(filters.owner.toLowerCase());
      const mineMatch  = !ownByMe         || t.owner === CURRENT_USER;
      return nameMatch && modelMatch && ownerMatch && mineMatch;
    });
  }, [tasks, filters, ownByMe]);

  /* ─── Handlers ─── */
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      showToast('Task list refreshed', 'success');
    }, 800);
  };

  const handleCreateTask = (data: Partial<TrainingTask>) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const newTask: TrainingTask = {
      id: `t${Date.now()}`,
      taskName: data.taskName || 'Untitled Task',
      modelName: data.modelName || '',
      region: data.region || 'SG',
      status: 'DRAFT',
      framework: data.framework || 'XGBoost',
      owner: data.owner || 'unknown',
      bizTeam: data.bizTeam || 'DataSci',
      description: data.description || '',
      createTime: nowStr,
      updateTime: nowStr,
      instances: [],
      history: [],
    };
    setTasks((prev) => [newTask, ...prev]);
    showToast(`Task "${newTask.taskName}" created`, 'success');
  };

  const handleEditTask = (data: Partial<TrainingTask>, taskId: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, ...data, updateTime: nowStr } : t
    ));
    showToast('Task updated successfully', 'success');
  };

  const handleStatusChange = (taskId: string, status: 'ENABLED' | 'DISABLED') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, status, updateTime: nowStr } : t
    ));
    showToast(`Task ${status === 'ENABLED' ? 'enabled' : 'disabled'}`, 'success');
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast(`Task "${task?.taskName}" deleted`, 'info');
  };

  const handleTrigger = (task: TrainingTask) => {
    const now = new Date();
    const ts = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const latestVersion = task.history[0]?.version || 'V1';
    const newInst: TaskInstance = {
      id: `inst-${Date.now().toString().slice(-5)}`,
      taskId: task.id,
      status: 'QUEUING',
      bindTask: latestVersion,
      triggerTime: ts,
      startTime: '-',
      finishTime: '-',
      duration: '-',
    };
    setTasks((prev) => prev.map((t) =>
      t.id === task.id ? { ...t, instances: [newInst, ...t.instances] } : t
    ));
    showToast(`New instance triggered for "${task.taskName}"`, 'success');
  };

  const handleInstanceContinue = (taskId: string, instanceId: string) => {
    showToast(`Instance ${instanceId} continued`, 'success');
  };

  const handleInstanceKill = (taskId: string, instanceId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.id === taskId
        ? {
          ...t,
          instances: t.instances.map((i) =>
            i.id === instanceId
              ? { ...i, status: 'KILLED' as const, finishTime: new Date().toISOString().split('T')[0] }
              : i
          )
        }
        : t
    ));
    showToast(`Instance ${instanceId} killed`, 'info');
  };

  const handleRollback = (taskId: string, version: HistoryVersion) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newVersion: HistoryVersion = {
      version: `V${task.history.length + 1}`,
      createdAt: now,
      createdBy: 'alice',
      config: version.config,
    };
    setTasks((prev) => prev.map((t) =>
      t.id === taskId
        ? { ...t, history: [newVersion, ...t.history], updateTime: now.split(' ')[0] }
        : t
    ));
    showToast(`Rolled back to ${version.version} — new version created`, 'success');
  };

  const handleSaveConfig = (task: TrainingTask) => {
    showToast(`Configuration saved for "${task.taskName}"`, 'success');
  };

  const handleFilterReset = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  /* ─── Config Detail View ─── */
  if (view.type === 'config') {
    return (
      <>
        <ConfigDetailPage
          task={view.task}
          onBack={() => setView({ type: 'list' })}
          onSave={(task) => {
            handleSaveConfig(task);
            setView({ type: 'list' });
          }}
          onRunCreated={(instance) => {
            const updatedTask = { ...view.task, instances: [instance, ...view.task.instances] };
            setTasks(prev => prev.map(t => t.id === view.task.id ? updatedTask : t));
            setView({ type: 'run', task: updatedTask, instance });
          }}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  /* ─── Run View ─── */
  if (view.type === 'run') {
    return (
      <>
        <ConfigDetailPage
          task={view.task}
          runInstance={view.instance}
          onBack={() => setView({ type: 'list' })}
          onBackToConfig={() => setView({ type: 'config', task: view.task })}
          onSave={() => {}}
          onKill={() => handleInstanceKill(view.task.id, view.instance.id)}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="w-full px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1 className="text-slate-900">Model Experiments</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-6 py-5 flex flex-col gap-4">
        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(1); }}
          onReset={handleFilterReset}
        />

        {/* Table Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-4">
          {/* Toolbar inside card */}
          <div className="px-5 pt-4">
            <Toolbar
              total={tasks.length}
              filtered={filteredTasks.length}
              onRefresh={handleRefresh}
              onCreateTask={() => setModal({ type: 'create' })}
              refreshing={refreshing}
              ownByMe={ownByMe}
              onOwnByMeChange={(v) => { setOwnByMe(v); setPage(1); }}
            />
          </div>

          {/* Table */}
          <TaskTable
            tasks={filteredTasks}
            onEdit={(task) => setView({ type: 'config', task })}
            onTrigger={handleTrigger}
            onCopy={(task) => setModal({ type: 'copy', task })}
            onStatusChange={handleStatusChange}
            onDelete={handleDeleteTask}
            onInstanceKill={handleInstanceKill}
            onInstanceArtifact={(inst) => setModal({ type: 'artifact', instance: inst })}
            onInstanceView={(taskId, instanceId) => {
              const task = tasks.find(t => t.id === taskId);
              const instance = task?.instances.find(i => i.id === instanceId);
              if (task && instance) setView({ type: 'run', task, instance });
            }}
            page={page}
            pageSize={pageSize}
          />

          {/* Pagination */}
          <div className="px-5 pb-4 border-t border-slate-100 pt-4">
            <Pagination
              total={filteredTasks.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateEditModal
          onClose={() => setModal(null)}
          onSubmit={handleCreateTask}
        />
      )}
      {modal?.type === 'edit' && (
        <CreateEditModal
          task={modal.task}
          onClose={() => setModal(null)}
          onSubmit={(data) => handleEditTask(data, modal.task.id)}
        />
      )}
      {modal?.type === 'copy' && (
        <CreateEditModal
          task={modal.task}
          isCopy
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            handleCreateTask(data);
            setTimeout(() => {
              const newTask = tasks.find(t => t.taskName === data.taskName);
              if (newTask) setView({ type: 'config', task: newTask });
            }, 100);
          }}
        />
      )}
      {modal?.type === 'history' && (
        <HistoryModal
          task={modal.task}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'artifact' && (
        <ArtifactModal
          instance={modal.instance}
          onClose={() => setModal(null)}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}