import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  ArrowLeft, Save, ZoomIn, ZoomOut, ArrowUpToLine,
  Maximize2, GitBranch, Database,
  Settings, Lock, X,
  CheckCheck, AlertCircle, Loader2, ShieldCheck,
  ChevronDown, Check as CheckIcon, SlidersHorizontal,
  Filter, Cpu, TrendingUp, Sliders,
  History, Clock, RotateCcw, PlayCircle, PowerOff, Trash2,
  Power, Rewind, FastForward, CheckCircle2, AlertTriangle, XCircle,
  HelpCircle, Table2, FolderOpen, Copy, Plus, FileText, StopCircle, Zap,
  Pencil, Flag
} from 'lucide-react';
import { TrainingTask, ALL_OWNERS, REGISTERED_MODELS, TaskInstance, InstanceStatus } from './data';
import { TaskStatusBadge, RegionBadge, InstanceStatusBadge } from './StatusBadge';
import { WoeBinningModal } from './WoeBinningModal';

interface ConfigDetailPageProps {
  task: TrainingTask;
  onBack: () => void;
  onSave: (task: TrainingTask) => void;
  /** When provided, the page enters read-only Run View mode */
  runInstance?: TaskInstance;
  /** Called by the "Back to Config" button in Run View — navigates to the edit canvas */
  onBackToConfig?: () => void;
  /** Kill the current runInstance */
  onKill?: () => void;
  /** Called when a new run is successfully submitted — receives the new TaskInstance */
  onRunCreated?: (instance: TaskInstance) => void;
}

/* ─────────────── Node types ─────────────── */
type NodeType =
  | 'data_source'
  | 'woe_process'
  | 'woe_update'
  | 'feature_sel'
  | 'model_tune'
  | 'model_inference'
  | 'model_calibrate';

interface DagNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  status?: 'ready' | 'pending' | 'locked';
}

interface DagEdge {
  from: string;
  to: string;
  label?: string;
}

/* ─────────────── Version / Last-run types ─────────────── */
interface NodeLastRun {
  runId: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'SKIPPED';
  finishedTime: string;
  duration: string;
  artifact: { label: string; value: string }[];
}

type LastRunMap = Partial<Record<NodeType, NodeLastRun>>;

interface VersionSnapshot {
  version: string;
  runId: string;
  createdAt: string;
  lastRunMap: LastRunMap;
  /** per-node id → partial overrides applied on top of default nodes */
  nodePatches?: Record<string, { sublabel?: string }>;
  /** per-node-type config property overrides */
  propOverrides?: Partial<Record<NodeType, { label: string; value: string }[]>>;
}

/* ─────────────── Constants ─────────────── */
const NODE_W = 164;
const NODE_H  = 62;
const GX = 206;
const MID = 240;
const X0  = 50;

const CURRENT_VERSION = 'v4';

/* ─────────────── Node styles ─────────────── */
const NODE_STYLES: Record<NodeType, {
  bg: string; border: string; icon: React.ReactNode; accent: string; iconBg: string;
}> = {
  data_source: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <Database size={14} className="text-blue-500" />,
  },
  woe_process: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <Sliders size={14} className="text-blue-500" />,
  },
  woe_update: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <RotateCcw size={14} className="text-blue-500" />,
  },
  feature_sel: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <Filter size={14} className="text-blue-500" />,
  },
  model_tune: {
    bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700',
    iconBg: 'bg-amber-100',
    icon: <Settings size={14} className="text-amber-500" />,
  },
  model_inference: {
    bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700',
    iconBg: 'bg-amber-100',
    icon: <Cpu size={14} className="text-amber-500" />,
  },
  model_calibrate: {
    bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700',
    iconBg: 'bg-amber-100',
    icon: <TrendingUp size={14} className="text-amber-500" />,
  },
};

/* ─────────────── Default DAG builder ─────────────── */
function buildDefaultDag(): { nodes: DagNode[]; edges: DagEdge[] } {
  const nodes: DagNode[] = [
    { id: 'n1', type: 'data_source',    label: 'DataSource',         sublabel: 'Feature Store · Label source',               x: X0+GX*0, y: MID, status: 'ready'   },
    { id: 'n2', type: 'woe_process',    label: 'WOE Process',        sublabel: 'Fit_Transform_Merge · All Features',         x: X0+GX*1, y: MID, status: 'ready'   },
    { id: 'n3', type: 'feature_sel',    label: 'Feature Selection',  sublabel: 'Filter · Fine Feature Report',               x: X0+GX*2, y: MID, status: 'ready'   },
    { id: 'n4', type: 'woe_update',     label: 'WOE Update',         sublabel: 'Update_Fit_Transform · Selected Feats',      x: X0+GX*3, y: MID, status: 'ready'   },
    { id: 'n5', type: 'model_tune',     label: 'Model Tune · Train', sublabel: 'Tune + Train · Best params',                 x: X0+GX*4, y: MID, status: 'pending' },
    { id: 'n6', type: 'model_inference',label: 'Model Inference',    sublabel: 'Score · Predict · Export',                   x: X0+GX*5, y: MID, status: 'pending' },
    { id: 'n7', type: 'model_calibrate',label: 'Calibrate',          sublabel: 'Platt Scaling · Score mapping',              x: X0+GX*6, y: MID, status: 'locked'  },
  ];
  const edges: DagEdge[] = [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3', label: 'SavePoint' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5', label: 'SavePoint' },
    { from: 'n5', to: 'n6' },
    { from: 'n6', to: 'n7' },
  ];
  return { nodes, edges };
}

/* ─────────────── Default (current) last-run data ─────────────── */
const CURRENT_LAST_RUN: LastRunMap = {
  data_source:     { runId: 'run-20250305-0841', status: 'SUCCESS', finishedTime: '2025-03-05 08:41:22', duration: '3m 12s',  artifact: [{ label: 'Rows loaded',  value: '4,821,306' }, { label: 'Feature cols', value: '218' },         { label: 'Label col',    value: 'is_default_30d' },         { label: 'Output path', value: 'hdfs://data/feat/v12'        }] },
  woe_process:     { runId: 'run-20250305-0844', status: 'SUCCESS', finishedTime: '2025-03-05 08:49:07', duration: '4m 45s',  artifact: [{ label: 'Features in',  value: '218' },        { label: 'Bins created', value: '1,940' },        { label: 'Avg IV',       value: '0.132' },                  { label: 'Output path', value: 'hdfs://woe/v12/all'          }] },
  feature_sel:     { runId: 'run-20250305-0849', status: 'SUCCESS', finishedTime: '2025-03-05 08:52:31', duration: '3m 24s',  artifact: [{ label: 'Features in',  value: '218' },        { label: 'Features out', value: '64' },          { label: 'IV threshold', value: '≥ 0.02' },                { label: 'Report path', value: 'hdfs://report/feat_fine_v12' }] },
  woe_update:      { runId: 'run-20250305-0850', status: 'SUCCESS', finishedTime: '2025-03-05 08:51:43', duration: '1m 36s',  artifact: [{ label: 'Features in',  value: '64' },         { label: 'Updated bins', value: '12' },          { label: 'WOE overrides',value: '3' },                      { label: 'Output path', value: 'hdfs://woe/v12/updated'      }] },
  model_tune:      { runId: 'run-20250305-0853', status: 'SUCCESS', finishedTime: '2025-03-05 09:41:18', duration: '74m 25s', artifact: [{ label: 'Best AUC',     value: '0.8923' },     { label: 'Best trial',   value: '#37 / 50' },     { label: 'Train AUC',    value: '0.9104' },                 { label: 'Model path',  value: 'mlflow://models/lgbm-v12'    }] },
  model_inference: { runId: 'run-20250305-1011', status: 'SUCCESS', finishedTime: '2025-03-05 10:24:39', duration: '13m 37s', artifact: [{ label: 'Rows scored',  value: '2,104,887' }, { label: 'Score range',  value: '[0.001, 0.982]' }, { label: 'Score mean',   value: '0.087' },                  { label: 'Output table',value: 'hive://score.lgbm_v12_0305'  }] },
  model_calibrate: { runId: 'run-20250305-1025', status: 'SUCCESS', finishedTime: '2025-03-05 10:31:14', duration: '5m 35s',  artifact: [{ label: 'Method',       value: 'Platt Scaling' }, { label: 'Brier score',value: '0.0413' },        { label: 'ECE',          value: '0.0082' },                 { label: 'Model path',  value: 'mlflow://calib/lgbm-v12'     }] },
};

