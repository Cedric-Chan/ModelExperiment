import React, { useState, useMemo } from 'react';
import {
  TrainingTask, TaskInstance, initialMockTasks, CURRENT_USER,
  filterExperimentsVisibleToOperator,
  getDefaultPipelineEnvRows,
  mergePipelineEnvWithDefaults,
} from './components/data';
import { FilterBar, FilterValues, defaultFilters } from './components/FilterBar';
import { Toolbar, TaskTable, Pagination } from './components/TaskTable';
import {
  CreateEditModal, HistoryModal, ArtifactModal,
  useToast, ToastContainer
} from './components/Modals';
import { ConfigDetailPage } from './components/ConfigDetailPage';
import { AppShell } from './components/AppShell';

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

  const visibleExperiments = useMemo(
    () => filterExperimentsVisibleToOperator(tasks),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const nameMatch  = !filters.expName || t.taskName.toLowerCase().includes(filters.expName.toLowerCase());
      const modelMatch = !filters.model   || t.modelName.toLowerCase().includes(filters.model.toLowerCase());
      const ownerMatch = !filters.owner   || t.owner.toLowerCase().includes(filters.owner.toLowerCase());
      const mineMatch  = !ownByMe         || t.owner === CURRENT_USER;
      return nameMatch && modelMatch && ownerMatch && mineMatch;
    });
  }, [tasks, filters, ownByMe]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      showToast('Task list refreshed', 'success');
    }, 800);
  };

  const handleCreateTask = (data: Partial<TrainingTask>): TrainingTask => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const pipEnv = mergePipelineEnvWithDefaults(
      data.pipelineEnv?.length ? data.pipelineEnv : getDefaultPipelineEnvRows().map((r) => ({ ...r })),
    );
    const newTask: TrainingTask = {
      id: `t${Date.now()}`,
      taskName: data.taskName || 'Untitled Task',
      modelName: data.modelName || '',
      modelVersion: data.modelVersion,
      region: data.region || 'SG',
      status: 'DRAFT',
      framework: data.framework || 'LightGBM',
      modelLevel: data.modelLevel ?? 'sub',
      owner: data.owner || 'unknown',
      bizTeam: data.bizTeam || 'DataSci',
      description: data.description || '',
      createTime: nowStr,
      updateTime: nowStr,
      instances: [],
      history: [],
      ...(data.templateExperimentName
        ? { templateExperimentName: data.templateExperimentName }
        : {}),
      pipelineEnv: pipEnv,
    };
    setTasks((prev) => [newTask, ...prev]);
    showToast(`Task "${newTask.taskName}" created`, 'success');
    return newTask;
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

  const handleInstanceContinue = (taskId: string, instanceId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.id === taskId
        ? {
          ...t,
          instances: t.instances.map((i) =>
            i.id === instanceId ? { ...i, status: 'RUNNING' as const } : i
          ),
        }
        : t
    ));
    setView((v) =>
      v.type === 'run' && v.task.id === taskId && v.instance.id === instanceId
        ? {
            type: 'run',
            task: {
              ...v.task,
              instances: v.task.instances.map((i) =>
                i.id === instanceId ? { ...i, status: 'RUNNING' as const } : i
              ),
            },
            instance: { ...v.instance, status: 'RUNNING' as const },
          }
        : v
    );
    showToast(`Run ${instanceId} continued`, 'success');
  };

  const handleSaveConfig = (task: TrainingTask) => {
    showToast(`Configuration saved for "${task.taskName}"`, 'success');
  };

  const handleFilterReset = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  let main: React.ReactNode;
  if (view.type === 'config') {
    main = (
      <ConfigDetailPage
        key={`experiment-config-${view.task.id}`}
        task={view.task}
        onBack={() => setView({ type: 'list' })}
        onPersistDraft={(t) => setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)))}
        onSave={(task) => {
          handleSaveConfig(task);
          setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
          setView({ type: 'list' });
        }}
        onRunCreated={(instance) => {
          const updatedTask = { ...view.task, instances: [instance, ...view.task.instances] };
          setTasks(prev => prev.map(t => t.id === view.task.id ? updatedTask : t));
          setView({ type: 'run', task: updatedTask, instance });
        }}
      />
    );
  } else if (view.type === 'run') {
    main = (
      <ConfigDetailPage
        key={`experiment-run-${view.task.id}-${view.instance.id}`}
        task={view.task}
        runInstance={view.instance}
        onBack={() => setView({ type: 'list' })}
        onBackToConfig={() => setView({ type: 'config', task: view.task })}
        onSave={() => {}}
        onKill={() => handleInstanceKill(view.task.id, view.instance.id)}
        onContinueRun={() => handleInstanceContinue(view.task.id, view.instance.id)}
      />
    );
  } else {
    main = (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#f5f7fa]">
        <header className="bg-white border-b border-gray-100 shadow-sm">
          <div className="mx-auto flex w-full max-w-[min(100%,1920px)] items-center gap-3 px-6 py-4 sm:px-8 lg:px-10">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#13c2c2] shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 className="text-lg font-semibold leading-tight text-gray-800 sm:text-xl">
              Model Experiments
            </h1>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[min(100%,1920px)] flex-col gap-5 px-6 py-6 sm:px-8 lg:px-10">
          <FilterBar
            filters={filters}
            onChange={(f) => { setFilters(f); setPage(1); }}
            onReset={handleFilterReset}
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <Toolbar
              total={tasks.length}
              filtered={filteredTasks.length}
              onRefresh={handleRefresh}
              onCreateTask={() => setModal({ type: 'create' })}
              refreshing={refreshing}
              ownByMe={ownByMe}
              onOwnByMeChange={(v) => { setOwnByMe(v); setPage(1); }}
            />

            <TaskTable
              tasks={filteredTasks}
              onEdit={(task) => setView({ type: 'config', task })}
              onCopy={(task) => setModal({ type: 'copy', task })}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
        onInstanceKill={handleInstanceKill}
          onInstanceContinue={handleInstanceContinue}
          onInstanceArtifact={(inst) => setModal({ type: 'artifact', instance: inst })}
          onInstanceView={(taskId, instanceId) => {
                const task = tasks.find(t => t.id === taskId);
                const instance = task?.instances.find(i => i.id === instanceId);
                if (task && instance) setView({ type: 'run', task, instance });
              }}
              page={page}
              pageSize={pageSize}
            />
          </div>

          <Pagination
            total={filteredTasks.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell activeNav="pipelines">{main}</AppShell>

      {modal?.type === 'create' && (
        <CreateEditModal
          visibleExperiments={visibleExperiments}
          onClose={() => setModal(null)}
          onSubmit={handleCreateTask}
        />
      )}
      {modal?.type === 'edit' && (
        <CreateEditModal
          visibleExperiments={visibleExperiments}
          task={modal.task}
          onClose={() => setModal(null)}
          onSubmit={(data) => handleEditTask(data, modal.task.id)}
        />
      )}
      {modal?.type === 'copy' && (
        <CreateEditModal
          visibleExperiments={visibleExperiments}
          task={modal.task}
          isCopy
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            const created = handleCreateTask(data);
            setView({ type: 'config', task: created });
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
    </>
  );
}