/* ─────────────── Version history mock data ─────────────── */
const VERSION_HISTORY: VersionSnapshot[] = [
  {
    version: 'v3',
    runId: 'run-20250221-1140',
    createdAt: '2025-02-21 11:40',
    nodePatches: { n4: { sublabel: 'Update_Fit_Transform · v3 feats' } },
    propOverrides: {
      feature_sel: [{ label: 'Selection Method', value: 'IV filter only' }, { label: 'IV Threshold', value: '≥ 0.03' }, { label: 'Corr Threshold', value: '< 0.90' }, { label: 'Output', value: 'Feature list v3' }],
      model_tune:  [{ label: 'HPO Trials', value: '40' }, { label: 'CV Folds', value: '5' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '3600 s' }, { label: 'Early Stop', value: '15 rounds' }],
    },
    lastRunMap: {
      data_source:     { runId: 'run-20250221-0910', status: 'SUCCESS', finishedTime: '2025-02-21 09:14:08', duration: '4m 01s',   artifact: [{ label: 'Rows loaded',  value: '4,613,220' }, { label: 'Feature cols', value: '218' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v11' }] },
      woe_process:     { runId: 'run-20250221-0914', status: 'SUCCESS', finishedTime: '2025-02-21 09:19:42', duration: '5m 34s',   artifact: [{ label: 'Features in',  value: '218' },        { label: 'Bins created', value: '1,890' }, { label: 'Avg IV', value: '0.119' }, { label: 'Output path', value: 'hdfs://woe/v11/all' }] },
      feature_sel:     { runId: 'run-20250221-0919', status: 'SUCCESS', finishedTime: '2025-02-21 09:23:55', duration: '4m 13s',   artifact: [{ label: 'Features in',  value: '218' },        { label: 'Features out', value: '71' }, { label: 'IV threshold', value: '≥ 0.03' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v11' }] },
      woe_update:      { runId: 'run-20250221-0928', status: 'SUCCESS', finishedTime: '2025-02-21 09:30:11', duration: '1m 16s',   artifact: [{ label: 'Features in',  value: '71' },         { label: 'Updated bins', value: '9' },  { label: 'WOE overrides', value: '2' }, { label: 'Output path', value: 'hdfs://woe/v11/updated' }] },
      model_tune:      { runId: 'run-20250221-0924', status: 'SUCCESS', finishedTime: '2025-02-21 10:48:11', duration: '112m 7s',  artifact: [{ label: 'Best AUC',     value: '0.8811' },     { label: 'Best trial',   value: '#29 / 40' }, { label: 'Train AUC', value: '0.9012' }, { label: 'Model path', value: 'mlflow://models/lgbm-v11' }] },
      model_inference: { runId: 'run-20250221-1121', status: 'SUCCESS', finishedTime: '2025-02-21 11:35:47', duration: '14m 14s',  artifact: [{ label: 'Rows scored',  value: '2,087,341' }, { label: 'Score range',  value: '[0.002, 0.971]' }, { label: 'Score mean', value: '0.091' }, { label: 'Output table', value: 'hive://score.lgbm_v11_0221' }] },
      model_calibrate: { runId: 'run-20250221-1136', status: 'SUCCESS', finishedTime: '2025-02-21 11:41:29', duration: '5m 42s',   artifact: [{ label: 'Method',       value: 'Platt Scaling' }, { label: 'Brier score', value: '0.0441' }, { label: 'ECE', value: '0.0097' }, { label: 'Model path', value: 'mlflow://calib/lgbm-v11' }] },
    },
  },
  {
    version: 'v2',
    runId: 'run-20250207-0830',
    createdAt: '2025-02-07 08:30',
    nodePatches: { n2: { sublabel: 'Fit_Transform_Merge · All (v2)' } },
    propOverrides: {
      model_tune:  [{ label: 'HPO Trials', value: '30' }, { label: 'CV Folds', value: '3' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '2400 s' }, { label: 'Early Stop', value: '10 rounds' }],
      data_source: [{ label: 'Source Type', value: 'Feature Store' }, { label: 'Lookback', value: '60 days' }, { label: 'Sampling', value: '80%' }, { label: 'Partition', value: 'dt=2025-01-31' }, { label: 'Label Source', value: 'Event Log · 60d' }],
    },
    lastRunMap: {
      data_source:     { runId: 'run-20250207-0600', status: 'SUCCESS', finishedTime: '2025-02-07 06:08:14', duration: '8m 14s',   artifact: [{ label: 'Rows loaded',  value: '8,104,992' }, { label: 'Feature cols', value: '218' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v10' }] },
      woe_process:     { runId: 'run-20250207-0608', status: 'SUCCESS', finishedTime: '2025-02-07 06:16:47', duration: '8m 33s',   artifact: [{ label: 'Features in',  value: '218' },        { label: 'Bins created', value: '1,832' }, { label: 'Avg IV', value: '0.108' }, { label: 'Output path', value: 'hdfs://woe/v10/all' }] },
      feature_sel:     { runId: 'run-20250207-0617', status: 'SUCCESS', finishedTime: '2025-02-07 06:22:05', duration: '5m 18s',   artifact: [{ label: 'Features in',  value: '218' },        { label: 'Features out', value: '58' }, { label: 'IV threshold', value: '≥ 0.02' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v10' }] },
      woe_update:      { runId: 'run-20250207-0622', status: 'SUCCESS', finishedTime: '2025-02-07 06:24:18', duration: '2m 13s',   artifact: [{ label: 'Features in',  value: '58' },         { label: 'Updated bins', value: '7' },  { label: 'WOE overrides', value: '1' }, { label: 'Output path', value: 'hdfs://woe/v10/updated' }] },
      model_tune:      { runId: 'run-20250207-0625', status: 'FAILED',  finishedTime: '2025-02-07 07:39:11', duration: '74m 53s',  artifact: [{ label: 'Best AUC',     value: '0.8643 (partial)' }, { label: 'Completed trials', value: '22 / 30' }, { label: 'Error', value: 'OOM at trial #23' }, { label: 'Params path', value: 'mlflow://tune/run-0207' }] },
      model_inference: { runId: 'run-20250207-0742', status: 'SUCCESS', finishedTime: '2025-02-07 07:58:04', duration: '15m 36s',  artifact: [{ label: 'Rows scored',  value: '2,031,774' }, { label: 'Score range',  value: '[0.003, 0.964]' }, { label: 'Score mean', value: '0.096' }, { label: 'Output table', value: 'hive://score.lgbm_v10_0207' }] },
      model_calibrate: { runId: 'run-20250207-0759', status: 'SUCCESS', finishedTime: '2025-02-07 08:05:22', duration: '6m 18s',   artifact: [{ label: 'Method',       value: 'Platt Scaling' }, { label: 'Brier score', value: '0.0468' }, { label: 'ECE', value: '0.0114' }, { label: 'Model path', value: 'mlflow://calib/lgbm-v10' }] },
    },
  },
  {
    version: 'v1',
    runId: 'run-20250120-1530',
    createdAt: '2025-01-20 15:30',
    nodePatches: { n5: { sublabel: 'RandomSearch · Tune+Train (v1)' } },
    propOverrides: {
      model_tune:  [{ label: 'HPO Trials', value: '20' }, { label: 'CV Folds', value: '3' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '1800 s' }, { label: 'Early Stop', value: '10 rounds' }],
      woe_process: [{ label: 'WOE Bins', value: '8 (fixed)' }, { label: 'Min Bin Rate', value: '3%' }, { label: 'Merge Strategy', value: 'Adjacent' }, { label: 'Output', value: 'IV + WOE-encoded features' }],
    },
    lastRunMap: {
      data_source:     { runId: 'run-20250120-1100', status: 'SUCCESS', finishedTime: '2025-01-20 11:09:31', duration: '9m 31s',   artifact: [{ label: 'Rows loaded',  value: '3,940,118' }, { label: 'Feature cols', value: '200' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v9' }] },
      woe_process:     { runId: 'run-20250120-1110', status: 'SUCCESS', finishedTime: '2025-01-20 11:21:07', duration: '11m 36s',  artifact: [{ label: 'Features in',  value: '200' },        { label: 'Bins created', value: '1,600' }, { label: 'Avg IV', value: '0.098' }, { label: 'Output path', value: 'hdfs://woe/v9/all' }] },
      feature_sel:     { runId: 'run-20250120-1121', status: 'SUCCESS', finishedTime: '2025-01-20 11:27:44', duration: '6m 37s',   artifact: [{ label: 'Features in',  value: '200' },        { label: 'Features out', value: '52' }, { label: 'IV threshold', value: '≥ 0.02' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v9' }] },
      woe_update:      { runId: 'run-20250120-1128', status: 'SUCCESS', finishedTime: '2025-01-20 11:30:05', duration: '2m 21s',   artifact: [{ label: 'Features in',  value: '52' },         { label: 'Updated bins', value: '5' },  { label: 'WOE overrides', value: '0' }, { label: 'Output path', value: 'hdfs://woe/v9/updated' }] },
      model_tune:      { runId: 'run-20250120-1132', status: 'SUCCESS', finishedTime: '2025-01-20 12:42:19', duration: '70m 14s',  artifact: [{ label: 'Best AUC',     value: '0.8574' },     { label: 'Best trial',   value: '#18 / 20' }, { label: 'Train AUC', value: '0.8801' }, { label: 'Model path', value: 'mlflow://models/lgbm-v9' }] },
      model_inference: { runId: 'run-20250120-1246', status: 'SUCCESS', finishedTime: '2025-01-20 13:02:38', duration: '16m 28s',  artifact: [{ label: 'Rows scored',  value: '1,988,445' }, { label: 'Score range',  value: '[0.005, 0.956]' }, { label: 'Score mean', value: '0.102' }, { label: 'Output table', value: 'hive://score.lgbm_v9_0120' }] },
      model_calibrate: { runId: 'run-20250120-1303', status: 'SKIPPED', finishedTime: '2025-01-20 13:03:09', duration: '0m 31s',   artifact: [{ label: 'Method',       value: 'Platt Scaling' }, { label: 'Brier score', value: 'N/A' }, { label: 'ECE', value: 'N/A' }, { label: 'Model path', value: 'mlflow://calib/lgbm-v9 (no calib)' }] },
    },
  },
];

/* ─────────────── Default config props per node type ─────────────── */
const DEFAULT_PROPS: Record<NodeType, { label: string; value: string }[]> = {
  data_source:      [{ label: 'Source Type', value: 'Feature Store' }, { label: 'Lookback', value: '30 days' }, { label: 'Sampling', value: '100%' }, { label: 'Partition', value: 'dt=2025-03-01' }, { label: 'Label Source', value: 'Event Log · 30d' }],
  woe_process:      [{ label: 'WOE Bins', value: '10 (auto)' }, { label: 'Min Bin Rate', value: '5%' }, { label: 'Merge Strategy', value: 'Monotone' }, { label: 'Output', value: 'IV + WOE-encoded features' }],
  woe_update:       [{ label: 'Mode', value: 'Update_Fit_Transform' }, { label: 'Input', value: 'Selected Features' }, { label: 'ws_list Override', value: 'Optional' }, { label: 'Output', value: 'Updated encoder + merged result' }],
  feature_sel:      [{ label: 'Selection Method', value: 'IV + Corr filter' }, { label: 'IV Threshold', value: '≥ 0.02' }, { label: 'Corr Threshold', value: '< 0.85' }, { label: 'Output', value: 'Fine Feature Report + list' }],
  model_tune:      [{ label: 'HPO Trials', value: '50' }, { label: 'CV Folds', value: '5' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '3600 s' }, { label: 'Early Stop', value: '20 rounds' }],
  model_inference: [{ label: 'Mode', value: 'Batch scoring' }, { label: 'Input', value: 'Best model artifact' }, { label: 'Output', value: 'Score CSV / Hive table' }, { label: 'Partition', value: 'dt=today' }],
  model_calibrate:  [{ label: 'Method', value: 'Platt Scaling' }, { label: 'CV Folds', value: '5' }, { label: 'Output', value: 'Calibrated probability' }, { label: 'Registry', value: 'MLFlow · Staging' }],
};

/* ─────────────── Run View — Node Execution Status ─────────────── */
type NodeRunStatus = 'success' | 'running' | 'failed' | 'skipped' | 'pending';

function deriveNodeRunStatuses(instance: TaskInstance): Record<string, NodeRunStatus> {
  const { status } = instance;
  // DAG pipeline segments (linear: n1→…→n7)
  const earlyNodes = ['n1', 'n2', 'n3', 'n4'];
  const midNodes   = ['n5'];
  const lateNodes  = ['n6', 'n7'];
  const result: Record<string, NodeRunStatus> = {};

  switch (status as InstanceStatus) {
    case 'SUCCESS':
      [...earlyNodes, ...midNodes, ...lateNodes].forEach(id => { result[id] = 'success'; });
      break;
    case 'FAILED':
      earlyNodes.forEach(id => { result[id] = 'success'; });
      midNodes.forEach(id => { result[id] = 'failed'; });
      lateNodes.forEach(id => { result[id] = 'skipped'; });
      break;
    case 'RUNNING':
      earlyNodes.forEach(id => { result[id] = 'success'; });
      midNodes.forEach(id => { result[id] = 'running'; });
      lateNodes.forEach(id => { result[id] = 'pending'; });
      break;
    case 'QUEUING':
      [...earlyNodes, ...midNodes, ...lateNodes].forEach(id => { result[id] = 'pending'; });
      break;
    case 'KILLED':
      earlyNodes.forEach(id => { result[id] = 'success'; });
      midNodes.forEach(id => { result[id] = 'skipped'; });
      lateNodes.forEach(id => { result[id] = 'skipped'; });
      break;
    default:
      [...earlyNodes, ...midNodes, ...lateNodes].forEach(id => { result[id] = 'pending'; });
  }
  return result;
}

/* ─────────────── Arrow ─────────────── */
function Arrow({ edge, nodes }: { edge: DagEdge; nodes: DagNode[] }) {
  const src = nodes.find(n => n.id === edge.from);
  const dst = nodes.find(n => n.id === edge.to);
  if (!src || !dst) return null;
  const x1 = src.x + NODE_W, y1 = src.y + NODE_H / 2;
  const x2 = dst.x,          y2 = dst.y + NODE_H / 2;
  const mx = x1 + (x2 - x1) * 0.5;
  return <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />;
}

/* ─────────────── DAG Node Card ─────────────── */
function DagNodeCard({ node, selected, hasError, errorMsg, onSelect, onDragStart, runExecStatus }: {
  node: DagNode; selected: boolean; hasError?: boolean; errorMsg?: string;
  runExecStatus?: NodeRunStatus;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent, id: string) => void;
}) {
  const style = NODE_STYLES[node.type] ?? NODE_STYLES.data_source;
  const isFirstPipeline = node.type === 'data_source';
  const isRunView = runExecStatus !== undefined;

  // Border/shadow in run view mode
  const runBorderCls =
    runExecStatus === 'success' ? 'border-emerald-400 shadow-emerald-100 shadow-md'
    : runExecStatus === 'running' ? 'border-blue-400 shadow-blue-100 shadow-md'
    : runExecStatus === 'failed'  ? 'border-rose-400 shadow-rose-100 shadow-md'
    : runExecStatus === 'skipped' ? 'border-amber-400 shadow-amber-50 shadow-md'
    : 'border-slate-300'; // pending

  // Background in run view mode
  const runBgCls =
    runExecStatus === 'success' ? 'bg-emerald-50/70'
    : runExecStatus === 'running' ? 'bg-blue-50/70'
    : runExecStatus === 'failed'  ? 'bg-rose-50/70'
    : runExecStatus === 'skipped' ? 'bg-amber-50/70'
    : 'bg-slate-100/80'; // pending

  const borderCls = isRunView
    ? runBorderCls
    : selected
      ? 'border-[#13c2c2] shadow-[#13c2c2]/20 shadow-md'
      : hasError
        ? 'border-rose-400 shadow-rose-200 shadow-md'
        : isFirstPipeline
          ? 'border-emerald-400 shadow-emerald-100 shadow-sm'
          : style.border;

  const bgCls = isRunView ? runBgCls : (hasError ? 'bg-rose-50/60' : style.bg);

  // No dimming — all statuses now use explicit colors
  const dimCls = '';

  return (
    <div
      className={`absolute select-none cursor-pointer rounded-xl border-2 transition-all ${bgCls} ${borderCls} ${dimCls} hover:shadow-md`}
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      onMouseDown={e => { if (e.button === 0) onDragStart(e, node.id); }}
      title={!isRunView && hasError && errorMsg ? errorMsg : undefined}
    >
      {/* Run view — pulsing ring for RUNNING node */}
      {isRunView && runExecStatus === 'running' && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-400 animate-ping opacity-30 pointer-events-none" />
      )}
      {/* Non-run-view — error pulse ring */}
      {!isRunView && hasError && (
        <div className="absolute inset-0 rounded-xl border-2 border-rose-400 animate-ping opacity-20 pointer-events-none" />
      )}

      <div className="flex items-center gap-2 px-3 h-full">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${!isRunView && hasError ? 'bg-rose-100' : style.iconBg}`}>
          {!isRunView && hasError ? <AlertTriangle size={13} className="text-rose-500" /> : style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold truncate leading-tight ${!isRunView && hasError ? 'text-rose-600' : style.accent}`}>{node.label}</p>
          <p className={`text-[10px] truncate mt-0.5 leading-tight ${!isRunView && hasError ? 'text-rose-400' : 'text-slate-400'}`}>{node.sublabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-0.5">
          {!isRunView && hasError && <XCircle size={11} className="text-rose-400" />}
          {!isRunView && !hasError && node.status === 'locked' && <Lock size={10} className="text-slate-300" />}

          {/* Run view small status icon */}
          {isRunView && runExecStatus === 'running' && <Loader2 size={10} className="text-blue-500 animate-spin" />}
          {isRunView && runExecStatus === 'failed'  && <XCircle size={10} className="text-rose-400" />}
          {isRunView && runExecStatus === 'skipped' && <span className="text-[8px] font-bold text-amber-500 leading-none">SKIP</span>}
          {isRunView && runExecStatus === 'pending' && <span className="text-[8px] font-bold text-slate-400 leading-none">—</span>}
        </div>
      </div>

      {/* Corner dot — normal view */}
      {!isRunView && selected && !hasError && <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[#13c2c2] border-2 border-white shadow" />}
      {!isRunView && isFirstPipeline && !selected && !hasError && <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />}
      {!isRunView && hasError && <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-white shadow" />}

      {/* Corner badge — run view */}
      {isRunView && runExecStatus === 'success' && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow flex items-center justify-center">
          <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
            <path d="M0.5 2.5L2 4L5.5 0.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      {isRunView && runExecStatus === 'running' && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        </div>
      )}
      {isRunView && runExecStatus === 'failed' && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow flex items-center justify-center">
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
            <path d="M1 1L5 5M5 1L1 5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
      )}
      {isRunView && runExecStatus === 'skipped' && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow flex items-center justify-center">
          <svg width="6" height="4" viewBox="0 0 6 4" fill="none">
            <path d="M0.5 2H5.5M3.5 0.5L5.5 2L3.5 3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      {isRunView && runExecStatus === 'pending' && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white shadow" />
      )}
    </div>
  );
}

/* ─────────────── Section divider ─────────────── */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-slate-100" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

/* ─────────────── Run History utilities ─────────────── */

/** Derive per-node execution status from a snapshot's lastRunMap */
function deriveNodeRunStatusesFromLastRunMap(lastRunMap: LastRunMap): Record<string, NodeRunStatus> {
  const to = (s?: string): NodeRunStatus => {
    if (s === 'SUCCESS') return 'success';
    if (s === 'FAILED')  return 'failed';
    if (s === 'RUNNING') return 'running';
    if (s === 'SKIPPED') return 'skipped';
    return 'pending';
  };
  return {
    n1: to(lastRunMap.data_source?.status),
    n2: to(lastRunMap.woe_process?.status),
    n3: to(lastRunMap.feature_sel?.status),
    n4: to(lastRunMap.woe_update?.status),
    n5: to(lastRunMap.model_tune?.status),
    n6: to(lastRunMap.model_inference?.status),
    n7: to(lastRunMap.model_calibrate?.status),
  };
}

/** Derive overall pipeline status from a lastRunMap */
function getRunOverallStatus(lastRunMap: LastRunMap): 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'RUNNING' {
  const vals = Object.values(lastRunMap).filter(Boolean) as { status: string }[];
  if (vals.some(v => v.status === 'FAILED'))  return 'FAILED';
  if (vals.some(v => v.status === 'RUNNING')) return 'RUNNING';
  if (vals.some(v => v.status === 'SKIPPED') && vals.some(v => v.status === 'SUCCESS')) return 'PARTIAL';
  return 'SUCCESS';
}

function RunOverallStatusBadge({ status }: { status: ReturnType<typeof getRunOverallStatus> }) {
  const cfg = {
    SUCCESS: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    FAILED:  { cls: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500'    },
    PARTIAL: { cls: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500'   },
    RUNNING: { cls: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500'    },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border leading-tight ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {status}
    </span>
  );
}

/* ─────────────── Run History Dropdown ─────────────── */
function RunHistoryDropdown({
  currentVersion,
  activeRunId,
  onSelectRun,
}: {
  currentVersion: string;
  activeRunId?: string;
  onSelectRun: (snap: VersionSnapshot) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // "Latest / current" entry built from CURRENT_LAST_RUN
  const latestSnap: VersionSnapshot = {
    version: currentVersion,
    runId: 'run-20250305-0841',
    createdAt: '2025-03-05 08:41',
    lastRunMap: CURRENT_LAST_RUN,
  };

  // Derive end time (latest finishedTime across all node runs)
  const getEndTime = (lrm: LastRunMap) =>
    (Object.values(lrm).filter(Boolean) as { finishedTime: string }[])
      .map(t => t.finishedTime)
      .sort()
      .at(-1)
      ?.slice(0, 16) ?? '—';

  const allRuns = [latestSnap, ...VERSION_HISTORY];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className={`h-8 flex items-center gap-1.5 px-3 rounded-lg border text-xs font-medium transition-all whitespace-nowrap
          ${open
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700'}`}
      >
        <History size={13} className={open ? 'text-indigo-500' : 'text-slate-400'} />
        Run History
        <ChevronDown size={10} className={`transition-transform ml-0.5 ${open ? 'rotate-180 text-indigo-400' : 'text-slate-300'}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[440px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-2.5 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <History size={12} className="text-indigo-500" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Run History</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{allRuns.length} runs total</span>
          </div>

          {/* Column headers */}
          <div className="grid items-center px-4 py-1.5 border-b border-slate-100 bg-slate-50/70"
            style={{ gridTemplateColumns: '1fr 80px 108px 108px' }}>
            {['Run ID · Version', 'Status', 'Start', 'End'].map(h => (
              <span key={h} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-50">
            {allRuns.map((snap, idx) => {
              const overall   = getRunOverallStatus(snap.lastRunMap);
              const endTime   = getEndTime(snap.lastRunMap);
              const isSelected = activeRunId === snap.runId;
              const isLatest   = idx === 0;

              return (
                <button
                  key={snap.runId}
                  onClick={() => { onSelectRun(snap); setOpen(false); }}
                  className={`w-full grid items-center px-4 py-2.5 text-left transition-colors group
                    ${isSelected ? 'bg-indigo-50/80' : 'hover:bg-slate-50/80'}`}
                  style={{ gridTemplateColumns: '1fr 80px 108px 108px' }}
                >
                  {/* Run ID + version */}
                  <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[11px] text-slate-700 truncate group-hover:text-slate-900">{snap.runId}</span>
                      {isSelected && <CheckIcon size={10} className="text-indigo-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-1.5 py-px rounded text-[9px] font-semibold font-mono border leading-tight
                        ${isLatest
                          ? 'bg-[#13c2c2]/10 text-[#0d9e9e] border-[#13c2c2]/25'
                          : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {snap.version}
                      </span>
                      {isLatest && (
                        <span className="text-[9px] text-[#13c2c2] font-semibold">Latest</span>
                      )}
                    </div>
                  </div>
                  {/* Status */}
                  <div><RunOverallStatusBadge status={overall} /></div>
                  {/* Start */}
                  <span className="text-[10px] text-slate-500 font-mono">{snap.createdAt}</span>
                  {/* End */}
                  <span className="text-[10px] text-slate-500 font-mono">{endTime}</span>
                </button>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60">
            <p className="text-[10px] text-slate-400 text-center">
              Click a run to view its pipeline execution — read-only
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Shared types ─────────────── */
type ResourceTier  = 'Low' | 'Medium' | 'High';
type QueuePriority = 'Normal' | 'Important' | 'Critical';
interface TaskConfigState { resourceTier: ResourceTier; queuePriority: QueuePriority; }

/** ONCE = manual trigger only; Cron = scheduler expression (WideTable-aligned). */
interface ScheduleConfig { mode: 'once' | 'cron'; cronExpr: string; time: string; timezone: string; }

function parseCronEnglish(expr: string): { valid: boolean; english: string } {
  const t = expr.trim();
  if (!t) return { valid: false, english: 'Enter a cron expression' };
  const parts = t.split(/\s+/);
  const core = parts.length === 6 ? parts.slice(1) : parts;
  if (core.length !== 5) return { valid: false, english: 'Use 5 fields (or 6 with seconds)' };
  const [min, hour, dom, month, dow] = core;
  const fieldOk = (s: string) => /^[\d*\-/,\?]+$/.test(s);
  if (![min, hour, dom, month, dow].every(fieldOk)) return { valid: false, english: 'Invalid characters in field' };
  if ((dom === '*' || dom === '?') && month === '*' && (dow === '*' || dow === '?') && /^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const h = parseInt(hour, 10); const m = parseInt(min, 10);
    const hh = h % 12 || 12;
    const ampm = h >= 12 ? 'pm' : 'am';
    return { valid: true, english: `Run at ${hh}:${String(m).padStart(2, '0')} ${ampm} every day` };
  }
  return { valid: true, english: 'Schedule active (English preview is simplified in prototype)' };
}
/* ─────────────── Exp Meta Edit Modal (topbar) ─────────────── */
function ExpMetaEditModal({ task, onUpdateTask, onClose }: {
  task: TrainingTask;
  onUpdateTask: (patch: Partial<Pick<TrainingTask, 'owner' | 'description'>>) => void;
  onClose: () => void;
}) {
  const initialOwners = task.owner.split(',').map(s => s.trim()).filter(Boolean);
  const [selectedOwners, setSelectedOwners] = useState<string[]>(initialOwners);
  const [description, setDescription]       = useState(task.description);
  const [ownerDropOpen, setOwnerDropOpen]   = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOwnerDropOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  const toggleOwner = (user: string) => {
    const next = selectedOwners.includes(user) ? selectedOwners.filter(u => u !== user) : [...selectedOwners, user];
    setSelectedOwners(next);
  };
  const handleSave = () => {
    onUpdateTask({ owner: selectedOwners.join(', '), description });
    onClose();
  };

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1';
  const readonlyCls = 'flex items-center gap-2 min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-600';

  const modal = ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[460px] max-w-[95vw] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Pencil size={13} className="text-slate-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Edit Experiment Meta</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Experiment &amp; Model are read-only</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Read-only: Experiment */}
          <div>
            <p className={labelCls}>Experiment</p>
            <div className={readonlyCls}>
              <GitBranch size={11} className="text-slate-400 shrink-0" />
              <span className="truncate flex-1">{task.taskName}</span>
              <span className="text-[10px] text-slate-300 italic shrink-0">read only</span>
            </div>
          </div>
          {/* Read-only: Model */}
          <div>
            <p className={labelCls}>Model</p>
            <div className={readonlyCls}>
              <span className="truncate flex-1">{task.modelName}</span>
              <span className="text-[10px] text-slate-300 italic shrink-0">read only</span>
            </div>
          </div>
          {/* Owner */}
          <div>
            <p className={labelCls}>Owner</p>
            <div className="relative" ref={dropRef}>
              <button onClick={() => setOwnerDropOpen(p => !p)} className="w-full min-h-8 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-slate-400 flex items-start gap-1.5 text-left transition-colors">
                <div className="flex-1 flex flex-wrap gap-1 min-w-0 py-0.5">
                  {selectedOwners.length === 0
                    ? <span className="text-xs text-slate-400">Select owners…</span>
                    : selectedOwners.map(u => <span key={u} className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">{u}</span>)}
                </div>
                <ChevronDown size={11} className={`mt-1 shrink-0 text-slate-400 transition-transform ${ownerDropOpen ? 'rotate-180' : ''}`} />
              </button>
              {ownerDropOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl z-20 py-1 max-h-44 overflow-y-auto">
                  {ALL_OWNERS.map(user => {
                    const sel = selectedOwners.includes(user);
                    return (
                      <button key={user} onClick={() => toggleOwner(user)} className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 transition-colors">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-slate-600 border-slate-600' : 'border-slate-300 bg-white'}`}>{sel && <CheckIcon size={9} className="text-white" strokeWidth={3} />}</div>
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-400 to-teal-400 flex items-center justify-center text-white text-[9px] font-medium shrink-0">{user[0].toUpperCase()}</div>
                        <span className="text-xs text-slate-700">{user}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Description */}
          <div>
            <p className={labelCls}>Description</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 resize-none focus:outline-none focus:border-slate-400 transition-colors leading-relaxed"
              placeholder="Describe this experiment…" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button onClick={onClose} className="h-8 px-4 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="h-8 px-5 rounded-lg bg-[#13c2c2] text-white text-xs hover:bg-[#10a3a3] transition-colors shadow-sm">Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
  return modal;
}

/* ─────────────── Execute Config modal (WideTable-aligned) ─────────────── */
function ExecuteConfigModal({
  onClose,
  execConfig,
  onSaveExec,
  scheduleConfig,
  onUpdateSchedule,
  readOnly,
}: {
  onClose: () => void;
  execConfig: TaskConfigState;
  onSaveExec: (patch: Partial<TaskConfigState>) => void;
  scheduleConfig: ScheduleConfig;
  onUpdateSchedule: (cfg: ScheduleConfig) => void;
  readOnly?: boolean;
}) {
  const [resourceTier, setResourceTier] = useState<ResourceTier>(execConfig.resourceTier);
  const [queuePriority, setQueuePriority] = useState<QueuePriority>(execConfig.queuePriority);
  const [schedMode, setSchedMode] = useState<'once' | 'cron'>(scheduleConfig.mode);
  const [cronExpr, setCronExpr] = useState(scheduleConfig.cronExpr);
  const cron = parseCronEnglish(cronExpr);

  useEffect(() => {
    setResourceTier(execConfig.resourceTier);
    setQueuePriority(execConfig.queuePriority);
    setSchedMode(scheduleConfig.mode);
    setCronExpr(scheduleConfig.cronExpr);
  }, [execConfig.resourceTier, execConfig.queuePriority, scheduleConfig.mode, scheduleConfig.cronExpr]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = () => {
    onSaveExec({ resourceTier, queuePriority });
    onUpdateSchedule({ ...scheduleConfig, mode: schedMode, cronExpr });
    onClose();
  };

  const tierColors: Record<ResourceTier, string> = { Low: 'text-slate-600', Medium: 'text-amber-600', High: 'text-rose-600' };
  const priorityColors: Record<QueuePriority, string> = { Normal: 'text-slate-600', Important: 'text-indigo-600', Critical: 'text-rose-600' };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Execute Config</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Resource · Queue Priority · Scheduler</p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Resource</p>
            <select
              value={resourceTier}
              disabled={readOnly}
              onChange={e => setResourceTier(e.target.value as ResourceTier)}
              className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-teal-400 font-medium ${tierColors[resourceTier]}`}
            >
              {(['Low', 'Medium', 'High'] as ResourceTier[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Queue Priority</p>
            <select
              value={queuePriority}
              disabled={readOnly}
              onChange={e => setQueuePriority(e.target.value as QueuePriority)}
              className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-teal-400 font-medium ${priorityColors[queuePriority]}`}
            >
              {(['Normal', 'Important', 'Critical'] as QueuePriority[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Scheduler</p>
            <select
              value={schedMode}
              disabled={readOnly}
              onChange={e => setSchedMode(e.target.value as 'once' | 'cron')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-teal-400"
            >
              <option value="once">ONCE</option>
              <option value="cron">Cron</option>
            </select>
            {schedMode === 'cron' && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-500">Cron expression</p>
                <input
                  type="text"
                  value={cronExpr}
                  disabled={readOnly}
                  onChange={e => setCronExpr(e.target.value)}
                  placeholder="0 6 * * *"
                  className={`w-full font-mono text-sm border rounded-xl px-3 py-2 bg-gray-50 focus:outline-none ${cron.valid ? 'border-gray-200 focus:border-teal-400' : 'border-red-300 focus:border-red-400'}`}
                />
                <p className="text-[10px] text-slate-500">{cron.english}</p>
              </div>
            )}
            {schedMode === 'once' && (
              <p className="text-[10px] text-slate-400 mt-2">Manual trigger only — no automatic schedule</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            disabled={readOnly}
            onClick={handleSave}
            className="h-9 px-5 rounded-lg bg-teal-500 text-white text-sm hover:bg-teal-600 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────── DataSource config panel ─────────────── */

// Mock column list simulating parsed schema from Hive table
const MOCK_HIVE_COLUMNS = [
  'user_id', 'account_id', 'event_time', 'account_age_days', 'credit_score', 'loan_amount', 'loan_term',
  'monthly_income', 'debt_ratio', 'num_late_payments', 'num_credit_lines',
  'employment_status', 'region_code', 'product_type', 'channel',
  'is_default_30d', 'sample_flag',
];

function FieldTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <HelpCircle size={12} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 bg-slate-800 text-white text-[10px] leading-relaxed px-2.5 py-1.5 rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal text-center">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

// Reusable styled select for column picking
function ColSelect({ value, onChange, options, disabled, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || options.length === 0}
        className={`w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-mono
          appearance-none cursor-pointer transition-colors
          focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
          disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
          ${value ? 'text-slate-700' : 'text-slate-400'}`}
      >
        {options.length === 0 ? (
          <option value="">{'— fill schema to load columns —'}</option>
        ) : (
          <>
            <option value="" disabled hidden>{'— select column —'}</option>
            {options.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </>
        )}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

// Multi-select dropdown for column picking (click-driven tag UI)
function MultiColSelect({ values, onChange, options, disabled }: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (col: string) => {
    if (disabled) return;
    onChange(values.includes(col) ? values.filter(v => v !== col) : [...values, col]);
  };

  const noOptions = options.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || noOptions}
        onClick={() => !disabled && !noOptions && setOpen(p => !p)}
        className={`w-full min-h-[32px] px-2.5 py-1 rounded-lg border text-left transition-colors flex flex-wrap gap-1 items-center
          ${open ? 'border-[#13c2c2]/60 ring-1 ring-[#13c2c2]/20' : 'border-slate-200'}
          ${disabled || noOptions ? 'bg-slate-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-slate-300'}`}
      >
        {values.length === 0 ? (
          <span className="text-xs text-slate-400 font-mono">
            {noOptions ? '— fill schema to load columns —' : '— select columns —'}
          </span>
        ) : (
          values.map(v => (
            <span key={v} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#13c2c2]/10 text-[#0d9e9e] text-[10px] font-mono font-semibold">
              {v}
              {!disabled && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggle(v); }}
                  className="ml-0.5 text-[#0d9e9e]/60 hover:text-[#0d9e9e] leading-none"
                >×</button>
              )}
            </span>
          ))
        )}
        <ChevronDown size={10} className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !noOptions && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-44 overflow-y-auto">
          {options.map(col => {
            const selected = values.includes(col);
            return (
              <button
                key={col}
                type="button"
                onClick={() => toggle(col)}
                className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs font-mono transition-colors
                  ${selected ? 'bg-[#13c2c2]/8 text-[#0d9e9e]' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
                  ${selected ? 'bg-[#13c2c2] border-[#13c2c2]' : 'border-slate-300'}`}>
                  {selected && <CheckIcon size={9} strokeWidth={3} className="text-white" />}
                </span>
                {col}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SPLIT_RATIOS: { label: string; value: string; train: number; test: number }[] = [
  { label: '70 / 30', value: '0.7_0.3', train: 0.7, test: 0.3 },
  { label: '75 / 25', value: '0.75_0.25', train: 0.75, test: 0.25 },
  { label: '80 / 20', value: '0.8_0.2', train: 0.8, test: 0.2 },
];

function SampleUseColSection({
  mode, onModeChange,
  colValue, onColChange, colOptions, colsDisabled,
  ratio, onRatioChange,
  readOnly,
}: {
  mode: 'use_existing' | 'auto_generate';
  onModeChange: (m: 'use_existing' | 'auto_generate') => void;
  colValue: string;
  onColChange: (v: string) => void;
  colOptions: string[];
  colsDisabled?: boolean;
  ratio: string;
  onRatioChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';

  return (
    <div className="flex flex-col gap-2.5">
      <p className={labelCls}>
        sample_use_col
        <FieldTooltip text="Controls which rows each step uses. WOE fit & Model Train only load rows where this column = 'train'; the platform injects this config into all downstream steps automatically." />
      </p>

      {/* Mode toggle — compact segmented control */}
      <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        {(['use_existing', 'auto_generate'] as const).map(m => (
          <button
            key={m}
            disabled={readOnly}
            onClick={() => !readOnly && onModeChange(m)}
            className={`flex-1 py-0.5 rounded-[5px] transition-all text-[10px] tracking-wide
              ${mode === m
                ? 'bg-white text-[#0d9e9e] shadow-sm border border-slate-200/80'
                : 'text-slate-400 hover:text-slate-500'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {m === 'use_existing' ? 'Use Existing' : 'Auto Generate'}
          </button>
        ))}
      </div>

      {mode === 'use_existing' ? (
        <div>
          <ColSelect
            value={colValue}
            onChange={onColChange}
            options={colOptions}
            disabled={readOnly || colsDisabled}
            placeholder={colsDisabled ? '— fill schema to load columns —' : '— select column —'}
          />
          {colValue && !colsDisabled && (
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              Downstream steps filter on <span className="font-mono text-slate-500">{colValue} = 'train'</span>
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 flex flex-col gap-2">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            A <span className="font-mono text-slate-500">sample_use_col</span> column is randomly generated at runtime and injected into all downstream steps.
          </p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Train / Test Split</p>
          <div className="flex gap-1.5">
            {SPLIT_RATIOS.map(r => (
              <button
                key={r.value}
                disabled={readOnly}
                onClick={() => !readOnly && onRatioChange(r.value)}
                className={`flex-1 rounded-md border py-1.5 px-1 flex flex-col items-center gap-1 transition-all
                  ${ratio === r.value
                    ? 'border-[#13c2c2]/60 bg-[#13c2c2]/6'
                    : 'border-slate-200 bg-white hover:border-slate-300'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className={`text-[11px] font-semibold tabular-nums ${ratio === r.value ? 'text-[#0d9e9e]' : 'text-slate-500'}`}>
                  {r.label}
                </span>
                <div className="w-full flex gap-px h-1 rounded-full overflow-hidden">
                  <div
                    className={`rounded-l-full transition-all ${ratio === r.value ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
                    style={{ width: `${r.train * 100}%` }}
                  />
                  <div
                    className={`rounded-r-full transition-all ${ratio === r.value ? 'bg-[#13c2c2]/25' : 'bg-slate-100'}`}
                    style={{ width: `${r.test * 100}%` }}
                  />
                </div>
                <div className="flex gap-1.5">
                  <span className={`text-[9px] ${ratio === r.value ? 'text-[#0d9e9e]/70' : 'text-slate-400'}`}>T {Math.round(r.train * 100)}%</span>
                  <span className={`text-[9px] ${ratio === r.value ? 'text-[#0d9e9e]/40' : 'text-slate-300'}`}>V {Math.round(r.test * 100)}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── WOE Process Config Panel ─────────────── */
const WOE_ADVANCED_CONFIG = `woe_config:
  mode: fit_transform_merge
  label_col: is_default_30d
  sample_use_col: sample_flag
  handle_missing: separate_bin
  handle_special: separate_bin
  monotone_constraint: true
  iv_filter: 0.02
  output:
    woe_encoded: true
    iv_table: true
    bin_table: true`;

function WoeProcessConfigPanel({ readOnly }: { readOnly?: boolean }) {
  const [woeBins, setWoeBins] = useState<5 | 10 | 15>(10);
  const [minBinSize, setMinBinSize] = useState(50);
  const [minMissingBadCnt, setMinMissingBadCnt] = useState(30);
  const [method, setMethod] = useState<'best_ks' | 'quantile'>('best_ks');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  return (
    <div className="px-4 py-3 flex flex-col">
      {/* Guide */}
      <div className="flex items-center gap-1.5 text-[10px] text-blue-500 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
        <Settings size={11} className="shrink-0" />
        <span className="font-mono tracking-wide">WOE Fit_Transform_Merge</span>
      </div>

      {/* ── Section: Data Inputs ── */}
      <div className="mt-4">
        <div>
          <p className={labelCls}>
            Load Raw Data
            <FieldTooltip text="Upstream data source node output. Automatically resolved from the DAG dependency on DataSource." />
          </p>
          <div className="h-8 px-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-1.5 overflow-hidden">
            <Database size={10} className="shrink-0 text-slate-300" />
            <span className="text-[10px] text-slate-400 font-mono truncate">DataSource · Feature Store · hdfs://data/feat/v12</span>
          </div>
        </div>
      </div>

      {/* Section divider — data inputs / woe config */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">WOE Config</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Section: WOE Config ── */}
      <div className="flex flex-col gap-3.5">
        {/* WOE Bins */}
        <div>
          <p className={labelCls}>WOE Bins</p>
          <div className="flex gap-1.5">
            {([5, 10, 15] as const).map(b => (
              <button
                key={b}
                disabled={readOnly}
                onClick={() => !readOnly && setWoeBins(b)}
                className={`flex-1 h-7 rounded-md border text-xs font-semibold transition-all
                  ${woeBins === b
                    ? 'border-[#13c2c2]/60 bg-[#13c2c2]/8 text-[#0d9e9e]'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* min_bin_size & min_missing_bad_cnt */}
        <div className="flex gap-2">
          <div className="flex-1">
            <p className={labelCls}>
              min_bin_size
              <FieldTooltip text="Min samples per bin. No bin may contain fewer samples than this value." />
            </p>
            <input
              type="number"
              min={1}
              value={minBinSize}
              disabled={readOnly}
              onChange={e => setMinBinSize(Number(e.target.value))}
              className={numInputCls}
            />
          </div>
          <div className="flex-1">
            <p className={labelCls}>
              min_missing_bad_cnt
              <FieldTooltip text="Min bad-sample count in the missing bin. If below this value, the missing bin is merged into an adjacent bin." />
            </p>
            <input
              type="number"
              min={0}
              value={minMissingBadCnt}
              disabled={readOnly}
              onChange={e => setMinMissingBadCnt(Number(e.target.value))}
              className={numInputCls}
            />
          </div>
        </div>

        {/* method */}
        <div>
          <p className={labelCls}>
            method
            <FieldTooltip text="Binning method. best_ks uses the optimal KS cut-point; quantile uses equal-frequency binning." />
          </p>
          <div className="relative">
            <select
              value={method}
              disabled={readOnly}
              onChange={e => setMethod(e.target.value as 'best_ks' | 'quantile')}
              className={`w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-mono
                appearance-none cursor-pointer transition-colors text-slate-700
                focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
                disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
            >
              <option value="best_ks">best_ks</option>
              <option value="quantile">quantile</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Advanced Config toggle */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setAdvancedOpen(v => !v)}
            className={`w-full flex items-center justify-between px-3 py-2 transition-colors
              ${advancedOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}
              disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <SlidersHorizontal size={11} />
              Advanced Config
            </span>
            <div className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${advancedOpen ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${advancedOpen ? 'translate-x-3' : 'translate-x-0'}`} />
            </div>
          </button>
          {advancedOpen && (
            <div className="border-t border-slate-200 bg-slate-950 px-3 py-2.5 overflow-x-auto">
              <pre className="text-[10px] text-emerald-300 font-mono leading-relaxed whitespace-pre">{WOE_ADVANCED_CONFIG}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Section divider — output paths */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Output Paths</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Section: Output Paths ── */}
      <div className="flex flex-col gap-2 pb-3">
        {[
          { label: 'encoder_save_filepath',  path: 's3://mlops-artifacts/woe/encoder/v12/encoder.pkl' },
          { label: 'merged_save_filepath',   path: 's3://mlops-artifacts/woe/merge/v12/woe_merge_result.parquet' },
          { label: 'feature_report_path',    path: 's3://mlops-artifacts/woe/report/v12/feature_report.xlsx' },
        ].map(({ label, path }) => (
          <CopyPathField key={label} label={label} path={path} labelCls={labelCls} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────── WOE Update Config Panel ─────────────── */
const WOE_UPDATE_WS_LIST_DEFAULT = JSON.stringify({
  feature_name: "mock_feature_income",
  data_path: "s3://bucket/woe/data/features/training_features_mock_feature_income",
  encoder_path: "s3://bucket/woe/encoder/mock_feature_income_5bin.pkl",
  ws_list: "-inf,0.2,0.5,0.8,inf",
  output_path: "s3://bucket/woe/encoder/mock_feature_income_5bin_updated.pkl",
  sample_use_col: "sample_type",
  missing_logic: "high_risk"
}, null, 2);

const WOE_UPDATE_SET_WOE_DEFAULT = JSON.stringify({
  encoder_path: "s3://bucket/woe/encoder/mock_feature_income_5bin.pkl",
  feature_name: "mock_feature_income",
  bin_name: "(0.2, 0.5]",
  woe_value: -0.15,
  output_path: "s3://bucket/woe/encoder/mock_feature_income_5bin_manual.pkl"
}, null, 2);

function JsonToggleBlock({
  label,
  tooltip,
  defaultJson,
  readOnly,
  labelCls,
}: {
  label: string;
  tooltip: string;
  defaultJson: string;
  readOnly?: boolean;
  labelCls: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [value, setValue] = useState(defaultJson);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => { if (enabled) setTimeout(autoResize, 0); }, [enabled, value]);

  const handleReset = () => setValue(defaultJson);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header row with toggle */}
      <div className="flex items-center justify-between">
        <p className={labelCls}>
          {label}
          <FieldTooltip text={tooltip} />
        </p>
        <button
          disabled={readOnly}
          onClick={() => !readOnly && setEnabled(v => !v)}
          className="flex items-center gap-1 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          title={enabled ? 'Disable' : 'Enable'}
        >
          <div className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${enabled ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}>
            <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-3' : 'translate-x-0'}`} />
          </div>
        </button>
      </div>

      {/* Code editor block */}
      {enabled && (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-slate-800 border-b border-slate-700">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">JSON Config</span>
            {!readOnly && (
              <button
                onClick={handleReset}
                title="Reset to default"
                className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-[#13c2c2] transition-colors px-1 py-0.5 rounded hover:bg-slate-700"
              >
                <RotateCcw size={9} />
                <span className="font-semibold">Reset</span>
              </button>
            )}
          </div>
          {/* Editor area */}
          <div className="flex bg-[#1e1e2e]">
            {/* Line numbers */}
            <div className="select-none shrink-0 pt-2.5 pb-2.5 pl-2 pr-1.5 flex flex-col text-right">
              {value.split('\n').map((_, i) => (
                <span key={i} className="text-[9px] font-mono leading-[1.6] text-slate-600">{i + 1}</span>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              readOnly={readOnly}
              onChange={e => { setValue(e.target.value); autoResize(); }}
              spellCheck={false}
              rows={value.split('\n').length}
              className={`flex-1 resize-none outline-none bg-transparent text-[10px] font-mono leading-[1.6]
                pt-2.5 pb-2.5 pr-3 min-w-0 w-full text-[#cdd6f4] caret-[#13c2c2]
                ${readOnly ? 'cursor-default' : 'cursor-text'}
                focus:outline-none`}
              style={{ overflowY: 'hidden', overflowX: 'auto' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function WoeUpdateConfigPanel({ readOnly }: { readOnly?: boolean }) {
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const DEFAULT_ENCODER_PATH = 's3://mlops-artifacts/woe/encoder/v12/encoder.pkl';
  const [encoderPath, setEncoderPath] = useState(DEFAULT_ENCODER_PATH);

  return (
    <div className="px-4 py-3 flex flex-col">
      {/* Guide */}
      <div className="flex items-center gap-1.5 text-[10px] text-blue-500 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
        <Settings size={11} className="shrink-0" />
        <span className="font-mono tracking-wide">WOE Update_Fit_Transform</span>
      </div>

      {/* ── Section: Data Inputs ── */}
      <div className="flex flex-col gap-3 mt-4">
        {/* Load Raw Data — view only, upstream DataSource */}
        <div>
          <p className={labelCls}>
            Load Raw Data
            <FieldTooltip text="Upstream data source node output. Automatically resolved from the DAG dependency on DataSource." />
          </p>
          <div className="h-8 px-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-1.5 overflow-hidden">
            <Database size={10} className="shrink-0 text-slate-300" />
            <span className="text-[10px] text-slate-400 font-mono truncate">DataSource · Feature Store · hdfs://data/feat/v12</span>
          </div>
        </div>

        {/* Load Encoder Result — editable, default from WOE Process output */}
        <div>
          <p className={labelCls}>
            Load Encoder Result
            <FieldTooltip text="Encoder artifact path from an upstream WOE Process node. Defaults to WOE Process encoder_save_filepath output; you can override this with any valid encoder path." />
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={encoderPath}
              onChange={e => !readOnly && setEncoderPath(e.target.value)}
              readOnly={readOnly}
              placeholder="e.g. s3://bucket/woe/encoder.pkl"
              className={`flex-1 h-8 px-2.5 rounded-lg border text-[10px] font-mono
                ${readOnly
                  ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  : 'border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20'}`}
            />
            {!readOnly && encoderPath !== DEFAULT_ENCODER_PATH && (
              <button
                onClick={() => setEncoderPath(DEFAULT_ENCODER_PATH)}
                title="Reset to WOE Process default"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-[#13c2c2]/50 hover:text-[#13c2c2] hover:bg-[#13c2c2]/5 transition-all"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-300 font-mono leading-relaxed pl-0.5">
            from WOE Process · encoder_save_filepath
          </p>
        </div>
      </div>

      {/* Section divider — data inputs / update config */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Update Config</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Section: Update Config ── */}
      <div className="flex flex-col gap-3.5">
        {/* update_ws_list */}
        <JsonToggleBlock
          label="update_ws_list"
          tooltip="Override the bin split points (ws_list) for a specific feature and refit the encoder on the new boundaries."
          defaultJson={WOE_UPDATE_WS_LIST_DEFAULT}
          readOnly={readOnly}
          labelCls={labelCls}
        />

        {/* set_woe_value */}
        <JsonToggleBlock
          label="set_woe_value"
          tooltip="Manually override the WOE value for a specific bin of a feature encoder without re-fitting."
          defaultJson={WOE_UPDATE_SET_WOE_DEFAULT}
          readOnly={readOnly}
          labelCls={labelCls}
        />
      </div>

      {/* Section divider — output paths */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Output Paths</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Section: Output Paths ── */}
      <div className="flex flex-col gap-2 pb-3">
        {[
          { label: 'update_encoder_save_filepath', path: 's3://mlops-artifacts/woe/encoder/v12/encoder_updated.pkl' },
          { label: 'update_merged_save_filepath',  path: 's3://mlops-artifacts/woe/merge/v12/woe_update_result.parquet' },
        ].map(({ label, path }) => (
          <CopyPathField key={label} label={label} path={path} labelCls={labelCls} />
        ))}
      </div>
    </div>
  );
}

function CopyPathField({ label, path, labelCls }: { label: string; path: string; labelCls: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = path;
      textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(path).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }).catch(() => {});
      }
    }
  };
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className="flex items-center gap-1.5">
        <div
          className="flex-1 h-8 px-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center overflow-hidden"
          title={path}
        >
          <span className="text-[10px] text-slate-400 font-mono truncate whitespace-nowrap">{path}</span>
        </div>
        <button
          onClick={handleCopy}
          title="Copy path"
          className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition-all
            ${copied
              ? 'border-emerald-200 bg-emerald-50 text-emerald-500'
              : 'border-slate-200 bg-white text-slate-400 hover:border-[#13c2c2]/50 hover:text-[#13c2c2] hover:bg-[#13c2c2]/5'}`}
        >
          {copied
            ? <CheckIcon size={12} strokeWidth={2.5} />
            : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Feature Selection Config Panel ─────────────── */
const UPSTREAM_OUTPUTS = [
  { nodeLabel: 'WOE Process',  path: 's3://mlops-artifacts/woe/merge/v12/woe_merge_result.parquet' },
  { nodeLabel: 'WOE Update',   path: 's3://mlops-artifacts/woe/merge/v12/woe_update_result.parquet' },
];

const SELECT_METHODS = ['by_iv', 'by_corr', 'by_psi', 'by_gini', 'by_stability'] as const;
type SelectMethod = typeof SELECT_METHODS[number];

const STABILITY_PARAMS_JSON = `stability:
  lambda_grid: [0.001, 0.01, 0.1]
  stability_threshold: 0.05
  n_resampling: 50
  random_state: 42
  bootstrap: true`;

/* ─────────────── Stability Params Editor ─────────────── */
function StabilityParamsEditor({ readOnly }: { readOnly?: boolean }) {
  const [value, setValue] = useState(STABILITY_PARAMS_JSON);
  const [parseError, setParseError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => { autoResize(); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    // Lightweight structural check: flag if indentation/keys look broken
    const hasKeys = ['lambda_grid', 'stability_threshold', 'n_resampling'].every(k => v.includes(k));
    setParseError(!hasKeys);
  };

  const handleReset = () => {
    setValue(STABILITY_PARAMS_JSON);
    setParseError(false);
  };

  return (
    <div className={`rounded-lg border overflow-hidden transition-colors ${parseError ? 'border-rose-300' : 'border-amber-200'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-2.5 py-1.5 border-b ${parseError ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50/60'}`}>
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={10} className={parseError ? 'text-rose-400 shrink-0' : 'text-amber-500 shrink-0'} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${parseError ? 'text-rose-600' : 'text-amber-700'}`}>
            Stability Params
          </span>
          {parseError && (
            <span className="text-[9px] font-semibold text-rose-500 bg-rose-100 border border-rose-200 rounded px-1 py-px">
              invalid
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={handleReset}
            title="Reset to defaults"
            className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-[#13c2c2] transition-colors px-1.5 py-0.5 rounded hover:bg-white/70"
          >
            <RotateCcw size={9} />
            <span className="font-semibold">Reset</span>
          </button>
        )}
      </div>

      {/* Editable code area */}
      <div className={`relative ${parseError ? 'bg-rose-50/40' : 'bg-[#1e1e2e]'}`}>
        {/* Line numbers */}
        <div className="flex">
          <div className="select-none shrink-0 pt-2.5 pb-2.5 pl-2 pr-1.5 flex flex-col gap-0 text-right"
            style={{ minWidth: 28 }}>
            {value.split('\n').map((_, i) => (
              <span key={i} className="text-[9px] font-mono leading-[1.6] text-slate-500/50">{i + 1}</span>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            readOnly={readOnly}
            onChange={handleChange}
            onInput={autoResize}
            spellCheck={false}
            rows={value.split('\n').length}
            className={`flex-1 resize-none outline-none bg-transparent text-[10px] font-mono leading-[1.6]
              pt-2.5 pb-2.5 pr-3 min-w-0 w-full
              ${parseError
                ? 'text-rose-700 caret-rose-400'
                : 'text-[#cdd6f4] caret-[#13c2c2]'}
              ${readOnly ? 'cursor-default' : 'cursor-text'}
              focus:outline-none`}
            style={{ overflowY: 'hidden', overflowX: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}

function FeatureSelectionConfigPanel({ readOnly }: { readOnly?: boolean }) {
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const [mergeResultPath, setMergeResultPath] = useState(UPSTREAM_OUTPUTS[0].path);

  const [methods, setMethods] = useState<SelectMethod[]>(['by_iv', 'by_corr']);
  const [methodOpen, setMethodOpen] = useState(false);
  const methodRef = useRef<HTMLDivElement>(null);
  const hasStability = methods.includes('by_stability');

  const [ivThreshold, setIvThreshold]     = useState(0.02);
  const [corrThreshold, setCorrThreshold] = useState(0.7);
  const [psiThreshold, setPsiThreshold]   = useState(0.1);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (methodRef.current && !methodRef.current.contains(e.target as Node)) {
        setMethodOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleMethod = (m: SelectMethod) => {
    if (readOnly) return;
    setMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  return (
    <div className="px-4 py-3 flex flex-col">
      {/* Guide */}
      <div className="flex items-center gap-1.5 text-[10px] text-blue-500 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
        <Filter size={11} className="shrink-0" />
        <span className="font-mono tracking-wide">Feature Selection</span>
      </div>

      {/* ── Section: Data Inputs ── */}
      <div className="mt-4">
        {/* 1. Load WOE Merge Result */}
        <div>
          <p className={labelCls}>
            Load WOE Merge Result
            <FieldTooltip text="woe_merge_result_path — Auto-resolved from the upstream WOE Process node. You can override the path by editing directly." />
          </p>
          {/* auto-resolved badge */}
          <div className="flex items-center gap-1 mb-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#13c2c2]/8 text-[#0d9e9e] border border-[#13c2c2]/20">
              <Database size={8} className="shrink-0" />
              Auto-resolved · WOE Process
            </span>
          </div>
          <input
            type="text"
            disabled={readOnly}
            value={mergeResultPath}
            onChange={e => setMergeResultPath(e.target.value)}
            className={`${numInputCls} text-[10px]`}
          />
        </div>
      </div>{/* end Data Inputs */}

      {/* Section divider — data inputs / selection config */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Selection Config</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Section: Selection Config ── */}
      <div className="flex flex-col gap-3.5">
      {/* 2. Select Method multi-select */}
      <div ref={methodRef}>
        <p className={labelCls}>Select Method</p>
        <div className="relative">
          <button
            disabled={readOnly}
            onClick={() => !readOnly && setMethodOpen(v => !v)}
            className={`w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between
              text-xs transition-colors
              focus:outline-none focus:border-[#13c2c2]/60
              disabled:bg-slate-50 disabled:cursor-not-allowed
              ${methodOpen ? 'border-[#13c2c2]/60 ring-1 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
          >
            <span className="truncate text-left font-mono text-[10px] text-slate-700">
              {methods.length === 0
                ? <span className="text-slate-400">— select methods —</span>
                : methods.join(', ')}
            </span>
            <ChevronDown size={11} className={`shrink-0 text-slate-400 ml-1 transition-transform ${methodOpen ? 'rotate-180' : ''}`} />
          </button>
          {methodOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {SELECT_METHODS.map(m => {
                const checked = methods.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMethod(m)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all
                      ${checked ? 'bg-[#13c2c2] border-[#13c2c2]' : 'border-slate-300 bg-white'}`}>
                      {checked && <CheckIcon size={9} strokeWidth={3} className="text-white" />}
                    </div>
                    <span className="text-[11px] font-mono text-slate-700">{m}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2.1 Stability params */}
      {hasStability && (
        <StabilityParamsEditor readOnly={readOnly} />
      )}

      {/* 3. IV Threshold */}
      <div>
        <p className={labelCls}>
          IV Threshold
          <FieldTooltip text="Information Value filter threshold. Features below this value will be dropped. Default: 0.02." />
        </p>
        <input
          type="number" step={0.001} min={0} max={1}
          value={ivThreshold}
          disabled={readOnly}
          onChange={e => setIvThreshold(Number(e.target.value))}
          className={numInputCls}
        />
      </div>

      {/* 4. Correlation Threshold */}
      <div>
        <p className={labelCls}>
          Correlation Threshold
          <FieldTooltip text="Pearson correlation threshold. For highly correlated feature pairs, the one with lower IV will be dropped. Default: 0.7." />
        </p>
        <input
          type="number" step={0.01} min={0} max={1}
          value={corrThreshold}
          disabled={readOnly}
          onChange={e => setCorrThreshold(Number(e.target.value))}
          className={numInputCls}
        />
      </div>

      {/* 5. PSI Threshold */}
      <div>
        <p className={labelCls}>
          PSI Threshold
          <FieldTooltip text="Population Stability Index threshold. Unstable features above this value will be dropped (effective only when by_psi is selected). Default: 0.1." />
        </p>
        <input
          type="number" step={0.01} min={0} max={1}
          value={psiThreshold}
          disabled={readOnly}
          onChange={e => setPsiThreshold(Number(e.target.value))}
          className={numInputCls}
        />
      </div>
      </div>{/* end Selection Config */}

      {/* Section divider — output paths */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Output Paths</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Section: Output Paths ── */}
      <div className="pb-3">
        <CopyPathField
          label="feature_selection_report_path"
          path="s3://mlops-artifacts/feature-selection/v12/feature_selection_report.xlsx"
          labelCls={labelCls}
        />
      </div>
    </div>
  );
}

/* ─────────────── Model Tune + Train Config Panel ─────────────── */
const INIT_HYPERS_JSON = `{
    "objective": "binary",
    "metric": ["binary_logloss", "auc"],
    "learning_rate": tune.loguniform(0.01, 0.03),
    "max_depth": tune.quniform(3, 6, 1),
    "num_leaves": tune.quniform(20, 100, 1),
    "feature_fraction": tune.uniform(0.4, 0.8),
    "bagging_fraction": tune.uniform(0.4, 0.8),
    "bagging_freq": tune.quniform(3, 6, 1),
    "reg_alpha": tune.loguniform(0.1, 100),
    "reg_lambda": tune.loguniform(0.1, 100),
    "min_gain_to_split": tune.uniform(0, 0.2),
    "scale_pos_weight": tune.uniform(50, 150),
    "min_child_samples": tune.quniform(600, 1000, 1),
    "early_stopping_round": tune.quniform(80, 120, 1),
}`;


function ExpandableCodeBlock({
  label, value, onChange, readOnly, labelCls, tooltip,
}: {
  label: string; value: string; onChange: (v: string) => void;
  readOnly?: boolean; labelCls: string; tooltip?: string;
}) {
  const [modal, setModal] = useState(false);
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className={labelCls}>
            {label}
            {tooltip && <FieldTooltip text={tooltip} />}
          </p>
          <button
            onClick={() => setModal(true)}
            title="Expand"
            className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-400 hover:text-[#0d9e9e] hover:bg-[#13c2c2]/8 border border-transparent hover:border-[#13c2c2]/20 transition-all"
          >
            <Maximize2 size={9} /><span>Expand</span>
          </button>
        </div>
        <div className="relative rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          <textarea
            disabled={readOnly}
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full px-3 py-2.5 text-[10px] font-mono leading-relaxed text-slate-600 bg-transparent resize-none focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
      </div>
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(false)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <span className="text-xs font-semibold text-slate-700 font-mono">{label}</span>
              <button onClick={() => setModal(false)} className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 p-4">
              <textarea
                disabled={readOnly}
                value={value}
                onChange={e => onChange(e.target.value)}
                spellCheck={false}
                className="w-full h-full min-h-[320px] text-[11px] font-mono leading-relaxed text-slate-600 bg-transparent resize-none focus:outline-none disabled:cursor-not-allowed"
              />
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 shrink-0 flex justify-end">
              <button onClick={() => setModal(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#13c2c2] text-white hover:bg-[#0d9e9e] transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModelTuneConfigPanel({ readOnly }: { readOnly?: boolean }) {
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;
  const selectCls = `w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-[11px] font-mono
    appearance-none cursor-pointer transition-colors text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;
  const textareaCls = `w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-mono text-slate-700 resize-none
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300`;

  const [woeMergedPath, setWoeMergedPath] = useState('s3://mlops-artifacts/woe/merge/v12/woe_update_merged_result.parquet');
  const [featSelPath, setFeatSelPath] = useState('s3://mlops-artifacts/feature-selection/v12/feature_selection_report.xlsx');

  const [initHypers, setInitHypers] = useState(INIT_HYPERS_JSON);
  const [nTrials, setNTrials] = useState(10);
  const [searchAlgo, setSearchAlgo] = useState<'bayes' | 'grid' | 'random'>('bayes');
  const [tuneMetrics, setTuneMetrics] = useState<'auc' | 'ks'>('auc');
  const [kvDiffThreshold, setKvDiffThreshold] = useState(0.005);
  const [coefOverfit, setCoefOverfit] = useState(10);

  const [excludeCols, setExcludeCols] = useState('');
  const [auxiliaryCols, setAuxiliaryCols] = useState('');

  return (
    <div className="px-4 py-3 flex flex-col">
      {/* Guide banner */}
      <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
        <Settings size={11} className="shrink-0" />
        <span className="font-mono tracking-wide">Model Tune &amp; Train</span>
      </div>

      {/* ── Section: Data Inputs ── */}
      <div className="mt-4 flex flex-col gap-3.5">
        {/* 1. woe_merged_result_path */}
        <div>
          <p className={labelCls}>
            woe_merged_result_path
            <FieldTooltip text="Auto-resolved from WOE Update output (update_merged_save_filepath). Override by editing directly." />
          </p>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#13c2c2]/8 text-[#0d9e9e] border border-[#13c2c2]/20">
              <Database size={8} className="shrink-0" />Auto-resolved · WOE Update
            </span>
          </div>
          <input type="text" disabled={readOnly} value={woeMergedPath}
            onChange={e => setWoeMergedPath(e.target.value)}
            className={`${numInputCls} text-[10px]`} />
        </div>

        {/* 2. feature_selection_path */}
        <div>
          <p className={labelCls}>
            feature_selection_path
            <FieldTooltip text="Auto-resolved from Feature Selection output (feature_selection_report_path). Override by editing directly." />
          </p>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-500 border border-blue-200">
              <Filter size={8} className="shrink-0" />Auto-resolved · Feature Selection
            </span>
          </div>
          <input type="text" disabled={readOnly} value={featSelPath}
            onChange={e => setFeatSelPath(e.target.value)}
            className={`${numInputCls} text-[10px]`} />
        </div>
      </div>

      {/* ── Divider: Model Tune Config ── */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Model Tune Config</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Tune Config fields ── */}
      <div className="flex flex-col gap-3.5">
        {/* 3. init_hypers */}
        <ExpandableCodeBlock
          label="init_hypers"
          value={initHypers}
          onChange={setInitHypers}
          readOnly={readOnly}
          labelCls={labelCls}
          tooltip="Defines the hyperparameter search space passed to Ray Tune. Supports tune.loguniform / tune.uniform / tune.quniform samplers."
        />

        {/* 4. n_trials */}
        <div>
          <p className={labelCls}>n_trials <FieldTooltip text="Total number of hyperparameter combinations to sample and evaluate. Default: 10." /></p>
          <input type="number" min={1} step={1} value={nTrials} disabled={readOnly}
            onChange={e => setNTrials(Number(e.target.value))} className={numInputCls} />
        </div>

        {/* 5. search_algo */}
        <div>
          <p className={labelCls}>search_algo <FieldTooltip text="Hyperparameter search algorithm: bayes = BayesianOptimization (default), grid = GridSearch, random = RandomSearch." /></p>
          <div className="relative">
            <select disabled={readOnly} value={searchAlgo}
              onChange={e => setSearchAlgo(e.target.value as 'bayes' | 'grid' | 'random')} className={selectCls}>
              <option value="bayes">bayes</option>
              <option value="grid">grid</option>
              <option value="random">random</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 6. tune_metrics */}
        <div>
          <p className={labelCls}>tune_metrics <FieldTooltip text="Primary metric used to rank and select the best trial. auc = Area Under ROC Curve (default), ks = KS statistic." /></p>
          <div className="relative">
            <select disabled={readOnly} value={tuneMetrics}
              onChange={e => setTuneMetrics(e.target.value as 'auc' | 'ks')} className={selectCls}>
              <option value="auc">auc</option>
              <option value="ks">ks</option>
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 7. train_val_ks_diff_threshold */}
        <div>
          <p className={labelCls}>train_val_ks_diff_threshold <FieldTooltip text="Max allowed KS gap between train and validation sets. Trials exceeding this are penalized for overfitting. Default: 0.005." /></p>
          <input type="number" min={0} step={0.001} value={kvDiffThreshold} disabled={readOnly}
            onChange={e => setKvDiffThreshold(Number(e.target.value))} className={numInputCls} />
        </div>

        {/* 8. coef_overfit_punishment */}
        <div>
          <p className={labelCls}>coef_overfit_punishment <FieldTooltip text="Coefficient applied to the KS overfit penalty. Higher values more aggressively penalize overfitting. Default: 10." /></p>
          <input type="number" min={0} step={1} value={coefOverfit} disabled={readOnly}
            onChange={e => setCoefOverfit(Number(e.target.value))} className={numInputCls} />
        </div>

        {/* 9. tune_exclude_cols */}
        <div>
          <p className={labelCls}>tune_exclude_cols <FieldTooltip text="Comma-separated feature columns to exclude from tuning. Leave empty to include all features from the selection report." /></p>
          <textarea disabled={readOnly} rows={2} value={excludeCols}
            onChange={e => setExcludeCols(e.target.value)}
            placeholder="e.g. feature_a, feature_b  (leave empty to skip)"
            className={textareaCls} />
        </div>

        {/* 10. auxilary_cols */}
        <div>
          <p className={labelCls}>auxilary_cols <FieldTooltip text="Columns stripped from both features and training data entirely — not fed to the model. Comma-separated, e.g. sample_use." /></p>
          <textarea disabled={readOnly} rows={2} value={auxiliaryCols}
            onChange={e => setAuxiliaryCols(e.target.value)}
            placeholder="e.g. sample_use, row_id  (leave empty to skip)"
            className={textareaCls} />
        </div>
      </div>

      {/* ── Divider: Output Paths ── */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Output Paths</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── Output Paths ── */}
      <div className="pb-3 flex flex-col gap-3.5">
        <CopyPathField label="tune_artifacts_path"
          path="s3://mlops-artifacts/model-tune/v12/artifacts/" labelCls={labelCls} />
        <CopyPathField label="train_best_model_path"
          path="s3://mlops-artifacts/model-train/v12/best_model.pkl" labelCls={labelCls} />
        <CopyPathField label="train_predict_result_path"
          path="s3://mlops-artifacts/model-train/v12/predict_result.parquet" labelCls={labelCls} />
      </div>
    </div>
  );
}

/* ─────────────── Model Inference Config Panel ─────────────── */
function ModelInferenceConfigPanel({ readOnly }: { readOnly?: boolean }) {
  const BEST_MODEL_PATH = 's3://mlops-artifacts/model-tune/v12/best_model.pkl';
  const OUTPUT_PATH = 's3://mlops-artifacts/model-inference/v12/predict_result.parquet';

  const [samplePath, setSamplePath] = useState('');
  const [modelPath, setModelPath] = useState(BEST_MODEL_PATH);
  const [outputCopied, setOutputCopied] = useState(false);

  const handleOutputCopy = () => {
    try {
      const el = document.createElement('textarea');
      el.value = OUTPUT_PATH;
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(el);
      el.focus(); el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 1800);
    } catch {
      navigator.clipboard?.writeText(OUTPUT_PATH).then(() => {
        setOutputCopied(true);
        setTimeout(() => setOutputCopied(false), 1800);
      }).catch(() => {});
    }
  };

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const inputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[10px] font-mono text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  return (
    <div className="flex flex-col gap-4 px-4 py-3">

      {/* ── 1. Load Sample Path ── */}
      <div>
        <p className={labelCls}>
          Load Sample Path
          <FieldTooltip text="待预测样本的存储路径。支持 S3 / Hive 路径，推理时从该路径读取特征数据。" />
        </p>
        <input
          type="text"
          value={samplePath}
          disabled={readOnly}
          onChange={e => setSamplePath(e.target.value)}
          placeholder="s3://... or hive://schema.table"
          className={inputCls}
        />
      </div>

      {/* ── 2. Load best_model_path ── */}
      <div>
        <p className={labelCls}>
          Load best_model_path
          <FieldTooltip text="推理所用模型 .pkl 路径，默认引用 Model Tune · Train 的输出路径，可手动覆盖。" />
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={modelPath}
            disabled={readOnly}
            onChange={e => setModelPath(e.target.value)}
            placeholder="s3://...best_model.pkl"
            className={`${inputCls} flex-1`}
          />
          {!readOnly && (
            <button
              onClick={() => setModelPath(BEST_MODEL_PATH)}
              title="Reset to Model Tune · Train output path"
              className="shrink-0 h-8 px-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white
                text-[9px] font-semibold text-slate-400 hover:text-[#13c2c2] hover:border-[#13c2c2]/40 hover:bg-[#13c2c2]/5
                transition-all whitespace-nowrap"
            >
              <RotateCcw size={9} className="shrink-0" />
              Reset
            </button>
          )}
        </div>
        <p className="mt-1 text-[9px] text-slate-400 font-mono pl-0.5 truncate" title={BEST_MODEL_PATH}>
          ← Tune · Train: {BEST_MODEL_PATH}
        </p>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Output</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      {/* ── 3. predict_result_output_path (read-only + copy) ── */}
      <div>
        <p className={labelCls}>predict_result_output_path</p>
        <div className="flex items-center gap-1.5">
          <div
            className="flex-1 h-8 px-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center overflow-hidden"
            title={OUTPUT_PATH}
          >
            <span className="text-[10px] font-mono text-slate-400 truncate whitespace-nowrap">{OUTPUT_PATH}</span>
            <span className="ml-2 text-[9px] text-slate-300 italic shrink-0">view only</span>
          </div>
          <button
            onClick={handleOutputCopy}
            title="Copy output path"
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition-all
              ${outputCopied
                ? 'border-emerald-200 bg-emerald-50 text-emerald-500'
                : 'border-slate-200 bg-white text-slate-400 hover:border-[#13c2c2]/50 hover:text-[#13c2c2] hover:bg-[#13c2c2]/5'
              }`}
          >
            {outputCopied ? <CheckIcon size={12} strokeWidth={2.5} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

    </div>
  );
}

function DataSourceConfigPanel({ readOnly }: { readOnly?: boolean }) {
  const [sourceType, setSourceType] = useState<'hive' | 's3'>('hive');

  // Shared sample_use_col config
  const [sampleMode, setSampleMode] = useState<'use_existing' | 'auto_generate'>('use_existing');
  const [splitRatio, setSplitRatio] = useState('0.75_0.25');

  // Hive fields
  const [tableScheme, setTableScheme] = useState('dw_feature');
  const [tableName, setTableName]     = useState('user_credit_features_v12');
  const [customFilter, setCustomFilter] = useState('dt = \'2025-03-01\' AND sample_flag IN (\'train\', \'test\')');
  const [entityCols, setEntityCols]         = useState<string[]>(['user_id']);
  const [eventTimeCol, setEventTimeCol]     = useState('event_time');
  const [labelCol, setLabelCol]             = useState('is_default_30d');
  const [sampleUseCol, setSampleUseCol]     = useState('sample_flag');
  const [categoricalCol, setCategoricalCol] = useState('employment_status,region_code,product_type,channel');

  // S3 fields
  const [s3Path, setS3Path]                   = useState('s3://ml-data/credit/features/v12/');
  const [s3EntityCols, setS3EntityCols]       = useState<string[]>(['user_id']);
  const [s3EventTimeCol, setS3EventTimeCol]   = useState('event_time');
  const [s3LabelCol, setS3LabelCol]           = useState('is_default_30d');
  const [s3SampleUseCol, setS3SampleUseCol]   = useState('sample_flag');
  const [s3CategoricalCol, setS3CategoricalCol] = useState('employment_status,region_code,product_type,channel');

  // Compute available columns for Hive (non-empty scheme+name → show mock list)
  const schemaReady = tableScheme.trim() !== '' && tableName.trim() !== '';
  const availableCols = schemaReady ? MOCK_HIVE_COLUMNS : [];

  const inputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20 transition-colors
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300`;
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {/* ── Source Type ── */}
      <div>
        <p className={labelCls}>Source Type</p>
        <div className="flex gap-2">
          {(['hive', 's3'] as const).map(t => (
            <button
              key={t}
              disabled={readOnly}
              onClick={() => !readOnly && setSourceType(t)}
              className={`flex-1 h-8 rounded-lg border text-xs font-semibold transition-all
                ${sourceType === t
                  ? 'border-[#13c2c2] bg-[#13c2c2]/8 text-[#0d9e9e]'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {t === 'hive' ? 'Hive' : 'S3'}
            </button>
          ))}
        </div>
      </div>

      {sourceType === 'hive' ? (
        <>
          {/* table_scheme */}
          <div>
            <p className={labelCls}><Table2 size={10} />table_scheme</p>
            <input
              value={tableScheme} onChange={e => setTableScheme(e.target.value)}
              disabled={readOnly} placeholder="e.g. dw_feature"
              className={inputCls}
            />
          </div>

          {/* table_name */}
          <div>
            <p className={labelCls}><Table2 size={10} />table_name</p>
            <input
              value={tableName} onChange={e => setTableName(e.target.value)}
              disabled={readOnly} placeholder="e.g. user_credit_features_v12"
              className={inputCls}
            />
          </div>

          {/* custom_filter */}
          <div>
            <p className={labelCls}>custom_filter</p>
            <textarea
              value={customFilter} onChange={e => setCustomFilter(e.target.value)}
              disabled={readOnly} rows={3}
              placeholder={"e.g. dt = '2025-03-01' AND\nsample_flag IN ('train','test')"}
              className={`w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700
                font-mono resize-none focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1
                focus:ring-[#13c2c2]/20 transition-colors leading-relaxed
                disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300`}
            />
          </div>

          {/* Entity Column — multi-select */}
          <div>
            <p className={labelCls}>Entity Column</p>
            <MultiColSelect
              values={entityCols}
              onChange={setEntityCols}
              options={availableCols}
              disabled={readOnly || !schemaReady}
            />
          </div>

          {/* EventTime Column — single-select */}
          <div>
            <p className={labelCls}>EventTime Column</p>
            <ColSelect
              value={eventTimeCol}
              onChange={setEventTimeCol}
              options={availableCols}
              disabled={readOnly || !schemaReady}
              placeholder={schemaReady ? '— select column —' : '— fill schema to load columns —'}
            />
          </div>

          {/* Label col — dropdown from parsed columns */}
          <div>
            <p className={labelCls}>Label Column</p>
            <ColSelect
              value={labelCol}
              onChange={setLabelCol}
              options={availableCols}
              disabled={readOnly || !schemaReady}
              placeholder={schemaReady ? '— select column —' : '— fill schema to load columns —'}
            />
          </div>

          {/* sample_use_col — mode switcher */}
          <SampleUseColSection
            mode={sampleMode} onModeChange={setSampleMode}
            colValue={sampleUseCol} onColChange={setSampleUseCol}
            colOptions={availableCols} colsDisabled={!schemaReady}
            ratio={splitRatio} onRatioChange={setSplitRatio}
            readOnly={readOnly}
          />

          {/* categorical_col */}
          <div>
            <p className={labelCls}>categorical_col
              <FieldTooltip text="Enter categorical feature column names, comma-separated." />
            </p>
            <input
              value={categoricalCol} onChange={e => setCategoricalCol(e.target.value)}
              disabled={readOnly} placeholder="col_a,col_b,col_c"
              className={inputCls}
            />
          </div>
        </>
      ) : (
        <>
          {/* s3_path */}
          <div>
            <p className={labelCls}><FolderOpen size={10} />s3_path</p>
            <input
              value={s3Path} onChange={e => setS3Path(e.target.value)}
              disabled={readOnly} placeholder="s3://bucket/prefix/"
              className={inputCls}
            />
          </div>

          {/* Entity Column — multi-select */}
          <div>
            <p className={labelCls}>Entity Column</p>
            <MultiColSelect
              values={s3EntityCols}
              onChange={setS3EntityCols}
              options={MOCK_HIVE_COLUMNS}
              disabled={readOnly}
            />
          </div>

          {/* EventTime Column — single-select */}
          <div>
            <p className={labelCls}>EventTime Column</p>
            <ColSelect
              value={s3EventTimeCol}
              onChange={setS3EventTimeCol}
              options={MOCK_HIVE_COLUMNS}
              disabled={readOnly}
              placeholder="— select column —"
            />
          </div>

          {/* label col name — dropdown */}
          <div>
            <p className={labelCls}>Label Column</p>
            <ColSelect
              value={s3LabelCol}
              onChange={setS3LabelCol}
              options={MOCK_HIVE_COLUMNS}
              disabled={readOnly}
              placeholder="— select column —"
            />
          </div>

          {/* sample_use_col — mode switcher */}
          <SampleUseColSection
            mode={sampleMode} onModeChange={setSampleMode}
            colValue={s3SampleUseCol} onColChange={setS3SampleUseCol}
            colOptions={MOCK_HIVE_COLUMNS}
            ratio={splitRatio} onRatioChange={setSplitRatio}
            readOnly={readOnly}
          />

          {/* categorical_col */}
          <div>
            <p className={labelCls}>categorical_col
              <FieldTooltip text="Enter categorical feature column names, comma-separated." />
            </p>
            <input
              value={s3CategoricalCol} onChange={e => setS3CategoricalCol(e.target.value)}
              disabled={readOnly} placeholder="col_a,col_b,col_c"
              className={inputCls}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ────────���────── Regular node panel ─────────────── */
function RegularNodePanel({ node, lastRunMap, propOverrides, readOnly }: {
  node: DagNode;
  lastRunMap: LastRunMap;
  propOverrides?: Partial<Record<NodeType, { label: string; value: string }[]>>;
  readOnly?: boolean;
}) {
  const style = NODE_STYLES[node.type] ?? NODE_STYLES.data_source;
  const [activeTab, setActiveTab] = useState<'config' | 'lastrun'>('config');
  const [showBinning, setShowBinning] = useState(false);

  const props = propOverrides?.[node.type] ?? DEFAULT_PROPS[node.type] ?? [];
  const runInfo = lastRunMap[node.type];

  const statusStyle: Record<string, { dot: string; text: string; bg: string }> = {
    SUCCESS: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    FAILED:  { dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
    RUNNING: { dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
    SKIPPED: { dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.iconBg}`}>{style.icon}</div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${style.accent}`}>{node.label}</p>
          <p className="text-[11px] text-slate-400 truncate">{node.sublabel}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 shrink-0">
        {(['config', 'lastrun'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px
              ${activeTab === tab ? 'border-[#13c2c2] text-[#13c2c2]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {tab === 'config' ? 'Config' : 'Last Run'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'config' && (
          node.type === 'data_source' ? (
            <DataSourceConfigPanel readOnly={readOnly} />
          ) : node.type === 'woe_process' ? (
            <WoeProcessConfigPanel readOnly={readOnly} />
          ) : node.type === 'woe_update' ? (
            <WoeUpdateConfigPanel readOnly={readOnly} />
          ) : node.type === 'feature_sel' ? (
            <FeatureSelectionConfigPanel readOnly={readOnly} />
          ) : node.type === 'model_tune' ? (
            <ModelTuneConfigPanel readOnly={readOnly} />
          ) : node.type === 'model_inference' ? (
            <ModelInferenceConfigPanel readOnly={readOnly} />
          ) : (
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Properties</p>
              <div className="flex flex-col">
                {props.map(p => (
                  <div key={p.label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 gap-2">
                    <span className="text-xs text-slate-500 shrink-0">{p.label}</span>
                    <span className="text-xs font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded text-right truncate max-w-[140px]">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {activeTab === 'lastrun' && (
          <div className="px-4 py-3 flex flex-col gap-3">
            {/* View WOE Binning — only for woe_process */}
            {node.type === 'woe_process' && (
              <>
                <button
                  onClick={() => setShowBinning(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                    bg-gradient-to-r from-[#13c2c2]/10 to-cyan-50
                    border border-[#13c2c2]/30 hover:border-[#13c2c2] hover:from-[#13c2c2]/15 hover:to-cyan-100/80
                    text-[#13c2c2] hover:text-[#0d9e9e] transition-all group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#13c2c2]/15 border border-[#13c2c2]/30 flex items-center justify-center shrink-0 group-hover:bg-[#13c2c2]/25 transition-colors">
                    <Table2 size={14} className="text-[#13c2c2]" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold">View WOE Binning</p>
                    <p className="text-[10px] text-[#13c2c2]/70 mt-0.5">Browse all feature bin results →</p>
                  </div>
                </button>
                {showBinning && <WoeBinningModal onClose={() => setShowBinning(false)} />}
              </>
            )}
            {runInfo ? (
              <>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Run ID</p>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                    <span className="text-xs font-mono text-slate-600 truncate block">{runInfo.runId}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusStyle[runInfo.status].bg} ${statusStyle[runInfo.status].text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusStyle[runInfo.status].dot} ${runInfo.status === 'RUNNING' ? 'animate-pulse' : ''}`} />
                    {runInfo.status}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Finished Time</p>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 mb-1">
                    <span className="text-xs text-slate-600">{runInfo.finishedTime}</span>
                  </div>
                  <div className="flex justify-between px-0.5">
                    <span className="text-[10px] text-slate-400">Duration</span>
                    <span className="text-[10px] font-medium text-slate-500">{runInfo.duration}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Artifact Info</p>
                  <div className="flex flex-col rounded-lg border border-slate-100 overflow-hidden">
                    {runInfo.artifact.map((a, i) => (
                      <div key={a.label} className={`flex justify-between items-center px-2.5 py-2 gap-2 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                        <span className="text-[11px] text-slate-500 shrink-0">{a.label}</span>
                        <span className="text-[11px] font-medium text-slate-700 text-right truncate max-w-[130px] font-mono">{a.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2">
                <Clock size={22} />
                <p className="text-xs text-slate-400">No run data available</p>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
}

/* ─────────────── End Node panel ─────────────── */

/* ─────────────── Property panel dispatcher ─────────────── */
function PropertyPanel({ node, lastRunMap, propOverrides, readOnly }: {
  node: DagNode | null;
  lastRunMap: LastRunMap;
  propOverrides?: Partial<Record<NodeType, { label: string; value: string }[]>>;
  readOnly?: boolean;
}) {
  if (!node) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 px-6">
      <Settings size={28} />
      <p className="text-sm text-center text-slate-400">Click a pipeline node to view<br />and configure its properties</p>
    </div>
  );
  return <RegularNodePanel node={node} lastRunMap={lastRunMap} propOverrides={propOverrides} readOnly={readOnly} />;
}

/* ─────────────── Validation ─────────────── */
interface CheckResult { passed: boolean; items: { label: string; ok: boolean; detail: string }[]; }

function runFrontendCheck(nodes: DagNode[], edges: DagEdge[]): CheckResult {
  const hasSource    = nodes.some(n => n.type === 'data_source');
  const hasTrain     = nodes.some(n => n.type === 'model_tune');
  const hasOutput    = nodes.some(n => n.type === 'model_calibrate');
  const connectedIds = new Set<string>();
  edges.forEach(e => { connectedIds.add(e.from); connectedIds.add(e.to); });
  const allConnected = nodes.every(n => connectedIds.has(n.id));
  const hasCycle = (() => {
    const adj: Record<string, string[]> = {};
    nodes.forEach(n => { adj[n.id] = []; });
    edges.forEach(e => adj[e.from]?.push(e.to));
    const vis = new Set<string>(), stk = new Set<string>();
    function dfs(id: string): boolean {
      vis.add(id); stk.add(id);
      for (const nb of (adj[id] || [])) { if (!vis.has(nb) && dfs(nb)) return true; if (stk.has(nb)) return true; }
      stk.delete(id); return false;
    }
    return nodes.some(n => !vis.has(n.id) && dfs(n.id));
  })();
  const items = [
    { label: 'DataSource node exists',  ok: hasSource,    detail: hasSource    ? 'At least one source configured' : 'Add a DataSource node' },
    { label: 'Model Tune·Train exists', ok: hasTrain,     detail: hasTrain     ? 'Tune & Train node found'        : 'Add a Model Tune · Train node' },
    { label: 'Calibrate node exists',   ok: hasOutput,    detail: hasOutput    ? 'Output calibration configured'  : 'Add a Calibrate node' },
    { label: 'All nodes connected',     ok: allConnected, detail: allConnected ? 'No isolated nodes'              : 'Some nodes are disconnected' },
    { label: 'No cyclic dependencies',  ok: !hasCycle,    detail: !hasCycle    ? 'DAG is acyclic'                 : 'Cycle detected in graph' },
  ];
  return { passed: items.every(i => i.ok), items };
}

/* ─────────────── Minimap ─────────────── */
const MM_W = 184;
const MM_H = 116;

function Minimap({
  nodes, edges, pan, zoom, canvasW, canvasH, maxX, maxY,
  onNavigate,
}: {
  nodes: DagNode[]; edges: DagEdge[];
  pan: { x: number; y: number }; zoom: number;
  canvasW: number; canvasH: number;
  maxX: number; maxY: number;
  onNavigate: (pan: { x: number; y: number }) => void;
}) {
  const padX = 12, padY = 8;
  const innerW = MM_W - padX * 2;
  const innerH = MM_H - padY * 2;
  const boundsW = Math.max(1, maxX);
  const boundsH = Math.max(1, maxY);
  const scaleX = innerW / boundsW;
  const scaleY = innerH / boundsH;
  const sc = Math.min(scaleX, scaleY, 1);

  const nodeTypeColor: Record<NodeType, string> = {
    data_source:      '#93c5fd',
    woe_process:      '#93c5fd',
    woe_update:       '#93c5fd',
    feature_sel:      '#93c5fd',
    model_tune:       '#fcd34d',
    model_inference:  '#fcd34d',
    model_calibrate:  '#fcd34d',
  };

  // Viewport rect in world coords
  const vpX = -pan.x / zoom;
  const vpY = -pan.y / zoom;
  const vpW = canvasW / zoom;
  const vpH = canvasH / zoom;

  // Clamp viewport rect to world bounds for display
  const rx = Math.max(0, vpX) * sc + padX;
  const ry = Math.max(0, vpY) * sc + padY;
  const rw = Math.min(vpW, boundsW - Math.max(0, vpX)) * sc;
  const rh = Math.min(vpH, boundsH - Math.max(0, vpY)) * sc;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const clickX = (e.clientX - rect.left - padX) / sc;
    const clickY = (e.clientY - rect.top  - padY) / sc;
    onNavigate({
      x: canvasW / 2 - clickX * zoom,
      y: canvasH / 2 - clickY * zoom,
    });
  };

  return (
    <div
      className="rounded-xl overflow-hidden border border-slate-200 shadow-lg"
      style={{ width: MM_W, height: MM_H, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}
    >
      <svg
        width={MM_W} height={MM_H}
        onClick={handleClick}
        className="cursor-crosshair"
      >
        {/* Dot grid bg */}
        <rect width={MM_W} height={MM_H} fill="transparent" />

        {/* Edges */}
        {edges.map((edge, i) => {
          const src = nodes.find(n => n.id === edge.from);
          const dst = nodes.find(n => n.id === edge.to);
          if (!src || !dst) return null;
          const x1 = src.x * sc + padX + NODE_W * sc / 2;
          const y1 = src.y * sc + padY + NODE_H * sc / 2;
          const x2 = dst.x * sc + padX + NODE_W * sc / 2;
          const y2 = dst.y * sc + padY + NODE_H * sc / 2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={0.8} />;
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <rect
            key={node.id}
            x={node.x * sc + padX}
            y={node.y * sc + padY}
            width={Math.max(4, NODE_W * sc)}
            height={Math.max(3, NODE_H * sc)}
            rx={2}
            fill={nodeTypeColor[node.type]}
            opacity={0.85}
          />
        ))}

        {/* Viewport indicator */}
        {rw > 0 && rh > 0 && (
          <rect
            x={rx} y={ry} width={Math.max(4, rw)} height={Math.max(4, rh)}
            rx={2}
            fill="rgba(19,194,194,0.08)"
            stroke="#13c2c2"
            strokeWidth={1.2}
          />
        )}
      </svg>

      {/* Label */}
      <div className="absolute top-1.5 left-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wider pointer-events-none select-none">
        Overview
      </div>
    </div>
  );
}

/* ─────────────── Manage dropdown ─────────────── */
function ManageDropdown({
  task, onEnable, onDisable, onDelete, disabled,
}: {
  task: { status: string };
  onEnable: () => void;
  onDisable: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const canEnable  = task.status !== 'ENABLED';
  const canDisable = task.status === 'ENABLED';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(p => !p)}
        disabled={disabled}
        className={`h-8 flex items-center gap-1.5 px-3 rounded-lg border text-sm font-medium transition-colors
          ${disabled
            ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
            : open
              ? 'border-slate-300 bg-slate-100 text-slate-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        <Settings size={13} />
        Manage
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden py-1">
          {/* Enable */}
          <button
            onClick={() => { onEnable(); setOpen(false); }}
            disabled={!canEnable}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
              ${canEnable ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-300 cursor-not-allowed'}`}
          >
            <Power size={12} className={canEnable ? 'text-emerald-500' : 'text-slate-300'} />
            Enable
            {task.status === 'ENABLED' && <span className="ml-auto text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">ACTIVE</span>}
          </button>

          {/* Disable */}
          <button
            onClick={() => { onDisable(); setOpen(false); }}
            disabled={!canDisable}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
              ${canDisable ? 'text-amber-700 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed'}`}
          >
            <PowerOff size={12} className={canDisable ? 'text-amber-500' : 'text-slate-300'} />
            Disable
          </button>

          <div className="mx-3 border-t border-slate-100 my-1" />

          {/* Delete */}
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={12} className="text-rose-500" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Action dropdown (Trigger Run + Kill) ─────────────── */
function ActionDropdown({
  canTriggerRun,
  canKill,
  onTriggerRun,
  onKill,
}: {
  canTriggerRun: boolean;
  canKill: boolean;
  onTriggerRun: () => void;
  onKill: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const anyEnabled = canTriggerRun || canKill;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className={`h-8 flex items-center gap-1.5 pl-2.5 pr-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap shadow-sm
          ${open
            ? 'bg-[#0fa8a8] text-white'
            : 'bg-[#13c2c2] text-white hover:bg-[#10a8a8]'}`}
      >
        <Zap size={13} className="shrink-0" />
        Action
        <ChevronDown size={11} className={`ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden py-1.5">
          <p className="px-3 pt-0.5 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select action</p>

          {/* Trigger Run */}
          <button
            onClick={() => { if (canTriggerRun) { onTriggerRun(); setOpen(false); } }}
            disabled={!canTriggerRun}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
              ${canTriggerRun ? 'hover:bg-teal-50 cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${canTriggerRun ? 'bg-teal-50' : 'bg-slate-100'}`}>
              <PlayCircle size={14} className={canTriggerRun ? 'text-[#13c2c2]' : 'text-slate-300'} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${canTriggerRun ? 'text-slate-700' : 'text-slate-400'}`}>Trigger Run</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {canTriggerRun ? 'Execute full pipeline from start' : 'Not available in read-only view'}
              </p>
            </div>
          </button>

          <div className="mx-3 border-t border-slate-100 my-0.5" />

          {/* Kill */}
          <button
            onClick={() => { if (canKill) { onKill(); setOpen(false); } }}
            disabled={!canKill}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
              ${canKill ? 'hover:bg-rose-50 cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${canKill ? 'bg-rose-50' : 'bg-slate-100'}`}>
              <StopCircle size={14} className={canKill ? 'text-rose-500' : 'text-slate-300'} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${canKill ? 'text-rose-600' : 'text-slate-400'}`}>Kill</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {canKill ? 'Terminate the running instance' : 'Only for Waiting / Running status'}
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Run validation ─────────────── */
type RunMode = 'from_start' | 'from_current';

interface RunValidationResult {
  passed: boolean;
  errorNodeIds: string[];
  errorMessages: { nodeId: string; message: string }[];
  globalError?: string;
}

function validateRunPath(
  mode: RunMode,
  startNodeId: string | null,
  nodes: DagNode[],
  edges: DagEdge[],
): RunValidationResult {
  // "From Current Step" requires a selected node
  if (mode === 'from_current' && !startNodeId) {
    return {
      passed: false,
      errorNodeIds: [],
      errorMessages: [],
      globalError: 'No starting node selected. Click a node on the canvas first.',
    };
  }

  // BFS: collect reachable nodes from start
  let reachableIds: Set<string>;
  if (mode === 'from_start') {
    reachableIds = new Set(nodes.map(n => n.id));
  } else {
    reachableIds = new Set<string>();
    const queue = [startNodeId!];
    while (queue.length) {
      const curr = queue.shift()!;
      if (reachableIds.has(curr)) continue;
      reachableIds.add(curr);
      edges.filter(e => e.from === curr).forEach(e => queue.push(e.to));
    }
  }

  const reachable = nodes.filter(n => reachableIds.has(n.id));
  const errorMessages: { nodeId: string; message: string }[] = [];

  for (const node of reachable) {
    // Rule 1: BayesOpt HPO needs ≥ 100 trials (currently 50 in default config)
    if (node.type === 'model_tune' && node.sublabel.toLowerCase().includes('bayesopt')) {
      errorMessages.push({
        nodeId: node.id,
        message: 'BayesOpt requires ≥ 100 trials for reliable convergence (currently 50)',
      });
    }
    // Rule 2: locked nodes cannot be executed (Calibrate is exempt — optional post-processing)
    if (node.status === 'locked' && mode === 'from_start' && node.type !== 'model_calibrate') {
      errorMessages.push({
        nodeId: node.id,
        message: `Node "${node.label}" is locked and cannot be executed`,
      });
    }
  }

  return {
    passed: errorMessages.length === 0,
    errorNodeIds: errorMessages.map(e => e.nodeId),
    errorMessages,
  };
}

/* ─────────────── Run dropdown ─────────────── */
function RunDropdown({
  selectedNodeId, disabled,
  onRun,
}: {
  selectedNodeId: string | null;
  disabled?: boolean;
  onRun: (mode: RunMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const options: { mode: RunMode; label: string; desc: string; icon: React.ReactNode; available: boolean; tip?: string }[] = [
    {
      mode: 'from_current',
      label: 'From Current Step',
      desc: selectedNodeId ? 'Execute from selected node onward' : 'Select a node on canvas first',
      icon: <FastForward size={13} className={selectedNodeId ? 'text-[#13c2c2]' : 'text-slate-300'} />,
      available: true,
      tip: !selectedNodeId ? 'Click a pipeline node on the canvas to set the starting point' : undefined,
    },
    {
      mode: 'from_start',
      label: 'From Start',
      desc: 'Execute the full pipeline from DataSource',
      icon: <Rewind size={13} className="text-indigo-500" />,
      available: true,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(p => !p)}
        disabled={disabled}
        className={`h-8 flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap shadow-sm
          ${disabled
            ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
            : open
              ? 'bg-[#0fa8a8] text-white'
              : 'bg-[#13c2c2] text-white hover:bg-[#10a3a3]'}`}
      >
        <PlayCircle size={13} />
        Run
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden py-1.5">
          <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select execution mode</p>
          {options.map(opt => (
            <button
              key={opt.mode}
              onClick={() => { if (opt.available) { onRun(opt.mode); setOpen(false); } }}
              className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors
                ${opt.mode === 'from_current' && !selectedNodeId
                  ? 'opacity-50 cursor-not-allowed hover:bg-slate-50'
                  : 'hover:bg-slate-50'}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                ${opt.mode === 'from_current' ? (selectedNodeId ? 'bg-teal-50' : 'bg-slate-100') : 'bg-indigo-50'}`}>
                {opt.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700">{opt.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Run error notification ─────────────── */
function RunErrorNotification({
  result,
  nodes,
  onClose,
}: {
  result: RunValidationResult;
  nodes: DagNode[];
  onClose: () => void;
}) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-[72px] right-5 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-700">Run Validation Failed</p>
            <p className="text-[10px] text-rose-400 mt-0.5">No Run ID was generated</p>
          </div>
          <button onClick={onClose} className="text-rose-300 hover:text-rose-500 transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-2.5 max-h-72 overflow-y-auto">
          {result.globalError && (
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
              <p className="text-xs text-rose-600">{result.globalError}</p>
            </div>
          )}
          {result.errorMessages.map((err, i) => {
            const n = nodeMap.get(err.nodeId);
            return (
              <div key={i} className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 flex flex-col gap-1">
                {n && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={10} className="text-rose-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">{n.label}</span>
                  </div>
                )}
                <p className="text-xs text-slate-600 leading-relaxed">{err.message}</p>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-rose-100 bg-rose-50/40">
          <p className="text-[10px] text-rose-400 text-center">Fix the highlighted nodes and try again</p>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Trigger Run Modal ─────────────── */
function TriggerRunModal({
  taskId,
  onClose,
  onConfirm,
}: {
  taskId: string;
  onClose: () => void;
  onConfirm: (notes: string, useCache: boolean) => void;
}) {
  const [notes, setNotes]       = useState('');
  const [useCache, setUseCache] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose, submitting]);

  const handleRun = () => {
    setSubmitting(true);
    // Brief delay to simulate submission
    setTimeout(() => onConfirm(notes, useCache), 480);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] overflow-hidden">
        {/* Teal top bar */}
        <div className="h-1 bg-gradient-to-r from-[#13c2c2] via-teal-400 to-cyan-300" />

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#13c2c2]/10 flex items-center justify-center shrink-0">
            <PlayCircle size={20} className="text-[#13c2c2]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-800">Trigger Run</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Execute the full pipeline with the current configuration. A config snapshot will be saved automatically.
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Cache toggle */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-700">Use Cache</p>
                {useCache && (
                  <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 uppercase tracking-wide">Recommended</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                {useCache
                  ? 'Reuse cached results for unchanged nodes — faster & saves compute.'
                  : 'Force full rerun — all nodes will re-execute regardless of cache.'}
              </p>
            </div>
            {/* Toggle switch */}
            <button
              onClick={() => setUseCache(p => !p)}
              disabled={submitting}
              className={`inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${useCache ? 'bg-[#13c2c2]' : 'bg-slate-300'}`}
            >
              <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ml-0.5 ${useCache ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <FileText size={9} />
              Run Notes
              <span className="ml-1 text-[9px] font-normal normal-case tracking-normal text-slate-300 border border-slate-200 rounded px-1">optional</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={submitting}
              placeholder="Record experiment purpose, hypotheses, or expected outcomes…"
              rows={3}
              className="w-full resize-none text-xs text-slate-700 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#13c2c2]/60 focus:bg-white transition-colors leading-relaxed disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={submitting}
            className="h-9 px-5 rounded-xl bg-[#13c2c2] text-white text-xs font-bold hover:bg-[#10a8a8] transition-all shadow-sm flex items-center gap-2 disabled:opacity-70"
          >
            {submitting ? (
              <><Loader2 size={13} className="animate-spin" />Submitting…</>
            ) : (
              <><PlayCircle size={13} />Run</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckResultPanel({ result, onClose }: { result: CheckResult; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      <div className="fixed right-6 top-20 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className={`px-4 py-3 flex items-center gap-2.5 border-b ${result.passed ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          {result.passed ? <CheckCheck size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-500 shrink-0" />}
          <span className={`text-sm font-semibold ${result.passed ? 'text-emerald-700' : 'text-rose-600'}`}>{result.passed ? 'All checks passed' : 'Validation failed'}</span>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-2.5">
          {result.items.map(item => (
            <div key={item.label} className="flex items-start gap-2.5">
              <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${item.ok ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {item.ok ? <CheckIcon size={9} className="text-emerald-600" strokeWidth={3} /> : <X size={9} className="text-rose-500" strokeWidth={3} />}
              </div>
              <div><p className="text-xs font-medium text-slate-700">{item.label}</p><p className="text-xs text-slate-400 mt-0.5">{item.detail}</p></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────────── Save Update Popover ─────────────── */
function SaveUpdatePopover({
  anchorRef,
  currentVersion,
  nextVersion,
  saving,
  onCancel,
  onConfirm,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  currentVersion: string;
  nextVersion: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 8, left: r.right + window.scrollX });
    }
  }, [anchorRef]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onCancel();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onCancel, anchorRef]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return ReactDOM.createPortal(
    <div
      ref={popRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
      className="w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
    >
      {/* Caret */}
      <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45 rounded-sm" />

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-gradient-to-br from-[#f0fafa] to-white">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-xl bg-[#13c2c2]/12 flex items-center justify-center shrink-0">
            <ArrowUpToLine size={15} className="text-[#0d9e9e]" strokeWidth={2.3} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Save & Publish Update</p>
            <p className="text-[10px] text-slate-400 mt-0.5">This will create a new config version</p>
          </div>
        </div>
        {/* Version badge row */}
        <div className="flex items-center gap-2 pl-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-mono font-semibold border border-slate-200">
            <Clock size={9} className="text-slate-400" />{currentVersion}
          </span>
          <svg width="20" height="10" viewBox="0 0 20 10"><path d="M2 5h14M12 1l4 4-4 4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#13c2c2]/12 text-[#0d9e9e] text-[11px] font-mono font-semibold border border-[#13c2c2]/30">
            <CheckCircle2 size={9} className="text-[#13c2c2]" />{nextVersion}
          </span>
          <span className="text-[10px] text-slate-400 ml-auto italic">new version</span>
        </div>
      </div>

      {/* Notes textarea */}
      <div className="px-4 py-3">
        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          <FileText size={9} />Notes
          <span className="ml-1 text-[9px] font-normal normal-case tracking-normal text-slate-300 border border-slate-200 rounded px-1">optional</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Describe what changed in this version…"
          rows={3}
          className="w-full resize-none text-xs text-slate-700 placeholder:text-slate-300 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#13c2c2]/60 focus:bg-white transition-colors leading-relaxed"
        />
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="h-8 px-3.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(notes)}
          disabled={saving}
          className="h-8 px-4 rounded-lg bg-[#13c2c2] text-white text-xs font-semibold hover:bg-[#10a3a3] transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-70"
        >
          {saving ? (
            <><Loader2 size={12} className="animate-spin" />Publishing…</>
          ) : (
            <><ArrowUpToLine size={12} strokeWidth={2.5} />Confirm &amp; Publish</>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────── Main Canvas Page ─────────────── */
export function ConfigDetailPage({ task: initialTask, onBack, onSave, runInstance, onBackToConfig, onKill, onRunCreated }: ConfigDetailPageProps) {
  const { nodes: initNodes, edges } = buildDefaultDag();
  const [task, setTask]             = useState<TrainingTask>(initialTask);
  // Guard: if stored nodes contain stale types (e.g. from HMR state preservation), reset to fresh DAG
  const [nodes, setNodes]           = useState<DagNode[]>(() => {
    return initNodes;
  });
  // Reset nodes whenever DAG definition changes (handles HMR stale state)
  const validTypeSet = React.useMemo(() => new Set(Object.keys(NODE_STYLES)), []);
  React.useEffect(() => {
    if (nodes.some(n => !validTypeSet.has(n.type))) {
      setNodes(initNodes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validTypeSet]);
  const [selectedId, setSelectedId] = useState<string | null>('n1');
  const [zoom, setZoom]             = useState(0.72);
  const [pan, setPan]               = useState({ x: 32, y: 80 });
  const [execConfig, setExecConfig] = useState<TaskConfigState>({ resourceTier: 'Medium', queuePriority: 'Normal' });
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({ mode: 'once', cronExpr: '0 6 * * *', time: '00:00', timezone: 'UTC+8' });
  const [showExpMetaEditModal, setShowExpMetaEditModal] = useState(false);
  const [showExecuteConfigModal, setShowExecuteConfigModal] = useState(false);
  const [checking, setChecking]       = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [showCheckPanel, setShowCheckPanel] = useState(false);
  const checkPassed = checkResult?.passed === true;
  const [canvasSize, setCanvasSize]   = useState({ w: 900, h: 600 });

  // Run state
  const [errorIds, setErrorIds]           = useState<string[]>([]);
  const [errorMsgMap, setErrorMsgMap]     = useState<Record<string, string>>({});
  const [runValidResult, setRunValidResult] = useState<RunValidationResult | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);

  /* ── Run View state (live TaskInstance) ── */
  const isRunView = runInstance !== undefined;
  const nodeRunStatuses: Record<string, NodeRunStatus> = React.useMemo(
    () => runInstance ? deriveNodeRunStatuses(runInstance) : {},
    [runInstance]
  );

  /* ── Run History state (historical snapshot selected from dropdown) ── */
  const [activeRunHistorySnap, setActiveRunHistorySnap] = useState<VersionSnapshot | null>(null);
  const isRunHistoryView = activeRunHistorySnap !== null;

  // Node run statuses for the history view (derived from lastRunMap per node type)
  const nodeRunStatusesForHistory: Record<string, NodeRunStatus> = React.useMemo(
    () => activeRunHistorySnap ? deriveNodeRunStatusesFromLastRunMap(activeRunHistorySnap.lastRunMap) : {},
    [activeRunHistorySnap]
  );

  /* ── Version tracking (auto-saved on run) ── */
  const [currentVersion, setCurrentVersion] = useState(CURRENT_VERSION);

  // Effective nodes = base nodes + run history snapshot patches (if viewing a history run)
  const effectiveNodes: DagNode[] = React.useMemo(() => {
    if (!activeRunHistorySnap?.nodePatches) return nodes;
    return nodes.map(n => {
      const patch = activeRunHistorySnap.nodePatches![n.id];
      return patch ? { ...n, ...patch } : n;
    });
  }, [nodes, activeRunHistorySnap]);

  const effectiveLastRunMap: LastRunMap = isRunHistoryView ? activeRunHistorySnap!.lastRunMap : CURRENT_LAST_RUN;
  const effectivePropOverrides = isRunHistoryView ? activeRunHistorySnap!.propOverrides : undefined;

  const dragging    = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const canvasRef   = useRef<HTMLDivElement>(null);
  const panDragging = useRef<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, id: string) => {
    if (isRunHistoryView || isRunView) return;
    e.preventDefault(); e.stopPropagation();
    const node = nodes.find(n => n.id === id)!;
    dragging.current = { id, ox: e.clientX - node.x * zoom, oy: e.clientY - node.y * zoom };
  }, [nodes, zoom, isRunHistoryView, isRunView]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      const { id, ox, oy } = dragging.current;
      setNodes(prev => prev.map(n => n.id === id ? { ...n, x: Math.max(0, (e.clientX - ox) / zoom), y: Math.max(0, (e.clientY - oy) / zoom) } : n));
    }
    if (panDragging.current) {
      setPan({ x: panDragging.current.startPan.x + (e.clientX - panDragging.current.startX), y: panDragging.current.startPan.y + (e.clientY - panDragging.current.startY) });
    }
  }, [zoom]);

  const handleMouseUp = useCallback(() => { dragging.current = null; panDragging.current = null; }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const isBg = e.target === canvasRef.current || ['svg','path','line','g','rect','text','tspan','polygon'].includes(tag);
    if (e.button === 2) { e.preventDefault(); panDragging.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan } }; }
    else if (e.button === 0 && isBg) setSelectedId(null);
  }, [pan]);

  const handleWheel = useCallback((e: WheelEvent) => { e.preventDefault(); setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001))); }, []);
  useEffect(() => { const el = canvasRef.current; if (!el) return; el.addEventListener('wheel', handleWheel, { passive: false }); return () => el.removeEventListener('wheel', handleWheel); }, [handleWheel]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Close any open overlay in priority order; stop at the first one found
      if (showTriggerModal)         { setShowTriggerModal(false); return; }
      if (showExecuteConfigModal)   { setShowExecuteConfigModal(false); return; }
      if (showExpMetaEditModal)     { setShowExpMetaEditModal(false); return; }
      if (showCheckPanel)           { setShowCheckPanel(false); return; }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showTriggerModal, showExecuteConfigModal, showExpMetaEditModal, showCheckPanel]);

  // Track canvas container size for minimap viewport rect
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  const handleUpdateTask = useCallback((patch: Partial<Pick<TrainingTask, 'owner' | 'description'>>) => {
    setTask(prev => { const u = { ...prev, ...patch }; onSave(u); return u; });
  }, [onSave]);
  const handleUpdateExec      = useCallback((patch: Partial<TaskConfigState>) => setExecConfig(prev => ({ ...prev, ...patch })), []);

  const handleCheck = () => {
    setChecking(true); setCheckResult(null); setShowCheckPanel(false);
    setTimeout(() => { setCheckResult(runFrontendCheck(effectiveNodes, edges)); setChecking(false); setShowCheckPanel(true); }, 1200);
  };

  /* ── Confirm Run from modal ── */
  const handleRunConfirm = useCallback((notes: string, useCache: boolean) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const runId = `run-${now.toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const newInstance: TaskInstance = {
      id: runId,
      taskId: task.id,
      status: 'QUEUING',
      bindTask: task.taskName,
      notes: notes || undefined,
      triggerTime: nowStr,
      startTime: '—',
      finishTime: '—',
      duration: '—',
    };
    setShowTriggerModal(false);
    onRunCreated?.(newInstance);
  }, [task, onRunCreated]);

  /* ── Action handlers ── */
  const canKillRun = isRunView && (
    runInstance?.status === 'RUNNING' || runInstance?.status === 'QUEUING' || runInstance?.status === 'WAITING'
  );

  const handleTriggerRun = useCallback(() => {
    // Step 1: config integrity check (with spinner)
    setChecking(true);
    setCheckResult(null);
    setShowCheckPanel(false);
    setRunValidResult(null);
    setErrorIds([]);
    setErrorMsgMap({});

    setTimeout(() => {
      const configCheck = runFrontendCheck(effectiveNodes, edges);
      setChecking(false);

      if (!configCheck.passed) {
        // Show CheckResultPanel for config errors
        setCheckResult(configCheck);
        setShowCheckPanel(true);
        return;
      }

      // Step 2: run-path validation (BayesOpt trials, locked nodes, etc.)
      const pathResult = validateRunPath('from_start', null, effectiveNodes, edges);
      if (!pathResult.passed) {
        const msgMap: Record<string, string> = {};
        pathResult.errorMessages.forEach(e => { msgMap[e.nodeId] = e.message; });
        setErrorIds(pathResult.errorNodeIds);
        setErrorMsgMap(msgMap);
        setRunValidResult(pathResult);
        return;
      }

      // All checks passed — open Trigger Run modal
      setShowTriggerModal(true);
    }, 900);
  }, [effectiveNodes, edges]);

  const selectedNode = effectiveNodes.find(n => n.id === selectedId) ?? null;
  const maxX = Math.max(...effectiveNodes.map(n => n.x + NODE_W)) + 140;
  const maxY = Math.max(...effectiveNodes.map(n => n.y + NODE_H)) + 140;

  return (
    <div className="min-h-screen min-h-0 flex flex-col overflow-hidden bg-slate-100">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center shrink-0">
        {/* Left */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#13c2c2] transition-colors group shrink-0">
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>
          <div className="w-px h-4 bg-slate-200 shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GitBranch size={14} className="text-[#13c2c2] shrink-0" />
            <span
              className="text-slate-800 font-medium text-sm truncate"
              title={task.taskName}
            >{task.taskName}</span>
            <RegionBadge region={task.region} />
            {/* Edit Meta button */}
            {!isRunView && !isRunHistoryView && (
              <button
                onClick={() => setShowExpMetaEditModal(true)}
                className="flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-500 hover:text-[#13c2c2] hover:border-[#13c2c2]/40 transition-colors shrink-0"
              >
                <Pencil size={10} />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* ExpMeta Edit Modal */}
        {showExpMetaEditModal && (
          <ExpMetaEditModal
            task={task}
            onUpdateTask={patch => setTask(prev => ({ ...prev, ...patch }))}
            onClose={() => setShowExpMetaEditModal(false)}
          />
        )}
        {showExecuteConfigModal && (
          <ExecuteConfigModal
            onClose={() => setShowExecuteConfigModal(false)}
            execConfig={execConfig}
            onSaveExec={patch => setExecConfig(prev => ({ ...prev, ...patch }))}
            scheduleConfig={scheduleConfig}
            onUpdateSchedule={setScheduleConfig}
            readOnly={isRunHistoryView || isRunView}
          />
        )}

        {/* Center — mode indicator */}
        <div className="flex-1 flex items-center justify-center px-4">
          {isRunView ? (
            /* Run View (from list): consistent with History Run style */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                <PlayCircle size={12} className="text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-indigo-700">Run View</span>
              </div>
              <div className="w-px h-3.5 bg-slate-200" />
              <span className="font-mono text-[11px] text-slate-500">{runInstance!.id}</span>
              <div className="w-px h-3.5 bg-slate-200" />
              <InstanceStatusBadge status={runInstance!.status} />
            </div>
          ) : isRunHistoryView ? (
            /* History Run view: badge + run ID + status (no version) */
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                <History size={12} className="text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-indigo-700">History Run</span>
              </div>
              <div className="w-px h-3.5 bg-slate-200" />
              <span className="font-mono text-[11px] text-slate-500">{activeRunHistorySnap!.runId}</span>
              <div className="w-px h-3.5 bg-slate-200" />
              <RunOverallStatusBadge status={getRunOverallStatus(activeRunHistorySnap!.lastRunMap)} />
            </div>
          ) : (
            /* Normal edit mode: "Current Config" only — no version number */
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <GitBranch size={12} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Current Config</span>
            </div>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {isRunView ? (
            /* Run View: Back to Config + Action(Kill only) */
            <>
              <ActionDropdown
                canTriggerRun={false}
                canKill={canKillRun}
                onTriggerRun={handleTriggerRun}
                onKill={() => onKill?.()}
              />
              <button
                onClick={onBackToConfig ?? onBack}
                className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} />Back to Config
              </button>
            </>
          ) : isRunHistoryView ? (
            /* History Run view: Back to Config + Action(all disabled) */
            <>
              <ActionDropdown
                canTriggerRun={false}
                canKill={false}
                onTriggerRun={handleTriggerRun}
                onKill={() => {}}
              />
              <button
                onClick={() => { setActiveRunHistorySnap(null); setSelectedId(null); }}
                className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} />Back to Config
              </button>
            </>
          ) : (
            /* Normal edit mode: Run History + Action(Trigger Run only) */
            <>
              {/* Run History dropdown */}
              <RunHistoryDropdown
                currentVersion={currentVersion}
                activeRunId={activeRunHistorySnap?.runId}
                onSelectRun={snap => { setActiveRunHistorySnap(snap); setSelectedId(null); }}
              />

              <button
                type="button"
                onClick={() => setShowExecuteConfigModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-800 border-2 border-teal-400/80 bg-teal-50/70 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all shadow-sm"
              >
                Execute Config
              </button>

              {/* Action dropdown */}
              <ActionDropdown
                canTriggerRun={true}
                canKill={false}
                onTriggerRun={handleTriggerRun}
                onKill={() => {}}
              />
            </>
          )}
        </div>
      </div>

      {/* Run History banner */}
      {isRunHistoryView && !isRunView && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-2 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <History size={13} className="text-indigo-500 shrink-0" />
            <span className="text-xs text-indigo-700">
              Viewing history run <span className="font-semibold font-mono">{activeRunHistorySnap!.runId}</span>
              {' '}· Triggered {activeRunHistorySnap!.createdAt}
            </span>
          </div>
          {/* Legend */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {[
              { color: 'bg-emerald-400', label: 'Success'      },
              { color: 'bg-blue-400',    label: 'Running'      },
              { color: 'bg-rose-400',    label: 'Failed'       },
              { color: 'bg-amber-400',   label: 'Cache Skipped'},
              { color: 'bg-slate-300',   label: 'Pending'      },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1 text-[10px] text-slate-500">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
            <span className="text-[10px] bg-indigo-100 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-semibold ml-1">READ-ONLY</span>
          </div>
        </div>
      )}

      {/* Run View banner — indigo style, consistent with History Run */}
      {isRunView && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-2 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <PlayCircle size={13} className="text-indigo-500 shrink-0" />
            <span className="text-xs text-indigo-700">
              Run <span className="font-semibold font-mono">{runInstance!.id}</span>
              {' '}· Trigger: {runInstance!.triggerTime}
              {' '}· Start: {runInstance!.startTime}
              {' '}· Finish: {runInstance!.finishTime}
              {' '}· Duration: <span className="font-mono">{runInstance!.duration}</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {[
              { color: 'bg-emerald-400', label: 'Success'      },
              { color: 'bg-blue-400',    label: 'Running'      },
              { color: 'bg-rose-400',    label: 'Failed'       },
              { color: 'bg-amber-400',   label: 'Cache Skipped'},
              { color: 'bg-slate-300',   label: 'Pending'      },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1 text-[10px] text-slate-500">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
            <span className="text-[10px] bg-indigo-100 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-semibold ml-1">READ-ONLY</span>
          </div>
        </div>
      )}

      {/* Canvas + panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* DAG canvas */}
        <div ref={canvasRef} className="flex-1 min-h-0 relative overflow-hidden cursor-default"
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onMouseDown={handleCanvasMouseDown} onContextMenu={e => e.preventDefault()}>

          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: `${24*zoom}px ${24*zoom}px`, backgroundPosition: `${pan.x%(24*zoom)}px ${pan.y%(24*zoom)}px` }} />

          <div className="absolute" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" style={{ width: maxX, height: maxY }}>
              <defs>
                <marker id="arrow-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>
              {edges.map((e, i) => <Arrow key={i} edge={e} nodes={effectiveNodes} />)}
            </svg>
            {effectiveNodes.map(node => {
              // Determine run execution status: live run view takes priority, then history view
              const runExecStatus: NodeRunStatus | undefined =
                isRunView         ? (nodeRunStatuses[node.id]           ?? 'pending')
                : isRunHistoryView ? (nodeRunStatusesForHistory[node.id] ?? 'pending')
                : undefined;
              return (
                <DagNodeCard
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id}
                  hasError={!isRunView && !isRunHistoryView && errorIds.includes(node.id)}
                  errorMsg={errorMsgMap[node.id]}
                  runExecStatus={runExecStatus}
                  onSelect={() => { setSelectedId(node.id); }}
                  onDragStart={handleNodeDragStart}
                />
              );
            })}
          </div>

          {showCheckPanel && checkResult && <CheckResultPanel result={checkResult} onClose={() => setShowCheckPanel(false)} />}

          {/* Zoom + Minimap — bottom left stack */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1.5 items-start">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-1.5 py-1 shadow-sm">
              <button
                onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                title="Zoom out"
              ><ZoomOut size={12} /></button>
              <span className="text-[11px] text-slate-500 w-8 text-center tabular-nums select-none">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                title="Zoom in"
              ><ZoomIn size={12} /></button>
              <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
              <button
                onClick={() => { setZoom(0.72); setPan({ x: 32, y: 80 }); }}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
                title="Fit to screen"
              ><Maximize2 size={11} /></button>
            </div>

            {/* Minimap */}
            <Minimap
              nodes={effectiveNodes}
              edges={edges}
              pan={pan}
              zoom={zoom}
              canvasW={canvasSize.w}
              canvasH={canvasSize.h}
              maxX={maxX}
              maxY={maxY}
              onNavigate={newPan => setPan(newPan)}
            />
          </div>

          {/* Hint — bottom right */}
          <div className="absolute bottom-4 right-4 text-[10px] text-slate-400 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-100 pointer-events-none">
            {(isRunView || isRunHistoryView)
              ? 'Right-drag to pan · Scroll to zoom · Click node to inspect'
              : 'Right-drag to pan · Scroll to zoom · Click a pipeline node to set run start'}
          </div>

          {/* Run validation error notification */}
          {runValidResult && !runValidResult.passed && (
            <RunErrorNotification
              result={runValidResult}
              nodes={effectiveNodes}
              onClose={() => { setRunValidResult(null); setErrorIds([]); setErrorMsgMap({}); }}
            />
          )}
        </div>

        {/* Trigger Run modal */}
        {showTriggerModal && (
          <TriggerRunModal
            taskId={task.id}
            onClose={() => setShowTriggerModal(false)}
            onConfirm={handleRunConfirm}
          />
        )}

        {/* Right panel */}
        <div className="w-64 min-h-0 h-full overflow-hidden bg-white border-l border-slate-200 flex flex-col shrink-0">
          <PropertyPanel
            node={selectedNode}
            lastRunMap={effectiveLastRunMap}
            propOverrides={effectivePropOverrides}
            readOnly={isRunHistoryView || isRunView}
          />
        </div>
      </div>
    </div>
  );
}
