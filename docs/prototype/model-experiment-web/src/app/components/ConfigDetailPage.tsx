import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  ArrowLeft, Save, ZoomIn, ZoomOut, ArrowUpToLine,
  Maximize2, GitBranch, Database,
  Settings, Lock, X,
  CheckCheck, AlertCircle, Loader2, ShieldCheck,
  ChevronDown, ChevronRight, Check as CheckIcon, SlidersHorizontal,
  Filter, Cpu, TrendingUp, Sliders,
  History, Clock, RotateCcw, PlayCircle, PowerOff, Trash2,
  Power, Rewind, FastForward, CheckCircle2, AlertTriangle, XCircle,
  HelpCircle, Table2, FolderOpen, Copy, Plus, FileText, StopCircle, Zap,
  Pencil, Flag, Inbox,
} from 'lucide-react';
import {
  TrainingTask, ALL_OWNERS, REGISTERED_MODELS, TaskInstance, InstanceStatus, PipelineEnvRow,
  mergePipelineEnvWithDefaults, getPipelineEnvValue, upsertPipelineEnvRow, getDefaultPipelineEnvRows,
} from './data';
import { TaskStatusBadge, RegionBadge, InstanceStatusBadge } from './StatusBadge';
import { WoeBinningModal } from './WoeBinningModal';
import { FeatureReportModal } from './FeatureReportModal';
import { FeatureSelectionReportModal } from './FeatureSelectionReportModal';

interface ConfigDetailPageProps {
  task: TrainingTask;
  onBack: () => void;
  /** Optional: merge current canvas task into app state (e.g. pipeline ENV) before leaving */
  onPersistDraft?: (task: TrainingTask) => void;
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

/** Passed into per-node config panels for pipeline ENV read/write. */
type NodePanelEnvProps = {
  task: TrainingTask;
  onPatchPipelineEnvRow: (key: string, value: string) => void;
  readOnly?: boolean;
  /** When set (WOE Fit on canvas), enables upstream variable cascade picker from DAG. */
  woeFitDagContext?: { woeFitNodeId: string; nodes: DagNode[]; edges: DagEdge[] };
  /** When set (WOE Transform on canvas), enables upstream cascades from DAG. */
  woeTransformDagContext?: { woeTransformNodeId: string; nodes: DagNode[]; edges: DagEdge[] };
  /** When set (Feature Selection on canvas), enables upstream data_path cascade from DAG. */
  featureSelectionDagContext?: { featureSelectionNodeId: string; nodes: DagNode[]; edges: DagEdge[] };
  /** When set (LGBM tune & train on canvas), enables upstream cascades for data and selection report. */
  tuneTrainDagContext?: { tuneTrainNodeId: string; nodes: DagNode[]; edges: DagEdge[] };
  /** When set (Model Prediction on canvas), enables upstream cascades for data and best model. */
  modelPredictionDagContext?: { modelPredictionNodeId: string; nodes: DagNode[]; edges: DagEdge[] };
};

const WOE_FIT_INPUT_BINDING_ENV = 'woe_fit_input_binding';
const WOE_FIT_FIXED_DATA_PATH_ENV = 'woe_fit_fixed_data_path';
const WOE_FIT_SAMPLE_SCOPE_ENV = 'woe_fit_sample_scope';
const WOE_FIT_LABEL_COLUMN_ENV = 'woe_fit_label_column';
const WOE_FIT_CATEGORICAL_FEATURES_ENV = 'woe_fit_categorical_features';
const WOE_FIT_WOE_MISSING_VALUES_ENV = 'woe_fit_woe_missing_values';
const WOE_FIT_WOE_MISSING_LOGIC_ENV = 'woe_fit_woe_missing_logic';
const WOE_FIT_EXCLUDE_COLUMNS_ENV = 'woe_fit_exclude_columns';
const WOE_FIT_N_BINS_ENV = 'woe_fit_n_bins';
const WOE_FIT_METHOD_ENV = 'woe_fit_method';
const WOE_FIT_MIN_BIN_RATE_ENV = 'woe_fit_min_bin_rate';
const WOE_FIT_MIN_BIN_SIZE_ENV = 'woe_fit_min_bin_size';
const WOE_FIT_MIN_MISSING_BAD_CNT_ENV = 'woe_fit_min_missing_bad_cnt';
const WOE_FIT_DICT_NBINS_ENV = 'woe_fit_dict_nbins';
const WOE_FIT_DICT_MISSING_VALUES_ENV = 'woe_fit_dict_missing_values';
const WOE_FIT_DICT_MIN_BIN_RATE_ENV = 'woe_fit_dict_min_bin_rate';
const WOE_FIT_DICT_MIN_BIN_SIZE_ENV = 'woe_fit_dict_min_bin_size';
const WOE_FIT_DICT_MIN_MISSING_BAD_CNT_ENV = 'woe_fit_dict_min_missing_bad_cnt';
const WOE_FIT_WOE_UPDATE_ENABLED_ENV = 'woe_fit_woe_update_enabled';
const WOE_FIT_WOE_UPDATES_JSON_ENV = 'woe_fit_woe_updates_json';
const WOE_FIT_WOE_ENCODER_PATH_ENV = 'woe_fit_woe_encoder_path';
const WOE_FIT_CHECKPOINT_AFTER_NODE_ENV = 'woe_fit_checkpoint_after_node';
const WOE_TRANSFORM_INPUT_BINDING_ENV = 'woe_transform_input_binding';
const WOE_TRANSFORM_FIXED_DATA_PATH_ENV = 'woe_transform_fixed_data_path';
const WOE_TRANSFORM_ENCODER_BINDING_ENV = 'woe_transform_encoder_binding';
const WOE_TRANSFORM_FIXED_ENCODER_PATH_ENV = 'woe_transform_fixed_encoder_path';
const WOE_TRANSFORM_SAMPLE_SCOPE_ENV = 'woe_transform_sample_scope';
const WOE_TRANSFORM_FEATURE_REPORT_ENV = 'woe_transform_feature_report';
const WOE_TRANSFORM_STABILITY_DIM_ENV = 'woe_transform_stability_dim';
const WOE_TRANSFORM_REPORT_TABS_ENV = 'woe_transform_report_tabs';
const WOE_TRANSFORM_CHECKPOINT_AFTER_NODE_ENV = 'woe_transform_checkpoint_after_node';
const FEATURE_SELECTION_INPUT_BINDING_ENV = 'feature_selection_input_binding';
const FEATURE_SELECTION_FIXED_DATA_PATH_ENV = 'feature_selection_fixed_data_path';
const FEATURE_SELECTION_SAMPLE_SCOPE_ENV = 'feature_selection_sample_scope';
const FEATURE_SELECTION_EXCLUDE_COLUMNS_ENV = 'feature_selection_exclude_columns';
const FEATURE_SELECTION_SELECT_METHODS_ENV = 'feature_selection_select_methods';
const FEATURE_SELECTION_IV_THRESHOLD_ENV = 'feature_selection_iv_threshold';
const FEATURE_SELECTION_CORR_THRESHOLD_ENV = 'feature_selection_corr_threshold';
const FEATURE_SELECTION_PSI_THRESHOLD_ENV = 'feature_selection_psi_threshold';
const FEATURE_SELECTION_CHECKPOINT_AFTER_NODE_ENV = 'feature_selection_checkpoint_after_node';

const TUNE_TRAIN_DATA_INPUT_BINDING_ENV = 'tune_train_data_input_binding';
const TUNE_TRAIN_FIXED_DATA_PATH_ENV = 'tune_train_fixed_data_path';
const TUNE_TRAIN_FEATURE_SELECTION_INPUT_BINDING_ENV = 'tune_train_feature_selection_input_binding';
const TUNE_TRAIN_FIXED_FEATURE_SELECTION_PATH_ENV = 'tune_train_fixed_feature_selection_path';
const TUNE_TRAIN_EXCLUDE_COLS_ENV = 'tune_train_exclude_cols';
const TUNE_TRAIN_AUXILARY_COLS_ENV = 'tune_train_auxilary_cols';
const TUNE_TRAIN_SAMPLE_WEIGHT_COL_ENV = 'tune_train_sample_weight_col';
const TUNE_TRAIN_N_TRIALS_ENV = 'tune_train_n_trials';
const TUNE_TRAIN_METRIC_FOR_TRAIN_TUNE_ENV = 'tune_train_metric_for_train_tune';
const TUNE_TRAIN_TRAIN_VAL_SPLIT_ENV = 'tune_train_train_val_split';
const TUNE_TRAIN_TRAIN_VAL_KS_DIFF_THRESHOLD_ENV = 'tune_train_train_val_ks_diff_threshold';
const TUNE_TRAIN_COEF_OVERFIT_PUNISHMENT_ENV = 'tune_train_coef_overfit_punishment';
const TUNE_TRAIN_AUTO_SCALE_POS_WEIGHT_ENV = 'tune_train_auto_scale_pos_weight';
const TUNE_TRAIN_INIT_HYPERS_ENV = 'tune_train_init_hypers';
const TUNE_TRAIN_CHECKPOINT_AFTER_NODE_ENV = 'tune_train_checkpoint_after_node';
const TUNE_TRAIN_NUM_WORKERS_ENV = 'tune_train_num_workers';
const TUNE_TRAIN_CPU_PER_WORKER_ENV = 'tune_train_cpu_per_worker';
const TUNE_TRAIN_MEMORY_PER_WORKER_ENV = 'tune_train_memory_per_worker';

const MODEL_PREDICTION_DATA_INPUT_BINDING_ENV = 'model_prediction_data_input_binding';
const MODEL_PREDICTION_FIXED_DATA_PATH_ENV = 'model_prediction_fixed_data_path';
const MODEL_PREDICTION_BEST_MODEL_BINDING_ENV = 'model_prediction_best_model_binding';
const MODEL_PREDICTION_FIXED_BEST_MODEL_PATH_ENV = 'model_prediction_fixed_best_model_path';
const MODEL_PREDICTION_SAMPLE_SCOPE_ENV = 'model_prediction_sample_scope';
const MODEL_PREDICTION_AUXILARY_COLS_ENV = 'model_prediction_auxilary_cols';
const MODEL_PREDICTION_SAMPLE_WEIGHT_COL_ENV = 'model_prediction_sample_weight_col';
const MODEL_PREDICTION_BATCH_SIZE_ENV = 'model_prediction_batch_size';
const MODEL_PREDICTION_OUTPUT_COLUMNS_ENV = 'model_prediction_output_columns';
const MODEL_PREDICTION_NUM_WORKERS_ENV = 'model_prediction_num_workers';
const MODEL_PREDICTION_CPU_PER_WORKER_ENV = 'model_prediction_cpu_per_worker';
const MODEL_PREDICTION_MEMORY_PER_WORKER_ENV = 'model_prediction_memory_per_worker';

function workflowStepLabel(node: DagNode): string {
  const p: Partial<Record<NodeType, string>> = {
    data_source: 'DataSource',
    woe_fit: 'WoeFit',
    woe_transform: 'WoeTransform',
    feature_selection: 'FeatureSelection',
    tune_train: 'LgbmTuneTrain',
    infer: 'ModelPrediction',
  };
  return `${p[node.type] ?? 'Node'}_${node.id}`;
}

function getUpstreamNodesForTarget(edges: DagEdge[], nodes: DagNode[], targetId: string): DagNode[] {
  const fromIds = edges.filter((e) => e.to === targetId).map((e) => e.from);
  return fromIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is DagNode => n !== undefined);
}

type WoeCascadePort = { key: string; label: string; typeLabel: string; disabled?: boolean };

type WoeCascadeKind =
  | 'fit_data'
  | 'transform_data'
  | 'transform_encoder'
  | 'feature_selection_data'
  | 'tune_train_selection_report'
  | 'tune_train_best_model';

function outputPortsForCascade(nodeType: NodeType, kind: WoeCascadeKind): WoeCascadePort[] {
  if (kind === 'tune_train_best_model' && nodeType === 'tune_train') {
    return [{ key: 'best_model_output', label: 'best_model_output', typeLabel: 'pkl' }];
  }
  if (kind === 'tune_train_selection_report' && nodeType === 'feature_selection') {
    return [{ key: 'selection_report_path', label: 'selection_report_path', typeLabel: 'data' }];
  }
  if (kind === 'fit_data' || kind === 'transform_data' || kind === 'feature_selection_data') {
    if (nodeType === 'data_source') {
      return [
        { key: 'features_data_path', label: 'features_data_path', typeLabel: 'string' },
        { key: 'loaded_data_path', label: 'loaded_data_path', typeLabel: 'string' },
        { key: 'row_count', label: 'row_count', typeLabel: 'int', disabled: true },
      ];
    }
    if (kind === 'feature_selection_data' && nodeType === 'woe_transform') {
      return [{ key: 'data_save_path', label: 'data_save_path', typeLabel: 'string' }];
    }
    return [{ key: 'output', label: 'output', typeLabel: 'string', disabled: true }];
  }
  if (nodeType === 'woe_fit') {
    return [{ key: 'encoder_save_path', label: 'encoder_save_path', typeLabel: 'pkl' }];
  }
  return [];
}

function parseWoeFitBinding(raw: string): { nodeId: string; portKey: string } | null {
  if (!raw || !raw.includes('|')) return null;
  const i = raw.indexOf('|');
  const nodeId = raw.slice(0, i);
  const portKey = raw.slice(i + 1);
  if (!nodeId || !portKey) return null;
  return { nodeId, portKey };
}

function formatWoeFitBinding(raw: string): string {
  const p = parseWoeFitBinding(raw);
  return p ? `${p.nodeId} / ${p.portKey}` : '';
}

function resolveCascadePortPath(
  nodeId: string,
  portKey: string,
  nodes: DagNode[],
  task: TrainingTask,
  pipelineEnv: PipelineEnvRow[] | undefined,
  kind: WoeCascadeKind,
): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (kind === 'tune_train_best_model' && node?.type === 'tune_train' && portKey === 'best_model_output') {
    return buildLgbmTuneBestModelOutputPath(task, pipelineEnv);
  }
  if (kind === 'tune_train_selection_report' && node?.type === 'feature_selection' && portKey === 'selection_report_path') {
    return buildFeatureSelectionSelectionReportPathDisplay(task, pipelineEnv);
  }
  if (kind === 'fit_data' || kind === 'transform_data' || kind === 'feature_selection_data') {
    if (node?.type === 'data_source') {
      if (portKey === 'features_data_path') return buildDataSourceFeaturesInputPath(task, pipelineEnv);
      if (portKey === 'loaded_data_path') return buildDataSourceLoadedOutputPath(task, pipelineEnv);
    }
    if (kind === 'feature_selection_data' && node?.type === 'woe_transform' && portKey === 'data_save_path') {
      return buildWoeTransformDataSavePathDisplay(task, pipelineEnv);
    }
    return buildDataSourceFeaturesInputPath(task, pipelineEnv);
  }
  if (node?.type === 'woe_fit' && portKey === 'encoder_save_path') {
    return buildWoeEncoderSavePathDisplay(task, 10, pipelineEnv);
  }
  return buildWoeEncoderSavePathDisplay(task, 10, pipelineEnv);
}

/* ─────────────── Node types ─────────────── */
type NodeType =
  | 'data_source'
  | 'woe_fit'
  | 'woe_transform'
  | 'feature_selection'
  | 'tune_train'
  | 'infer';

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
/** Canvas right PropertyPanel width (legacy w-64 256px × 1.5). */
const CONFIG_PANEL_WIDTH_PX = 384;
const GX = 200;
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
  woe_fit: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <Sliders size={14} className="text-blue-500" />,
  },
  woe_transform: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <RotateCcw size={14} className="text-blue-500" />,
  },
  feature_selection: {
    bg: 'bg-blue-50', border: 'border-blue-200', accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    icon: <Filter size={14} className="text-blue-500" />,
  },
  tune_train: {
    bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700',
    iconBg: 'bg-amber-100',
    icon: <Settings size={14} className="text-amber-500" />,
  },
  infer: {
    bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700',
    iconBg: 'bg-amber-100',
    icon: <Cpu size={14} className="text-amber-500" />,
  },
};

/* ─────────────── Default DAG builder ─────────────── */
function buildDefaultDag(): { nodes: DagNode[]; edges: DagEdge[] } {
  const nodes: DagNode[] = [
    { id: 'n1', type: 'data_source',       label: 'Data Source',       sublabel: 'Hive · Partition · Label',                    x: X0+GX*0, y: MID, status: 'ready'   },
    { id: 'n2', type: 'woe_fit',           label: 'WOE fit',           sublabel: 'Encoder training · Bins',                   x: X0+GX*1, y: MID, status: 'ready'   },
    { id: 'n3', type: 'woe_transform',     label: 'WOE Transform',     sublabel: 'Apply encoder · WOE features',              x: X0+GX*2, y: MID, status: 'ready'   },
    { id: 'n4', type: 'feature_selection', label: 'Feature selection', sublabel: 'IV · Corr · Selection report',              x: X0+GX*3, y: MID, status: 'ready'   },
    { id: 'n5', type: 'tune_train',        label: 'LGBM tune & train', sublabel: 'LightGBM · HPO · Train',                   x: X0+GX*4, y: MID, status: 'pending' },
    { id: 'n6', type: 'infer',             label: 'Model prediction',  sublabel: 'Batch scoring · predict_result',            x: X0+GX*5, y: MID, status: 'pending' },
  ];
  const edges: DagEdge[] = [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
  ];
  return { nodes, edges };
}

/* ─────────────── Default (current) last-run data ─────────────── */
const CURRENT_LAST_RUN: LastRunMap = {
  data_source:        { runId: 'run-20250305-0841', status: 'SUCCESS', finishedTime: '2025-03-05 08:41:22', duration: '3m 12s',  artifact: [{ label: 'Rows loaded', value: '4,821,306' }, { label: 'Feature cols', value: '218' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v12' }] },
  woe_fit:            { runId: 'run-20250305-0844', status: 'SUCCESS', finishedTime: '2025-03-05 08:49:07', duration: '4m 45s',  artifact: [{ label: 'Features in', value: '218' }, { label: 'Bins created', value: '1,940' }, { label: 'Avg IV', value: '0.132' }, { label: 'Encoder path', value: 'hdfs://woe/enc/v12.pkl' }] },
  woe_transform:      { runId: 'run-20250305-0846', status: 'SUCCESS', finishedTime: '2025-03-05 08:51:02', duration: '2m 01s',  artifact: [{ label: 'data_save_path', value: '…/{model}{run_id}/woe/transform/woe_features_merg…quet' }, { label: 'feature_report_save_path', value: '…/{model}{run_id}/reports/feature_report_…html' }, { label: 'rows out', value: '4,821,306' }, { label: 'feature_report', value: 'on' }, { label: 'report_tab', value: 'performance, trend, stability, mono' }] },
  feature_selection: { runId: 'run-20250305-0849', status: 'SUCCESS', finishedTime: '2025-03-05 08:52:31', duration: '3m 24s',  artifact: [{ label: 'Features in', value: '218' }, { label: 'Features out', value: '64' }, { label: 'IV threshold', value: '≥ 0.02' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v12' }] },
  tune_train:         { runId: 'run-20250305-0853', status: 'SUCCESS', finishedTime: '2025-03-05 09:41:18', duration: '74m 25s', artifact: [{ label: 'Best AUC', value: '0.8923' }, { label: 'Best trial', value: '#37 / 50' }, { label: 'Train AUC', value: '0.9104' }, { label: 'Model path', value: 'mlflow://models/lgbm-v12' }] },
  infer:              { runId: 'run-20250305-1011', status: 'SUCCESS', finishedTime: '2025-03-05 10:24:39', duration: '13m 37s', artifact: [{ label: 'Rows scored', value: '2,104,887' }, { label: 'Score range', value: '[0.001, 0.982]' }, { label: 'Score mean', value: '0.087' }, { label: 'Output table', value: 'hive://score.lgbm_v12_0305' }] },
};

/* ─────────────── Version history mock data ─────────────── */
const VERSION_HISTORY: VersionSnapshot[] = [
  {
    version: 'v3',
    runId: 'run-20250221-1140',
    createdAt: '2025-02-21 11:40',
    nodePatches: { n4: { sublabel: 'IV filter · v3 list' } },
    propOverrides: {
      feature_selection: [{ label: 'Selection Method', value: 'IV filter only' }, { label: 'IV Threshold', value: '≥ 0.03' }, { label: 'Corr Threshold', value: '< 0.90' }, { label: 'Output', value: 'Feature list v3' }],
      tune_train: [{ label: 'HPO Trials', value: '40' }, { label: 'CV Folds', value: '5' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '3600 s' }, { label: 'Early Stop', value: '15 rounds' }],
    },
    lastRunMap: {
      data_source: { runId: 'run-20250221-0910', status: 'SUCCESS', finishedTime: '2025-02-21 09:14:08', duration: '4m 01s', artifact: [{ label: 'Rows loaded', value: '4,613,220' }, { label: 'Feature cols', value: '218' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v11' }] },
      woe_fit: { runId: 'run-20250221-0914', status: 'SUCCESS', finishedTime: '2025-02-21 09:19:42', duration: '5m 34s', artifact: [{ label: 'Features in', value: '218' }, { label: 'Bins created', value: '1,890' }, { label: 'Avg IV', value: '0.119' }, { label: 'Encoder path', value: 'hdfs://woe/enc/v11.pkl' }] },
      woe_transform: { runId: 'run-20250221-0916', status: 'SUCCESS', finishedTime: '2025-02-21 09:22:10', duration: '2m 28s', artifact: [{ label: 'data_save_path', value: '…/woe/transform/woe_features_merg…v11' }, { label: 'feature_report_save_path', value: '…/reports/feature_report_…html' }, { label: 'rows out', value: '4,613,220' }, { label: 'feature_report', value: 'on' }, { label: 'report_tab', value: 'performance, trend, stability, mono' }] },
      feature_selection: { runId: 'run-20250221-0919', status: 'SUCCESS', finishedTime: '2025-02-21 09:23:55', duration: '4m 13s', artifact: [{ label: 'Features in', value: '218' }, { label: 'Features out', value: '71' }, { label: 'IV threshold', value: '≥ 0.03' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v11' }] },
      tune_train: { runId: 'run-20250221-0924', status: 'SUCCESS', finishedTime: '2025-02-21 10:48:11', duration: '112m 7s', artifact: [{ label: 'Best AUC', value: '0.8811' }, { label: 'Best trial', value: '#29 / 40' }, { label: 'Train AUC', value: '0.9012' }, { label: 'Model path', value: 'mlflow://models/lgbm-v11' }] },
      infer: { runId: 'run-20250221-1121', status: 'SUCCESS', finishedTime: '2025-02-21 11:35:47', duration: '14m 14s', artifact: [{ label: 'Rows scored', value: '2,087,341' }, { label: 'Score range', value: '[0.002, 0.971]' }, { label: 'Score mean', value: '0.091' }, { label: 'Output table', value: 'hive://score.lgbm_v11_0221' }] },
    },
  },
  {
    version: 'v2',
    runId: 'run-20250207-0830',
    createdAt: '2025-02-07 08:30',
    nodePatches: { n2: { sublabel: 'Monotone bins · v2' } },
    propOverrides: {
      tune_train: [{ label: 'HPO Trials', value: '30' }, { label: 'CV Folds', value: '3' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '2400 s' }, { label: 'Early Stop', value: '10 rounds' }],
      data_source: [{ label: 'Source Type', value: 'Feature Store' }, { label: 'Lookback', value: '60 days' }, { label: 'Sampling', value: '80%' }, { label: 'Partition', value: 'dt=2025-01-31' }, { label: 'Label Source', value: 'Event Log · 60d' }],
    },
    lastRunMap: {
      data_source: { runId: 'run-20250207-0600', status: 'SUCCESS', finishedTime: '2025-02-07 06:08:14', duration: '8m 14s', artifact: [{ label: 'Rows loaded', value: '8,104,992' }, { label: 'Feature cols', value: '218' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v10' }] },
      woe_fit: { runId: 'run-20250207-0608', status: 'SUCCESS', finishedTime: '2025-02-07 06:16:47', duration: '8m 33s', artifact: [{ label: 'Features in', value: '218' }, { label: 'Bins created', value: '1,832' }, { label: 'Avg IV', value: '0.108' }, { label: 'Encoder path', value: 'hdfs://woe/enc/v10.pkl' }] },
      woe_transform: { runId: 'run-20250207-0610', status: 'SUCCESS', finishedTime: '2025-02-07 06:19:12', duration: '2m 25s', artifact: [{ label: 'data_save_path', value: '…/woe/transform/woe_features_merg…v10' }, { label: 'feature_report_save_path', value: '…/reports/feature_report_…html' }, { label: 'rows out', value: '8,104,992' }, { label: 'feature_report', value: 'off' }, { label: 'report_tab', value: 'performance, mono' }] },
      feature_selection: { runId: 'run-20250207-0617', status: 'SUCCESS', finishedTime: '2025-02-07 06:22:05', duration: '5m 18s', artifact: [{ label: 'Features in', value: '218' }, { label: 'Features out', value: '58' }, { label: 'IV threshold', value: '≥ 0.02' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v10' }] },
      tune_train: { runId: 'run-20250207-0625', status: 'FAILED', finishedTime: '2025-02-07 07:39:11', duration: '74m 53s', artifact: [{ label: 'Best AUC', value: '0.8643 (partial)' }, { label: 'Completed trials', value: '22 / 30' }, { label: 'Error', value: 'OOM at trial #23' }, { label: 'Params path', value: 'mlflow://tune/run-0207' }] },
      infer: { runId: 'run-20250207-0742', status: 'SUCCESS', finishedTime: '2025-02-07 07:58:04', duration: '15m 36s', artifact: [{ label: 'Rows scored', value: '2,031,774' }, { label: 'Score range', value: '[0.003, 0.964]' }, { label: 'Score mean', value: '0.096' }, { label: 'Output table', value: 'hive://score.lgbm_v10_0207' }] },
    },
  },
  {
    version: 'v1',
    runId: 'run-20250120-1530',
    createdAt: '2025-01-20 15:30',
    nodePatches: { n5: { sublabel: 'RandomSearch · LGBM tune & train (v1)' } },
    propOverrides: {
      tune_train: [{ label: 'HPO Trials', value: '20' }, { label: 'CV Folds', value: '3' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '1800 s' }, { label: 'Early Stop', value: '10 rounds' }],
      woe_fit: [{ label: 'WOE Bins', value: '8 (fixed)' }, { label: 'Min Bin Rate', value: '3%' }, { label: 'Method', value: 'Optimal' }, { label: 'Output', value: 'Encoder .pkl' }],
    },
    lastRunMap: {
      data_source: { runId: 'run-20250120-1100', status: 'SUCCESS', finishedTime: '2025-01-20 11:09:31', duration: '9m 31s', artifact: [{ label: 'Rows loaded', value: '3,940,118' }, { label: 'Feature cols', value: '200' }, { label: 'Label col', value: 'is_default_30d' }, { label: 'Output path', value: 'hdfs://data/feat/v9' }] },
      woe_fit: { runId: 'run-20250120-1110', status: 'SUCCESS', finishedTime: '2025-01-20 11:21:07', duration: '11m 36s', artifact: [{ label: 'Features in', value: '200' }, { label: 'Bins created', value: '1,600' }, { label: 'Avg IV', value: '0.098' }, { label: 'Encoder path', value: 'hdfs://woe/enc/v9.pkl' }] },
      woe_transform: { runId: 'run-20250120-1118', status: 'SUCCESS', finishedTime: '2025-01-20 11:25:02', duration: '3m 55s', artifact: [{ label: 'data_save_path', value: '…/woe/transform/woe_features_merg…v9' }, { label: 'feature_report_save_path', value: '—' }, { label: 'rows out', value: '3,940,118' }, { label: 'feature_report', value: 'off' }, { label: 'report_tab', value: 'performance' }] },
      feature_selection: { runId: 'run-20250120-1121', status: 'SUCCESS', finishedTime: '2025-01-20 11:27:44', duration: '6m 37s', artifact: [{ label: 'Features in', value: '200' }, { label: 'Features out', value: '52' }, { label: 'IV threshold', value: '≥ 0.02' }, { label: 'Report path', value: 'hdfs://report/feat_fine_v9' }] },
      tune_train: { runId: 'run-20250120-1132', status: 'SUCCESS', finishedTime: '2025-01-20 12:42:19', duration: '70m 14s', artifact: [{ label: 'Best AUC', value: '0.8574' }, { label: 'Best trial', value: '#18 / 20' }, { label: 'Train AUC', value: '0.8801' }, { label: 'Model path', value: 'mlflow://models/lgbm-v9' }] },
      infer: { runId: 'run-20250120-1246', status: 'SKIPPED', finishedTime: '2025-01-20 13:02:38', duration: '0m 10s', artifact: [{ label: 'Rows scored', value: 'N/A' }, { label: 'Note', value: 'Inference skipped' }, { label: 'Output table', value: '—' }] },
    },
  },
];

/* ─────────────── Default config props per node type ─────────────── */
const DEFAULT_PROPS: Record<NodeType, { label: string; value: string }[]> = {
  data_source:       [{ label: 'data_source', value: 'Hive' }, { label: 'table_name', value: 'risk.feature_store_v12' }, { label: 'schema', value: 'risk' }, { label: 'partition_filter', value: "grass_date >= '2024-01-01'" }, { label: 'label_column', value: 'label_dpd30_3term' }],
  woe_fit:           [{ label: 'n_bins', value: '10' }, { label: 'min_bin_rate', value: '5%' }, { label: 'method', value: 'OptimalBinning' }, { label: 'encoder_output', value: 's3://…/encoder.pkl' }],
  woe_transform:     [{ label: 'data_path', value: 'cascade / FixedValue' }, { label: 'encoder_path', value: 'WoeFit encoder_save_path' }, { label: 'sample_scope', value: '["train"]' }, { label: 'feature_report', value: 'true' }],
  feature_selection: [{ label: 'Selection Method', value: 'IV + Corr filter' }, { label: 'IV Threshold', value: '≥ 0.02' }, { label: 'Corr Threshold', value: '< 0.85' }, { label: 'Output', value: 'selection_report.csv' }],
  tune_train:        [{ label: 'HPO Trials', value: '50' }, { label: 'CV Folds', value: '5' }, { label: 'Metric', value: 'AUC (maximize)' }, { label: 'Timeout', value: '3600 s' }, { label: 'Early Stop', value: '20 rounds' }],
  infer:             [{ label: 'Mode', value: 'Batch scoring' }, { label: 'Input', value: 'Best model artifact' }, { label: 'Output', value: 'Hive / Parquet' }, { label: 'Partition', value: 'dt=today' }],
};

/* ─────────────── Run View — Node Execution Status ─────────────── */
type NodeRunStatus = 'success' | 'running' | 'failed' | 'skipped' | 'pending';

function deriveNodeRunStatuses(instance: TaskInstance): Record<string, NodeRunStatus> {
  const { status } = instance;
  const earlyNodes = ['n1', 'n2', 'n3', 'n4'];
  const midNodes   = ['n5'];
  const lateNodes  = ['n6'];
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
    n2: to(lastRunMap.woe_fit?.status),
    n3: to(lastRunMap.woe_transform?.status),
    n4: to(lastRunMap.feature_selection?.status),
    n5: to(lastRunMap.tune_train?.status),
    n6: to(lastRunMap.infer?.status),
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
          {/* Read-only: Model level */}
          <div>
            <p className={labelCls}>Model level</p>
            <div className={readonlyCls}>
              <span className="truncate flex-1 font-mono uppercase">{task.modelLevel ?? 'sub'}</span>
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

/* ─────────────── Settings modal (experiment-level resource / queue / schedule) ─────────────── */
function SettingsModal({
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
            <h2 className="text-sm font-semibold text-slate-800">Settings</h2>
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

function FieldTooltip({ text, detach }: { text: string; detach?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (detach && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
    }
    setVisible(true);
  }, [detach]);

  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!detach || !visible) return;
    const onScrollOrResize = () => hide();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [detach, visible, hide]);

  const trigger = (
    <span
      ref={detach ? triggerRef : undefined}
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={detach ? show : undefined}
      onBlur={detach ? hide : undefined}
      tabIndex={detach ? 0 : undefined}
    >
      <HelpCircle size={12} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
    </span>
  );

  const inlineBubble = visible && !detach && (
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 bg-slate-800 text-white text-[10px] leading-relaxed px-2.5 py-1.5 rounded-lg shadow-lg z-50 pointer-events-none whitespace-normal text-center">
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </span>
  );

  const portaledBubble =
    visible &&
    detach &&
    ReactDOM.createPortal(
      <span
        role="tooltip"
        className="fixed z-[280] max-w-xs min-w-[200px] bg-slate-800 text-white text-[10px] leading-relaxed px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-normal text-left"
        style={{
          left: pos.left,
          top: pos.top - 8,
          transform: 'translate(-50%, -100%)',
        }}
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>,
      document.body,
    );

  if (detach) {
    return (
      <>
        {trigger}
        {portaledBubble}
      </>
    );
  }

  return (
    <span className="relative inline-flex items-center" onMouseEnter={show} onMouseLeave={hide}>
      <HelpCircle size={12} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
      {inlineBubble}
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

const SPLIT_SUM_TOL = 1e-6;

function roundRatio2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseRatio2(s: string): number {
  const x = parseFloat(s);
  return Number.isFinite(x) ? roundRatio2(x) : 0;
}

function validateTrainTestVal(train: string, test: string, val: string): string | null {
  const t = parseRatio2(train);
  const u = parseRatio2(test);
  const v = parseRatio2(val);
  if (Math.abs(t + u + v - 1) > SPLIT_SUM_TOL) return 'Train + test + val must sum to 1.00.';
  return null;
}

function filterRatioInput(prev: string, raw: string): string {
  if (raw === '' || raw === '.') return raw;
  return /^\d*\.?\d{0,2}$/.test(raw) ? raw : prev;
}

function NodeConfigBand({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{title}</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

type NodeResourceAdvProfile = 'global' | 'tune_train' | 'model_prediction';

function NodeResourceAdvBlock({
  readOnly,
  pipelineEnv,
  onPatchEnv,
  profile = 'global',
}: {
  readOnly?: boolean;
  pipelineEnv?: PipelineEnvRow[];
  onPatchEnv: (key: string, value: string) => void;
  profile?: NodeResourceAdvProfile;
}) {
  const [open, setOpen] = useState(false);
  const merged = React.useMemo(
    () => mergePipelineEnvWithDefaults(pipelineEnv),
    [pipelineEnv],
  );
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const inputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const rayKeys =
    profile === 'tune_train'
      ? {
          num: TUNE_TRAIN_NUM_WORKERS_ENV,
          cpu: TUNE_TRAIN_CPU_PER_WORKER_ENV,
          mem: TUNE_TRAIN_MEMORY_PER_WORKER_ENV,
        }
      : profile === 'model_prediction'
        ? {
            num: MODEL_PREDICTION_NUM_WORKERS_ENV,
            cpu: MODEL_PREDICTION_CPU_PER_WORKER_ENV,
            mem: MODEL_PREDICTION_MEMORY_PER_WORKER_ENV,
          }
        : null;

  const parsePosInt = (raw: string, fallback: number) => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : fallback;
  };

  const cpu = getPipelineEnvValue(merged, 'default_cpu');
  const mem = getPipelineEnvValue(merged, 'default_memory');
  const img = getPipelineEnvValue(merged, 'default_image');

  const numWorkers =
    rayKeys !== null ? parsePosInt(getPipelineEnvValue(merged, rayKeys.num), 15) : 15;
  const cpuPerWorker =
    rayKeys !== null ? parsePosInt(getPipelineEnvValue(merged, rayKeys.cpu), 2) : 2;
  const memPerWorkerGb =
    rayKeys !== null ? parsePosInt(getPipelineEnvValue(merged, rayKeys.mem), 2) : 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Resource configuration</span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors
          ${open ? 'border-[#13c2c2]/40 bg-[#13c2c2]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
      >
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <SlidersHorizontal size={11} />
          Adv. Conf
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 pl-0.5">
          {rayKeys === null ? (
            <>
              <div>
                <p className={labelCls}>default_cpu</p>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cpu === '' ? '' : Number(cpu)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatchEnv('default_cpu', v === '' ? '' : String(Math.max(1, parseInt(v, 10) || 0)));
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <p className={labelCls}>default_memory</p>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={mem === '' ? '' : Number(mem)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const v = e.target.value;
                    onPatchEnv('default_memory', v === '' ? '' : String(Math.max(1, parseInt(v, 10) || 0)));
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <p className={labelCls}>default_image</p>
                <input
                  type="text"
                  value={img}
                  disabled={readOnly}
                  onChange={(e) => onPatchEnv('default_image', e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={labelCls}>
                  num_workers
                  <FieldTooltip text="Integer &gt;= 1. Ray worker count for this node (tune_train_num_workers / model_prediction_num_workers)." />
                </p>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={numWorkers}
                  disabled={readOnly}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onPatchEnv(
                      rayKeys.num,
                      String(Number.isFinite(v) && v >= 1 ? Math.floor(v) : 15),
                    );
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <p className={labelCls}>
                  cpu_per_worker
                  <FieldTooltip text="Integer &gt;= 1. CPU cores per worker." />
                </p>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={cpuPerWorker}
                  disabled={readOnly}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onPatchEnv(
                      rayKeys.cpu,
                      String(Number.isFinite(v) && v >= 1 ? Math.floor(v) : 2),
                    );
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <p className={labelCls}>
                  memory_per_worker
                  <FieldTooltip text="Integer &gt;= 1. Memory per worker in GB." />
                </p>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={memPerWorkerGb}
                  disabled={readOnly}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onPatchEnv(
                      rayKeys.mem,
                      String(Number.isFinite(v) && v >= 1 ? Math.floor(v) : 2),
                    );
                  }}
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SampleTypeColumnSection({
  mode, onModeChange,
  colValue, onColChange, colOptions, colsDisabled,
  trainRatio, testRatio, valRatio,
  onTrainRatio, onTestRatio, onValRatio,
  randomSeed, onRandomSeedChange,
  readOnly,
}: {
  mode: 'use_existing' | 'auto_generate';
  onModeChange: (m: 'use_existing' | 'auto_generate') => void;
  colValue: string;
  onColChange: (v: string) => void;
  colOptions: string[];
  colsDisabled?: boolean;
  trainRatio: string;
  testRatio: string;
  valRatio: string;
  onTrainRatio: (v: string) => void;
  onTestRatio: (v: string) => void;
  onValRatio: (v: string) => void;
  randomSeed: string;
  onRandomSeedChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const splitErr = validateTrainTestVal(trainRatio, testRatio, valRatio);
  const ratioInputCls = `w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono tabular-nums
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  return (
    <div className="flex flex-col gap-2.5">
      <p className={labelCls}>
        sample_type_column
        <FieldTooltip text="ENV key sample_type_column: column with train/test/val/all. Use Existing picks a column; Auto Generate applies split_ratio + random_seed at runtime." />
      </p>
      <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        {(['use_existing', 'auto_generate'] as const).map(m => (
          <button
            key={m}
            type="button"
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
              Downstream uses <span className="font-mono text-slate-500">{colValue}</span> (train / test / val / all).
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">split_ratio (train / test / val)</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] text-slate-400 mb-0.5">train</p>
              <input
                type="text"
                inputMode="decimal"
                value={trainRatio}
                disabled={readOnly}
                onChange={e => onTrainRatio(filterRatioInput(trainRatio, e.target.value))}
                onBlur={() => onTrainRatio(String(roundRatio2(parseRatio2(trainRatio))))}
                className={ratioInputCls}
              />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 mb-0.5">test</p>
              <input
                type="text"
                inputMode="decimal"
                value={testRatio}
                disabled={readOnly}
                onChange={e => onTestRatio(filterRatioInput(testRatio, e.target.value))}
                onBlur={() => onTestRatio(String(roundRatio2(parseRatio2(testRatio))))}
                className={ratioInputCls}
              />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 mb-0.5">val</p>
              <input
                type="text"
                inputMode="decimal"
                value={valRatio}
                disabled={readOnly}
                onChange={e => onValRatio(filterRatioInput(valRatio, e.target.value))}
                onBlur={() => onValRatio(String(roundRatio2(parseRatio2(valRatio))))}
                className={ratioInputCls}
              />
            </div>
          </div>
          {splitErr && <p className="text-[10px] text-rose-600">{splitErr}</p>}
          <div>
            <p className={labelCls}>random_seed</p>
            <input
              type="number"
              value={randomSeed}
              disabled={readOnly}
              onChange={e => onRandomSeedChange(e.target.value)}
              className={ratioInputCls}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── WOE Fit Config Panel ─────────────── */
type AlgoDictKey =
  | 'dict_nbins'
  | 'dict_missing_values'
  | 'dict_min_bin_rate'
  | 'dict_min_bin_size'
  | 'dict_min_missing_bad_cnt';

const ALGO_DICT_META: Record<AlgoDictKey, { label: string; doc: string; example: string }> = {
  dict_nbins: {
    label: 'dict_nbins',
    doc: 'Per-feature bin counts; overrides global n_bins for listed features only.',
    example: '{"user_phone_update_change_cnt_180d": 4, "user_phone_update_unbind_cnt_180d": 6}',
  },
  dict_missing_values: {
    label: 'dict_missing_values',
    doc: 'Per-feature missing-value lists (override global missing list for specific features).',
    example: '{"user_is_phone_verified": [-9999, -9998], "user_email_service": ["UNKNOWN"]}',
  },
  dict_min_bin_rate: {
    label: 'dict_min_bin_rate',
    doc: 'Per-feature minimum bin rate (fraction of samples).',
    example: '{"feature_a": 0.03, "feature_b": 0.05}',
  },
  dict_min_bin_size: {
    label: 'dict_min_bin_size',
    doc: 'Per-feature minimum samples per bin.',
    example: '{"feature_a": 80, "feature_b": 120}',
  },
  dict_min_missing_bad_cnt: {
    label: 'dict_min_missing_bad_cnt',
    doc: 'Per-feature minimum bad count in the missing bin before merge.',
    example: '{"feature_a": 25, "feature_b": 40}',
  },
};

const SAMPLE_WOE_MODIFICATIONS = `[
  {
    "bin_name": "01.(-0.15, 0.05]",
    "woe_value": -0.214,
    "reason": "Business adjustment"
  }
]`;

const SAMPLE_WOE_BOUNDARIES = '[-inf, -0.15, 0.05, 0.20, inf]';

type WoeUpdateMethod = 'set_woe' | 'update' | 'update_by_cutoff';

interface WoeUpdateEntry {
  id: string;
  featureName: string;
  method: WoeUpdateMethod;
  payload: string;
}

function newWoeUpdateId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `wu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function woeFitEnvOrGlobal(merged: PipelineEnvRow[], nodeKey: string, globalKey: string): string {
  const v = getPipelineEnvValue(merged, nodeKey).trim();
  if (v !== '') return v;
  return getPipelineEnvValue(merged, globalKey);
}

/** LGBM tune data_config: empty, whitespace-only, or legacy `[]` means inherit global Pipeline ENV. */
function tuneTrainEnvOrGlobal(merged: PipelineEnvRow[], nodeKey: string, globalKey: string): string {
  const raw = getPipelineEnvValue(merged, nodeKey);
  const v = raw.trim();
  if (v !== '' && v !== '[]') return raw;
  return getPipelineEnvValue(merged, globalKey);
}

function parseWoeFitNBins(merged: PipelineEnvRow[]): 5 | 10 | 15 {
  const n = Number.parseInt(getPipelineEnvValue(merged, WOE_FIT_N_BINS_ENV), 10);
  return [5, 10, 15].includes(n) ? (n as 5 | 10 | 15) : 10;
}

function parseWoeUpdatesFromEnv(raw: string): WoeUpdateEntry[] {
  try {
    const a = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(a)) return [];
    const out: WoeUpdateEntry[] = [];
    for (const row of a) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === 'string' && r.id ? r.id : newWoeUpdateId();
      const featureName = typeof r.featureName === 'string' ? r.featureName : '';
      const method =
        r.method === 'set_woe' || r.method === 'update' || r.method === 'update_by_cutoff'
          ? r.method
          : 'set_woe';
      const payload = typeof r.payload === 'string' ? r.payload : '';
      if (featureName) out.push({ id, featureName, method, payload });
    }
    return out;
  } catch {
    return [];
  }
}

function stringifyWoeUpdatesForEnv(rows: WoeUpdateEntry[]): string {
  return JSON.stringify(
    rows.map(({ id, featureName, method, payload }) => ({ id, featureName, method, payload })),
  );
}

function woeFitDictEnvValue(merged: PipelineEnvRow[], key: string): string | null {
  const v = getPipelineEnvValue(merged, key).trim();
  return v === '' ? null : v;
}

function AlgoDictFieldRow({
  dictKey,
  value,
  onChange,
  readOnly,
  labelCls,
}: {
  dictKey: AlgoDictKey;
  value: string | null;
  onChange: (v: string | null) => void;
  readOnly?: boolean;
  labelCls: string;
}) {
  const meta = ALGO_DICT_META[dictKey];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const openAdd = () => {
    setDraft('');
    setOpen(true);
  };
  const openEdit = () => {
    setDraft(value ?? '');
    setOpen(true);
  };
  const save = () => {
    const t = draft.trim();
    if (!t) onChange(null);
    else onChange(t);
    setOpen(false);
  };

  const modal = open && ReactDOM.createPortal(
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close" />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-800 font-mono">{meta.label}</span>
          <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-2 text-xs text-slate-600">
          <p className="leading-relaxed">{meta.doc}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Example</p>
          <pre className="text-[10px] font-mono bg-slate-900 text-emerald-300 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
            {meta.example}
          </pre>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">JSON value</label>
          <textarea
            value={draft}
            readOnly={readOnly}
            onChange={e => setDraft(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-700 resize-y min-h-[120px]
              focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
              disabled:bg-slate-50"
            placeholder="{ }"
          />
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={save}
              className="h-8 px-3.5 rounded-lg bg-[#13c2c2] text-white text-xs font-semibold hover:bg-[#10a3a3]"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <div className="flex items-center gap-2 min-h-[48px] px-2 py-1.5 rounded-lg border border-slate-100 bg-white hover:border-slate-200 transition-colors">
      <p className={`${labelCls} mb-0 shrink-0 max-w-[42%]`}>
        {meta.label}
        <FieldTooltip text={meta.doc} />
      </p>
      <div className="flex-1 min-w-0" />
      <div className="flex items-center gap-1 shrink-0">
        {value ? (
          <>
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700"
              title={value}
            >
              <CheckCircle2 size={11} strokeWidth={2.2} className="shrink-0" aria-hidden />
              <span className="text-[9px] font-semibold uppercase tracking-wide">OK</span>
            </span>
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={openEdit}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13c2c2]/40 hover:text-[#0d9e9e] hover:bg-[#13c2c2]/5 transition-colors"
                  title="Edit JSON"
                  aria-label={`Edit ${meta.label}`}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 transition-colors"
                  title="Remove override"
                  aria-label={`Delete ${meta.label}`}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </>
        ) : (
          !readOnly && (
            <button
              type="button"
              onClick={openAdd}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[#13c2c2]/50 hover:text-[#13c2c2] hover:bg-[#13c2c2]/5 transition-colors"
              title="Add JSON override"
              aria-label={`Add ${meta.label}`}
            >
              <Plus size={14} />
            </button>
          )
        )}
      </div>
      {modal}
    </div>
  );
}

const WOE_FIT_FIXED_VALUE_LABEL = 'FixedValue';

type SampleScopeOpt = 'train' | 'test' | 'val' | 'all';
const SAMPLE_SCOPE_OPTIONS: SampleScopeOpt[] = ['train', 'test', 'val', 'all'];

function parseSampleScopeJson(raw: string): SampleScopeOpt[] {
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return ['train'];
    const allowed = new Set<string>(SAMPLE_SCOPE_OPTIONS);
    const ok = a.filter((x): x is SampleScopeOpt => typeof x === 'string' && allowed.has(x));
    return ok.length ? ok : ['train'];
  } catch {
    return ['train'];
  }
}

function stringifySampleScopeJson(scopes: SampleScopeOpt[]): string {
  return JSON.stringify(scopes);
}

function parseModelPredictionSampleScopeJson(raw: string): SampleScopeOpt[] {
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return ['test'];
    const allowed = new Set<string>(SAMPLE_SCOPE_OPTIONS);
    const ok = a.filter((x): x is SampleScopeOpt => typeof x === 'string' && allowed.has(x));
    return ok.length ? ok : ['test'];
  } catch {
    return ['test'];
  }
}

type ReportTabOpt = 'performance' | 'trend' | 'stability' | 'mono';
const REPORT_TAB_OPTIONS: ReportTabOpt[] = ['performance', 'trend', 'stability', 'mono'];

function parseReportTabsJson(raw: string): ReportTabOpt[] {
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [...REPORT_TAB_OPTIONS];
    const allowed = new Set<string>(REPORT_TAB_OPTIONS);
    const ok = a.filter((x): x is ReportTabOpt => typeof x === 'string' && allowed.has(x));
    return ok.length ? ok : [...REPORT_TAB_OPTIONS];
  } catch {
    return [...REPORT_TAB_OPTIONS];
  }
}

function stringifyReportTabsJson(tabs: ReportTabOpt[]): string {
  return JSON.stringify(tabs);
}

function SampleScopeMultiSelect({
  value,
  readOnly,
  onChange,
  labelCls,
  tooltip,
}: {
  value: SampleScopeOpt[];
  readOnly?: boolean;
  onChange: (next: SampleScopeOpt[]) => void;
  labelCls: string;
  tooltip: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (o: SampleScopeOpt) => {
    if (readOnly) return;
    const has = value.includes(o);
    if (has && value.length <= 1) return;
    onChange(has ? value.filter((x) => x !== o) : [...value, o]);
  };

  return (
    <div ref={rootRef} className="relative">
      <p className={labelCls}>
        sample_scope
        <FieldTooltip text={tooltip} />
      </p>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setOpen((v) => !v)}
        className={`w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between
          text-xs transition-colors font-mono text-[10px]
          focus:outline-none focus:border-[#13c2c2]/60
          disabled:bg-slate-50 disabled:cursor-not-allowed
          ${open ? 'border-[#13c2c2]/60 ring-1 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
      >
        <span className="truncate text-left text-slate-700">{value.join(', ')}</span>
        <ChevronDown size={11} className={`shrink-0 text-slate-400 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {SAMPLE_SCOPE_OPTIONS.map((o) => {
            const checked = value.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all
                  ${checked ? 'bg-[#13c2c2] border-[#13c2c2]' : 'border-slate-300 bg-white'}`}
                >
                  {checked && <CheckIcon size={9} strokeWidth={3} className="text-white" />}
                </div>
                <span className="text-[11px] font-mono text-slate-700">{o}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportTabsMultiSelect({
  value,
  readOnly,
  onChange,
  labelCls,
  tooltip,
}: {
  value: ReportTabOpt[];
  readOnly?: boolean;
  onChange: (next: ReportTabOpt[]) => void;
  labelCls: string;
  tooltip: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (o: ReportTabOpt) => {
    if (readOnly) return;
    const has = value.includes(o);
    if (has && value.length <= 1) return;
    onChange(has ? value.filter((x) => x !== o) : [...value, o]);
  };

  return (
    <div ref={rootRef} className="relative">
      <p className={labelCls}>
        report_tab
        <FieldTooltip text={tooltip} />
      </p>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setOpen((v) => !v)}
        className={`w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between
          text-xs transition-colors font-mono text-[10px]
          focus:outline-none focus:border-[#13c2c2]/60
          disabled:bg-slate-50 disabled:cursor-not-allowed
          ${open ? 'border-[#13c2c2]/60 ring-1 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
      >
        <span className="truncate text-left text-slate-700">{value.join(', ')}</span>
        <ChevronDown size={11} className={`shrink-0 text-slate-400 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {REPORT_TAB_OPTIONS.map((o) => {
            const checked = value.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all
                  ${checked ? 'bg-[#13c2c2] border-[#13c2c2]' : 'border-slate-300 bg-white'}`}
                >
                  {checked && <CheckIcon size={9} strokeWidth={3} className="text-white" />}
                </div>
                <span className="text-[11px] font-mono text-slate-700">{o}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type WoeCascadeBindingFieldProps = {
  task: TrainingTask;
  readOnly?: boolean;
  upstreamNodes: DagNode[];
  allNodes: DagNode[];
  bindingRaw: string;
  fixedPathRaw: string;
  fixedMenuChosen: boolean;
  onFixedMenuChosen: (v: boolean) => void;
  onBindingChange: (raw: string) => void;
  onFixedPathChange: (path: string) => void;
  onClearAll: () => void;
  numInputCls: string;
  fieldName: string;
  typeBadge: 'data' | 'pkl';
  cascadeKind: WoeCascadeKind;
  cardNoUpstreamHint: string;
  portalNoUpstreamHint: string;
};

function WoeCascadeBindingField({
  task,
  readOnly,
  upstreamNodes,
  allNodes,
  bindingRaw,
  fixedPathRaw,
  fixedMenuChosen,
  onFixedMenuChosen,
  onBindingChange,
  onFixedPathChange,
  onClearAll,
  numInputCls,
  fieldName,
  typeBadge,
  cascadeKind,
  cardNoUpstreamHint,
  portalNoUpstreamHint,
}: WoeCascadeBindingFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hoverLeftId, setHoverLeftId] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const parsed = parseWoeFitBinding(bindingRaw);
  const firstUpstreamId = upstreamNodes[0]?.id;
  const isFixedMode = !parsed && (fixedPathRaw.trim() !== '' || fixedMenuChosen);

  const updateMenuBox = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 300),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updateMenuBox();
    else setMenuBox(null);
  }, [open, updateMenuBox]);

  useEffect(() => {
    if (!open) return;
    updateMenuBox();
    window.addEventListener('resize', updateMenuBox);
    document.addEventListener('scroll', updateMenuBox, true);
    return () => {
      window.removeEventListener('resize', updateMenuBox);
      document.removeEventListener('scroll', updateMenuBox, true);
    };
  }, [open, updateMenuBox]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setHoverLeftId(parsed?.nodeId ?? firstUpstreamId ?? '__fixed__');
    }
  }, [open, parsed?.nodeId, firstUpstreamId]);

  const focusLeftId = open
    ? (hoverLeftId ?? parsed?.nodeId ?? firstUpstreamId ?? '__fixed__')
    : (parsed?.nodeId ?? firstUpstreamId ?? '__fixed__');

  const sourceEcho = (() => {
    if (parsed) {
      const n = allNodes.find((x) => x.id === parsed.nodeId);
      if (!n) return formatWoeFitBinding(bindingRaw).replace(/\s*\/\s*/g, '/');
      const ports = outputPortsForCascade(n.type, cascadeKind);
      const port = ports.find((p) => p.key === parsed.portKey);
      return `${workflowStepLabel(n)}/${port?.label ?? parsed.portKey}`;
    }
    if (isFixedMode) return WOE_FIT_FIXED_VALUE_LABEL;
    return '';
  })();

  const resolvedPath =
    parsed
      ? resolveCascadePortPath(
          parsed.nodeId,
          parsed.portKey,
          allNodes,
          task,
          task.pipelineEnv,
          cascadeKind,
        )
      : '';

  const leftRows: { id: string; label: string; node?: DagNode; isFixed?: boolean }[] = [
    ...upstreamNodes.map((n) => ({ id: n.id, label: workflowStepLabel(n), node: n })),
    { id: '__fixed__', label: WOE_FIT_FIXED_VALUE_LABEL, isFixed: true },
  ];

  const rightPorts: WoeCascadePort[] = (() => {
    if (focusLeftId === '__fixed__') return [];
    const n = allNodes.find((x) => x.id === focusLeftId);
    return n ? outputPortsForCascade(n.type, cascadeKind) : [];
  })();

  const handlePickPort = (leftId: string, port: WoeCascadePort) => {
    if (readOnly || port.disabled || leftId === '__fixed__') return;
    onFixedPathChange('');
    onFixedMenuChosen(false);
    onBindingChange(`${leftId}|${port.key}`);
    setOpen(false);
  };

  const handleLeftClick = (row: { id: string; isFixed?: boolean }) => {
    if (readOnly) return;
    setHoverLeftId(row.id);
    if (row.isFixed) {
      onBindingChange('');
      onFixedMenuChosen(true);
      setOpen(false);
    }
  };

  const showClear = !!(parsed || fixedPathRaw.trim() || fixedMenuChosen);
  const noUpstream = upstreamNodes.length === 0;

  const cascadeMenu =
    open &&
    menuBox &&
    ReactDOM.createPortal(
      <div
        ref={menuRef}
        className="fixed z-[220] flex rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden min-h-[180px] max-h-[min(320px,70vh)]"
        style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="w-[46%] min-w-[148px] border-r border-slate-200 overflow-y-auto py-1">
          {noUpstream && (
            <div className="px-2.5 py-2 border-b border-slate-100">
              <p className="text-[10px] text-slate-500 leading-snug">{portalNoUpstreamHint}</p>
            </div>
          )}
          {leftRows.map((row) => {
            const active = focusLeftId === row.id;
            const portsForRow = row.node ? outputPortsForCascade(row.node.type, cascadeKind) : [];
            const hasChildren = portsForRow.some((p) => !p.disabled);
            return (
              <button
                key={row.id}
                type="button"
                disabled={readOnly}
                onMouseEnter={() => setHoverLeftId(row.id)}
                onFocus={() => setHoverLeftId(row.id)}
                onClick={() => handleLeftClick(row)}
                className={`w-full flex items-center justify-between gap-1 px-2.5 py-2 text-left text-[11px] transition-colors
                  ${active ? 'bg-sky-50 text-sky-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'}
                  disabled:opacity-50`}
              >
                <span className="truncate">{row.label}</span>
                {hasChildren && <ChevronRight size={12} className="shrink-0 text-slate-400" />}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-[140px] overflow-y-auto py-1 bg-slate-50/40">
          {rightPorts.length === 0 && focusLeftId === '__fixed__' ? (
            <p className="px-2.5 py-2 text-[10px] text-slate-400">Path below</p>
          ) : rightPorts.length === 0 && focusLeftId !== '__fixed__' ? (
            <p className="px-2.5 py-3 text-[10px] text-slate-400 leading-relaxed">
              {cascadeKind === 'transform_encoder'
                ? 'Select upstream WOE Fit for encoder .pkl — pick encoder_save_path on the right when a WoeFit node is selected on the left.'
                : 'No outputs available for this node.'}
            </p>
          ) : (
            rightPorts.map((port) => {
              const sel =
                parsed &&
                parsed.nodeId === focusLeftId &&
                parsed.portKey === port.key &&
                !port.disabled;
              return (
                <button
                  key={port.key}
                  type="button"
                  disabled={readOnly || !!port.disabled}
                  onClick={() => handlePickPort(focusLeftId, port)}
                  className={`w-full text-left px-2.5 py-2 text-[11px] transition-colors
                    ${port.disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-white'}
                    ${sel ? 'bg-sky-50 text-sky-900 font-semibold' : ''}`}
                >
                  {port.label}{' '}
                  <span className="text-slate-400 font-normal">({port.typeLabel})</span>
                </button>
              );
            })
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 bg-slate-100/90 border-b border-slate-200 px-2.5 py-1.5">
        <span className="text-[10px] font-bold text-slate-700">
          Field: <span className="font-semibold">{fieldName}</span>
        </span>
        <span className="text-[10px] text-slate-500">
          type: <span className="font-semibold text-slate-700">{typeBadge}</span>
        </span>
      </div>
      <div className="px-2.5 py-2.5 flex flex-col gap-2">
        {noUpstream && (
          <p className="text-[10px] text-slate-500 leading-snug border border-amber-100 bg-amber-50/80 rounded-md px-2 py-1.5">
            {cardNoUpstreamHint}
          </p>
        )}
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-semibold text-slate-600 shrink-0 pt-2">Source:</span>
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && setOpen((o) => !o)}
                className={`w-full min-h-9 pl-2.5 pr-9 py-1.5 rounded-lg border text-left text-[11px] font-mono transition-colors
                  ${open ? 'border-sky-400 bg-white ring-1 ring-sky-200' : 'border-slate-200 bg-white hover:border-slate-300'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className={`${sourceEcho ? 'text-slate-700' : 'text-slate-400'} break-all line-clamp-2`}>
                  {sourceEcho || `Select upstream node or ${WOE_FIT_FIXED_VALUE_LABEL}…`}
                </span>
              </button>
              {showClear && !readOnly && (
                <button
                  type="button"
                  title="Clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearAll();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {cascadeMenu}
            {isFixedMode && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-slate-600">FieldMapping:</span>
                <input
                  type="text"
                  value={fixedPathRaw}
                  disabled={readOnly}
                  onChange={(e) => onFixedPathChange(e.target.value)}
                  className={numInputCls}
                  placeholder='or "null"'
                />
              </div>
            )}
            {!!resolvedPath && parsed && (
              <p className="text-[9px] text-slate-400 font-mono break-all leading-relaxed px-0.5" title={resolvedPath}>
                Resolves to: {resolvedPath}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WoeFitDataPathField(
  props: Omit<
    WoeCascadeBindingFieldProps,
    'fieldName' | 'typeBadge' | 'cascadeKind' | 'cardNoUpstreamHint' | 'portalNoUpstreamHint'
  >,
) {
  return (
    <WoeCascadeBindingField
      {...props}
      fieldName="data_path"
      typeBadge="data"
      cascadeKind="fit_data"
      cardNoUpstreamHint={`No upstream node linked to WOE Fit. Draw an incoming edge on the canvas to pick node outputs here, or use ${WOE_FIT_FIXED_VALUE_LABEL} for a manual S3 path.`}
      portalNoUpstreamHint={`No upstream nodes — connect WOE Fit to a node on the canvas, or choose ${WOE_FIT_FIXED_VALUE_LABEL}.`}
    />
  );
}

function WoeFitConfigPanel({ task, onPatchPipelineEnvRow, readOnly, woeFitDagContext }: NodePanelEnvProps) {
  const mergedEnv = React.useMemo(() => mergePipelineEnvWithDefaults(task.pipelineEnv), [task.pipelineEnv]);
  const bindingRaw = React.useMemo(
    () => getPipelineEnvValue(mergedEnv, WOE_FIT_INPUT_BINDING_ENV),
    [mergedEnv],
  );
  const fixedPathRaw = React.useMemo(
    () => getPipelineEnvValue(mergedEnv, WOE_FIT_FIXED_DATA_PATH_ENV),
    [mergedEnv],
  );
  const upstreamDataPath = React.useMemo(
    () => buildDataSourceFeaturesInputPath(task, task.pipelineEnv),
    [task.modelName, task.pipelineEnv],
  );

  const [dataConfigOpen, setDataConfigOpen] = useState(false);
  const [fixedMenuChosen, setFixedMenuChosen] = useState(false);

  const [woeModal, setWoeModal] = useState<{ editId?: string } | null>(null);
  const [woeModalFeature, setWoeModalFeature] = useState('');
  const [woeModalMethod, setWoeModalMethod] = useState<WoeUpdateMethod>('set_woe');
  const [woeModalText, setWoeModalText] = useState(SAMPLE_WOE_MODIFICATIONS);
  const [woeModalCutoff, setWoeModalCutoff] = useState('0.15');
  const [woeModalError, setWoeModalError] = useState('');

  const nBins = React.useMemo(() => parseWoeFitNBins(mergedEnv), [mergedEnv]);
  const method = React.useMemo((): 'best_ks' | 'quantile' => {
    const m = getPipelineEnvValue(mergedEnv, WOE_FIT_METHOD_ENV);
    return m === 'quantile' ? 'quantile' : 'best_ks';
  }, [mergedEnv]);
  const minBinRate = React.useMemo(() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedEnv, WOE_FIT_MIN_BIN_RATE_ENV));
    return Number.isFinite(n) ? n : 0.02;
  }, [mergedEnv]);
  const minBinSize = React.useMemo(() => {
    const n = Number.parseInt(getPipelineEnvValue(mergedEnv, WOE_FIT_MIN_BIN_SIZE_ENV), 10);
    return Number.isFinite(n) && n >= 1 ? n : 50;
  }, [mergedEnv]);
  const minMissingBadCnt = React.useMemo(() => {
    const n = Number.parseInt(getPipelineEnvValue(mergedEnv, WOE_FIT_MIN_MISSING_BAD_CNT_ENV), 10);
    return Number.isFinite(n) && n >= 0 ? n : 30;
  }, [mergedEnv]);

  const woeUpdates = React.useMemo(
    () => parseWoeUpdatesFromEnv(getPipelineEnvValue(mergedEnv, WOE_FIT_WOE_UPDATES_JSON_ENV)),
    [mergedEnv],
  );
  const woeUpdateEnabled =
    getPipelineEnvValue(mergedEnv, WOE_FIT_WOE_UPDATE_ENABLED_ENV).toLowerCase() === 'true';
  const checkpointAfterNode =
    getPipelineEnvValue(mergedEnv, WOE_FIT_CHECKPOINT_AFTER_NODE_ENV).toLowerCase() !== 'false';

  useEffect(() => {
    if (!bindingRaw.trim() && fixedPathRaw.trim()) setFixedMenuChosen(true);
  }, [task.id, bindingRaw, fixedPathRaw]);

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;
  const selectCls = `w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-mono
    appearance-none cursor-pointer transition-colors text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const encoderPath = React.useMemo(
    () => buildWoeEncoderSavePathDisplay(task, parseWoeFitNBins(mergedEnv), task.pipelineEnv),
    [task, mergedEnv, task.pipelineEnv],
  );

  const woeFeatureOptions = React.useMemo(() => MOCK_HIVE_COLUMNS.slice(0, 24), []);

  const openWoeModalAdd = () => {
    setWoeModal({ editId: undefined });
    setWoeModalFeature(woeFeatureOptions[0] ?? '');
    setWoeModalMethod('set_woe');
    setWoeModalText(SAMPLE_WOE_MODIFICATIONS);
    setWoeModalCutoff('0.15');
    setWoeModalError('');
  };

  const openWoeModalEdit = (e: WoeUpdateEntry) => {
    setWoeModal({ editId: e.id });
    setWoeModalFeature(e.featureName);
    setWoeModalMethod(e.method);
    if (e.method === 'update_by_cutoff') setWoeModalCutoff(e.payload);
    else setWoeModalText(e.payload);
    setWoeModalError('');
  };

  const saveWoeModal = () => {
    const taken = woeUpdates.filter(u => u.id !== woeModal?.editId).some(u => u.featureName === woeModalFeature);
    if (taken) {
      setWoeModalError('This feature already has a WOE update. Remove or edit the existing one.');
      return;
    }
    let payload = '';
    if (woeModalMethod === 'update_by_cutoff') {
      if (woeModalCutoff.trim() === '' || Number.isNaN(Number(woeModalCutoff))) {
        setWoeModalError('Enter a valid number for bin cutoff.');
        return;
      }
      payload = woeModalCutoff.trim();
    } else {
      try {
        JSON.parse(woeModalText);
      } catch {
        setWoeModalError('Invalid JSON. Check boundaries or modifications array.');
        return;
      }
      payload = woeModalText;
    }
    const row: WoeUpdateEntry = {
      id: woeModal?.editId ?? newWoeUpdateId(),
      featureName: woeModalFeature,
      method: woeModalMethod,
      payload,
    };
    if (woeModal?.editId) {
      const next = woeUpdates.map(u => (u.id === woeModal.editId ? row : u));
      onPatchPipelineEnvRow(WOE_FIT_WOE_UPDATES_JSON_ENV, stringifyWoeUpdatesForEnv(next));
    } else {
      onPatchPipelineEnvRow(WOE_FIT_WOE_UPDATES_JSON_ENV, stringifyWoeUpdatesForEnv([...woeUpdates, row]));
    }
    setWoeModal(null);
    setWoeModalError('');
  };

  const copyWoeRow = (e: WoeUpdateEntry) => {
    let obj: Record<string, unknown>;
    if (e.method === 'update_by_cutoff') {
      obj = { feature_name: e.featureName, method: e.method, bin_cutoff: Number(e.payload) };
    } else if (e.method === 'update') {
      obj = { feature_name: e.featureName, method: e.method, boundaries: JSON.parse(e.payload) };
    } else {
      obj = { feature_name: e.featureName, method: e.method, modifications: JSON.parse(e.payload) };
    }
    const s = JSON.stringify(obj, null, 2);
    navigator.clipboard?.writeText(s).catch(() => {});
  };

  const deleteWoeRow = (id: string) => {
    if (woeUpdateEnabled && woeUpdates.length <= 1) return;
    onPatchPipelineEnvRow(
      WOE_FIT_WOE_UPDATES_JSON_ENV,
      stringifyWoeUpdatesForEnv(woeUpdates.filter(u => u.id !== id)),
    );
  };

  const woeModalPortal = woeModal && ReactDOM.createPortal(
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setWoeModal(null)} aria-label="Close" />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-800">
            {woeModal.editId ? 'Edit WOE update' : 'Set WOE update'}
          </span>
          <button type="button" onClick={() => setWoeModal(null)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          <div>
            <p className={labelCls}>feature_name</p>
            <div className="relative">
              <select
                value={woeModalFeature}
                disabled={readOnly || !!woeModal.editId}
                onChange={e => setWoeModalFeature(e.target.value)}
                className={selectCls}
              >
                {woeFeatureOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <p className={labelCls}>
              method
              <FieldTooltip text="set_woe: override WOE for named bins. update: replace boundaries (-inf/inf required). update_by_cutoff: insert one split point." />
            </p>
            <div className="relative">
              <select
                value={woeModalMethod}
                disabled={readOnly}
                onChange={e => {
                  const m = e.target.value as WoeUpdateMethod;
                  setWoeModalMethod(m);
                  if (m === 'set_woe') setWoeModalText(SAMPLE_WOE_MODIFICATIONS);
                  else if (m === 'update') setWoeModalText(SAMPLE_WOE_BOUNDARIES);
                }}
                className={selectCls}
              >
                <option value="set_woe">set_woe</option>
                <option value="update">update</option>
                <option value="update_by_cutoff">update_by_cutoff</option>
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <p className="mt-1 text-[9px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-500">set_woe</span>
              {' — manual WOE per bin. '}
              <span className="font-semibold text-slate-500">update</span>
              {' — new boundaries. '}
              <span className="font-semibold text-slate-500">update_by_cutoff</span>
              {' — insert cutoff.'}
            </p>
          </div>
          {woeModalMethod === 'update_by_cutoff' ? (
            <div>
              <p className={labelCls}>bin_cutoff</p>
              <input
                type="number"
                step="any"
                value={woeModalCutoff}
                disabled={readOnly}
                onChange={e => setWoeModalCutoff(e.target.value)}
                className={numInputCls}
              />
            </div>
          ) : (
            <div>
              <p className={labelCls}>
                {woeModalMethod === 'set_woe' ? 'modifications' : 'boundaries'}
                <FieldTooltip
                  text={
                    woeModalMethod === 'set_woe'
                      ? 'JSON array of bin_name, woe_value, reason.'
                      : 'JSON array of boundaries; first must be -inf, last inf, strictly increasing.'
                  }
                />
              </p>
              <textarea
                value={woeModalText}
                readOnly={readOnly}
                onChange={e => setWoeModalText(e.target.value)}
                rows={10}
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-700 resize-y min-h-[160px]
                  focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20"
              />
            </div>
          )}
          {woeModalError && <p className="text-[10px] text-rose-600">{woeModalError}</p>}
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={() => setWoeModal(null)} className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          {!readOnly && (
            <button type="button" onClick={saveWoeModal} className="h-8 px-3.5 rounded-lg bg-[#13c2c2] text-white text-xs font-semibold hover:bg-[#10a3a3]">
              Save
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      <NodeConfigBand title="Input data path">
        <div className="flex flex-col gap-2">
          {woeFitDagContext ? (
            <div>
              <WoeFitDataPathField
                task={task}
                readOnly={readOnly}
                upstreamNodes={getUpstreamNodesForTarget(
                  woeFitDagContext.edges,
                  woeFitDagContext.nodes,
                  woeFitDagContext.woeFitNodeId,
                )}
                allNodes={woeFitDagContext.nodes}
                bindingRaw={bindingRaw}
                fixedPathRaw={fixedPathRaw}
                fixedMenuChosen={fixedMenuChosen}
                onFixedMenuChosen={setFixedMenuChosen}
                onBindingChange={(raw) => {
                  onPatchPipelineEnvRow(WOE_FIT_INPUT_BINDING_ENV, raw);
                  if (raw.trim()) {
                    onPatchPipelineEnvRow(WOE_FIT_FIXED_DATA_PATH_ENV, '');
                    setFixedMenuChosen(false);
                  }
                }}
                onFixedPathChange={(path) => {
                  onPatchPipelineEnvRow(WOE_FIT_FIXED_DATA_PATH_ENV, path);
                  if (path.trim()) onPatchPipelineEnvRow(WOE_FIT_INPUT_BINDING_ENV, '');
                }}
                onClearAll={() => {
                  onPatchPipelineEnvRow(WOE_FIT_INPUT_BINDING_ENV, '');
                  onPatchPipelineEnvRow(WOE_FIT_FIXED_DATA_PATH_ENV, '');
                  setFixedMenuChosen(false);
                }}
                numInputCls={numInputCls}
              />
            </div>
          ) : (
            <div>
              <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
                <Database size={10} className="shrink-0 text-slate-300 mt-0.5" />
                <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{upstreamDataPath}</span>
              </div>
            </div>
          )}
        </div>
      </NodeConfigBand>

      <NodeConfigBand title="Node configuration">
        <div className="flex flex-col gap-3">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setDataConfigOpen(o => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors text-left
                ${dataConfigOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
            >
              <span className="text-[10px] font-semibold text-slate-600">
                data_config
                <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                  Editable per node; clear a field to inherit the matching global ENV param.
                </span>
              </span>
              <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${dataConfigOpen ? 'rotate-180' : ''}`} />
            </button>
            {dataConfigOpen && (
              <div className="border-t border-slate-100 px-3 py-2.5 flex flex-col gap-2 bg-white">
                <SampleScopeMultiSelect
                  value={parseSampleScopeJson(getPipelineEnvValue(mergedEnv, WOE_FIT_SAMPLE_SCOPE_ENV))}
                  readOnly={readOnly}
                  onChange={(next) => onPatchPipelineEnvRow(WOE_FIT_SAMPLE_SCOPE_ENV, stringifySampleScopeJson(next))}
                  labelCls={labelCls}
                  tooltip="Multi-scope row filter: train, test, val, and/or all. At least one scope must stay selected. Stored as woe_fit_sample_scope (JSON array)."
                />
                <div>
                  <p className={labelCls}>
                    label
                    <FieldTooltip text="Overrides Pipeline ENV label_column when non-empty; clear to inherit global." />
                  </p>
                  <input
                    type="text"
                    value={woeFitEnvOrGlobal(mergedEnv, WOE_FIT_LABEL_COLUMN_ENV, 'label_column')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_LABEL_COLUMN_ENV, e.target.value)}
                    className={numInputCls}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    categorical_features
                    <FieldTooltip text="JSON array override; empty inherits categorical_columns." />
                  </p>
                  <textarea
                    value={woeFitEnvOrGlobal(mergedEnv, WOE_FIT_CATEGORICAL_FEATURES_ENV, 'categorical_columns')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_CATEGORICAL_FEATURES_ENV, e.target.value)}
                    rows={4}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[72px] resize-y py-1.5`}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    woe_missing_values
                    <FieldTooltip text="JSON override; empty inherits woe_missing_value." />
                  </p>
                  <textarea
                    value={woeFitEnvOrGlobal(mergedEnv, WOE_FIT_WOE_MISSING_VALUES_ENV, 'woe_missing_value')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_WOE_MISSING_VALUES_ENV, e.target.value)}
                    rows={3}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[60px] resize-y py-1.5`}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    woe_missing_logic
                    <FieldTooltip text="Override; empty inherits woe_missing_logic (e.g. null)." />
                  </p>
                  <input
                    type="text"
                    value={woeFitEnvOrGlobal(mergedEnv, WOE_FIT_WOE_MISSING_LOGIC_ENV, 'woe_missing_logic')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_WOE_MISSING_LOGIC_ENV, e.target.value)}
                    className={numInputCls}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    exclude_columns
                    <FieldTooltip text="JSON array override; empty inherits exclude_columns." />
                  </p>
                  <textarea
                    value={woeFitEnvOrGlobal(mergedEnv, WOE_FIT_EXCLUDE_COLUMNS_ENV, 'exclude_columns')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_EXCLUDE_COLUMNS_ENV, e.target.value)}
                    rows={5}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[88px] resize-y py-1.5`}
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">algorithm_config</p>

          <div>
            <p className={labelCls}>
              n_bins
              <FieldTooltip text="Global number of bins; can be overridden per feature via dict_nbins." />
            </p>
            <div className="flex gap-1.5">
              {([5, 10, 15] as const).map(b => (
                <button
                  key={b}
                  type="button"
                  disabled={readOnly}
                  onClick={() => !readOnly && onPatchPipelineEnvRow(WOE_FIT_N_BINS_ENV, String(b))}
                  className={`flex-1 h-7 rounded-md border text-xs font-semibold transition-all
                    ${nBins === b ? 'border-[#13c2c2]/60 bg-[#13c2c2]/8 text-[#0d9e9e]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={labelCls}>
              method
              <FieldTooltip text="Binning strategy: best_ks (optimal KS cut) or quantile (equal frequency)." />
            </p>
            <div className="relative">
              <select
                value={method}
                disabled={readOnly}
                onChange={(e) =>
                  onPatchPipelineEnvRow(WOE_FIT_METHOD_ENV, e.target.value as 'best_ks' | 'quantile')
                }
                className={selectCls}
              >
                <option value="best_ks">best_ks</option>
                <option value="quantile">quantile</option>
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <p className={labelCls}>
              min_bin_rate
              <FieldTooltip text="Minimum fraction of samples per bin." />
            </p>
            <input
              type="number"
              min={0}
              step={0.01}
              value={minBinRate}
              disabled={readOnly}
              onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_MIN_BIN_RATE_ENV, String(Number(e.target.value)))}
              className={numInputCls}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <p className={labelCls}>
                min_bin_size
                <FieldTooltip text="Minimum sample count per bin." />
              </p>
              <input
                type="number"
                min={1}
                value={minBinSize}
                disabled={readOnly}
                onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_MIN_BIN_SIZE_ENV, String(Number(e.target.value)))}
                className={numInputCls}
              />
            </div>
            <div className="flex-1">
              <p className={labelCls}>
                min_missing_bad_cnt
                <FieldTooltip text="Minimum bad count in missing bin before merging." />
              </p>
              <input
                type="number"
                min={0}
                value={minMissingBadCnt}
                disabled={readOnly}
                onChange={(e) =>
                  onPatchPipelineEnvRow(WOE_FIT_MIN_MISSING_BAD_CNT_ENV, String(Number(e.target.value)))
                }
                className={numInputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Per-feature overrides</p>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <AlgoDictFieldRow
                dictKey="dict_nbins"
                value={woeFitDictEnvValue(mergedEnv, WOE_FIT_DICT_NBINS_ENV)}
                onChange={(v) => onPatchPipelineEnvRow(WOE_FIT_DICT_NBINS_ENV, v ?? '')}
                readOnly={readOnly}
                labelCls={labelCls}
              />
              <AlgoDictFieldRow
                dictKey="dict_missing_values"
                value={woeFitDictEnvValue(mergedEnv, WOE_FIT_DICT_MISSING_VALUES_ENV)}
                onChange={(v) => onPatchPipelineEnvRow(WOE_FIT_DICT_MISSING_VALUES_ENV, v ?? '')}
                readOnly={readOnly}
                labelCls={labelCls}
              />
              <AlgoDictFieldRow
                dictKey="dict_min_bin_rate"
                value={woeFitDictEnvValue(mergedEnv, WOE_FIT_DICT_MIN_BIN_RATE_ENV)}
                onChange={(v) => onPatchPipelineEnvRow(WOE_FIT_DICT_MIN_BIN_RATE_ENV, v ?? '')}
                readOnly={readOnly}
                labelCls={labelCls}
              />
              <AlgoDictFieldRow
                dictKey="dict_min_bin_size"
                value={woeFitDictEnvValue(mergedEnv, WOE_FIT_DICT_MIN_BIN_SIZE_ENV)}
                onChange={(v) => onPatchPipelineEnvRow(WOE_FIT_DICT_MIN_BIN_SIZE_ENV, v ?? '')}
                readOnly={readOnly}
                labelCls={labelCls}
              />
              <AlgoDictFieldRow
                dictKey="dict_min_missing_bad_cnt"
                value={woeFitDictEnvValue(mergedEnv, WOE_FIT_DICT_MIN_MISSING_BAD_CNT_ENV)}
                onChange={(v) => onPatchPipelineEnvRow(WOE_FIT_DICT_MIN_MISSING_BAD_CNT_ENV, v ?? '')}
                readOnly={readOnly}
                labelCls={labelCls}
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
            <button
              type="button"
              disabled={readOnly}
              onClick={() =>
                !readOnly &&
                onPatchPipelineEnvRow(WOE_FIT_WOE_UPDATE_ENABLED_ENV, woeUpdateEnabled ? 'false' : 'true')
              }
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors
                ${woeUpdateEnabled ? 'bg-[#13c2c2]/5' : 'bg-white hover:bg-slate-50'}
                disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                <SlidersHorizontal size={11} />
                woe_update
                <FieldTooltip
                  detach
                  text="Post-fit overrides: woe_encoder_path (input .pkl) plus per-feature rows — set WOE, replace boundaries, or insert cutoff. Output writes to encoder_save_path."
                />
              </span>
              <div className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${woeUpdateEnabled ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${woeUpdateEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
              </div>
            </button>
            {woeUpdateEnabled && (
              <div className="border-t border-slate-100 px-3 py-2.5 flex flex-col gap-2 bg-white">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className={`${labelCls} mb-0`}>
                      woe_encoder_path
                      <FieldTooltip
                        text={
                          'Input encoder .pkl for the update step. Empty field shows this node’s encoder_save_path; edit to point at another run (e.g. change {run_id}), then apply feature updates — result is written to encoder_save_path for this run.'
                        }
                      />
                    </p>
                    {!readOnly && getPipelineEnvValue(mergedEnv, WOE_FIT_WOE_ENCODER_PATH_ENV).trim() !== '' && (
                      <button
                        type="button"
                        title="Clear override; show default encoder_save_path"
                        onClick={() => onPatchPipelineEnvRow(WOE_FIT_WOE_ENCODER_PATH_ENV, '')}
                        className="shrink-0 h-7 px-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-[9px] font-semibold text-slate-400 hover:text-[#13c2c2] hover:border-[#13c2c2]/40 hover:bg-[#13c2c2]/5 transition-all"
                      >
                        <RotateCcw size={9} className="shrink-0" />
                        Reset
                      </button>
                    )}
                  </div>
                  <textarea
                    value={(() => {
                      const s = getPipelineEnvValue(mergedEnv, WOE_FIT_WOE_ENCODER_PATH_ENV);
                      return s.trim() !== '' ? s : encoderPath;
                    })()}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(WOE_FIT_WOE_ENCODER_PATH_ENV, e.target.value)}
                    rows={4}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[72px] resize-y py-1.5 text-[10px] leading-relaxed`}
                  />
                </div>
                {woeUpdates.length === 0 && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                    Add at least one feature update when this section is enabled.
                  </p>
                )}
                {woeUpdates.map(entry => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center gap-2 min-h-[48px] rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5"
                  >
                    <span className="text-[10px] font-mono font-semibold text-slate-700">{entry.featureName}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#13c2c2]/15 text-[#0d9e9e] font-mono font-semibold">
                      {entry.method}
                    </span>
                    <div className="flex-1 min-w-2" />
                    {!readOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openWoeModalEdit(entry)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13c2c2]/40 hover:text-[#0d9e9e] hover:bg-[#13c2c2]/5 transition-colors"
                          title="Edit"
                          aria-label={`Edit WOE update for ${entry.featureName}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => copyWoeRow(entry)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13c2c2]/40 hover:text-[#0d9e9e] hover:bg-[#13c2c2]/5 transition-colors"
                          title="Copy JSON"
                          aria-label={`Copy WOE update for ${entry.featureName}`}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={woeUpdateEnabled && woeUpdates.length <= 1}
                          onClick={() => deleteWoeRow(entry.id)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Delete"
                          aria-label={`Delete WOE update for ${entry.featureName}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={openWoeModalAdd}
                    className="w-full min-h-[48px] flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[#13c2c2]/50 hover:text-[#13c2c2] hover:bg-[#13c2c2]/5 transition-colors"
                    title="Add WOE update"
                    aria-label="Add WOE update"
                  >
                    <Plus size={14} />
                    <span className="sr-only">Add WOE update</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </NodeConfigBand>

      <NodeResourceAdvBlock readOnly={readOnly} pipelineEnv={task.pipelineEnv} onPatchEnv={onPatchPipelineEnvRow} />

      <NodeConfigBand title="Output path">
        <CopyPathField label="encoder_save_path" path={encoderPath} labelCls={labelCls} />
      </NodeConfigBand>

      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/80 border-l-4 border-l-[#13c2c2]/40 bg-gradient-to-r from-[#13c2c2]/[0.07] to-white"
      >
        <div className="min-w-0 flex-1">
          <p className={`${labelCls} mb-0`}>
            Node checkpoint
            <FieldTooltip text="When enabled, the run pauses in Checking after this node completes until you confirm artifacts and choose Continue." />
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
            Cached checkpoint lets you resume or re-run from this node without redoing upstream work.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() =>
            !readOnly &&
            onPatchPipelineEnvRow(WOE_FIT_CHECKPOINT_AFTER_NODE_ENV, checkpointAfterNode ? 'false' : 'true')
          }
          className={`w-8 h-[18px] rounded-full transition-colors flex items-center px-0.5 shrink-0 ${checkpointAfterNode ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
        >
          <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${checkpointAfterNode ? 'translate-x-3.5' : 'translate-x-0'}`} />
        </button>
      </div>

      {woeModalPortal}
    </div>
  );
}

/* ─────────────── WOE Transform Config Panel ─────────────── */
function WoeTransformConfigPanel({
  task,
  onPatchPipelineEnvRow,
  readOnly,
  woeTransformDagContext,
}: NodePanelEnvProps) {
  const mergedEnv = React.useMemo(() => mergePipelineEnvWithDefaults(task.pipelineEnv), [task.pipelineEnv]);
  const dataBindingRaw = getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_INPUT_BINDING_ENV);
  const dataFixedRaw = getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_FIXED_DATA_PATH_ENV);
  const encBindingRaw = getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_ENCODER_BINDING_ENV);
  const encFixedRaw = getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_FIXED_ENCODER_PATH_ENV);

  const defaultFeaturesPath = React.useMemo(
    () => buildDataSourceFeaturesInputPath(task, task.pipelineEnv),
    [task.modelName, task.pipelineEnv],
  );
  const defaultEncoderPath = React.useMemo(
    () => buildWoeEncoderSavePathDisplay(task, 10, task.pipelineEnv),
    [task.modelName, task.pipelineEnv],
  );

  const [dataFixedMenuChosen, setDataFixedMenuChosen] = useState(false);
  const [encFixedMenuChosen, setEncFixedMenuChosen] = useState(false);

  useEffect(() => {
    if (!dataBindingRaw.trim() && dataFixedRaw.trim()) setDataFixedMenuChosen(true);
  }, [task.id, dataBindingRaw, dataFixedRaw]);

  useEffect(() => {
    if (!encBindingRaw.trim() && encFixedRaw.trim()) setEncFixedMenuChosen(true);
  }, [task.id, encBindingRaw, encFixedRaw]);

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;
  const selectCls = `w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-xs font-mono
    appearance-none cursor-pointer transition-colors text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const stabilityDims = MOCK_HIVE_COLUMNS.slice(0, 16);
  const stabilityDimRaw = getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_STABILITY_DIM_ENV);
  const stabilityDimSelect = stabilityDims.includes(stabilityDimRaw) ? stabilityDimRaw : stabilityDims[0];

  const dataSavePath = buildWoeTransformDataSavePathDisplay(task, task.pipelineEnv);
  const featureReportPath = buildWoeTransformFeatureReportSavePathDisplay(task, task.pipelineEnv);

  const featureReportOn = getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_FEATURE_REPORT_ENV).toLowerCase() !== 'false';
  const transformCheckpointAfterNode =
    getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_CHECKPOINT_AFTER_NODE_ENV).toLowerCase() !== 'false';

  const upstreamForTransform = woeTransformDagContext
    ? getUpstreamNodesForTarget(
        woeTransformDagContext.edges,
        woeTransformDagContext.nodes,
        woeTransformDagContext.woeTransformNodeId,
      )
    : [];

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      <NodeConfigBand title="Input data path">
        <div className="flex flex-col gap-2">
          {woeTransformDagContext ? (
            <>
              <WoeCascadeBindingField
                task={task}
                readOnly={readOnly}
                upstreamNodes={upstreamForTransform}
                allNodes={woeTransformDagContext.nodes}
                bindingRaw={dataBindingRaw}
                fixedPathRaw={dataFixedRaw}
                fixedMenuChosen={dataFixedMenuChosen}
                onFixedMenuChosen={setDataFixedMenuChosen}
                onBindingChange={(raw) => {
                  onPatchPipelineEnvRow(WOE_TRANSFORM_INPUT_BINDING_ENV, raw);
                  if (raw.trim()) {
                    onPatchPipelineEnvRow(WOE_TRANSFORM_FIXED_DATA_PATH_ENV, '');
                    setDataFixedMenuChosen(false);
                  }
                }}
                onFixedPathChange={(path) => {
                  onPatchPipelineEnvRow(WOE_TRANSFORM_FIXED_DATA_PATH_ENV, path);
                  if (path.trim()) onPatchPipelineEnvRow(WOE_TRANSFORM_INPUT_BINDING_ENV, '');
                }}
                onClearAll={() => {
                  onPatchPipelineEnvRow(WOE_TRANSFORM_INPUT_BINDING_ENV, '');
                  onPatchPipelineEnvRow(WOE_TRANSFORM_FIXED_DATA_PATH_ENV, '');
                  setDataFixedMenuChosen(false);
                }}
                numInputCls={numInputCls}
                fieldName="data_path"
                typeBadge="data"
                cascadeKind="transform_data"
                cardNoUpstreamHint={`No upstream node linked to WOE Transform. Draw an incoming edge on the canvas to pick node outputs here, or use ${WOE_FIT_FIXED_VALUE_LABEL} for a manual S3 path.`}
                portalNoUpstreamHint={`No upstream nodes — connect WOE Transform to a node on the canvas, or choose ${WOE_FIT_FIXED_VALUE_LABEL}.`}
              />
              <WoeCascadeBindingField
                task={task}
                readOnly={readOnly}
                upstreamNodes={upstreamForTransform}
                allNodes={woeTransformDagContext.nodes}
                bindingRaw={encBindingRaw}
                fixedPathRaw={encFixedRaw}
                fixedMenuChosen={encFixedMenuChosen}
                onFixedMenuChosen={setEncFixedMenuChosen}
                onBindingChange={(raw) => {
                  onPatchPipelineEnvRow(WOE_TRANSFORM_ENCODER_BINDING_ENV, raw);
                  if (raw.trim()) {
                    onPatchPipelineEnvRow(WOE_TRANSFORM_FIXED_ENCODER_PATH_ENV, '');
                    setEncFixedMenuChosen(false);
                  }
                }}
                onFixedPathChange={(path) => {
                  onPatchPipelineEnvRow(WOE_TRANSFORM_FIXED_ENCODER_PATH_ENV, path);
                  if (path.trim()) onPatchPipelineEnvRow(WOE_TRANSFORM_ENCODER_BINDING_ENV, '');
                }}
                onClearAll={() => {
                  onPatchPipelineEnvRow(WOE_TRANSFORM_ENCODER_BINDING_ENV, '');
                  onPatchPipelineEnvRow(WOE_TRANSFORM_FIXED_ENCODER_PATH_ENV, '');
                  setEncFixedMenuChosen(false);
                }}
                numInputCls={numInputCls}
                fieldName="encoder_path"
                typeBadge="pkl"
                cascadeKind="transform_encoder"
                cardNoUpstreamHint={`No WOE Fit upstream for encoder .pkl. Connect WOE Fit to WOE Transform on the canvas, or use ${WOE_FIT_FIXED_VALUE_LABEL} for a manual path.`}
                portalNoUpstreamHint={`No upstream nodes — connect a WoeFit node, or choose ${WOE_FIT_FIXED_VALUE_LABEL}.`}
              />
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
                <Database size={10} className="shrink-0 text-slate-300 mt-0.5" />
                <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{defaultFeaturesPath}</span>
              </div>
              <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
                <Sliders size={10} className="shrink-0 text-slate-300 mt-0.5" />
                <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{defaultEncoderPath}</span>
              </div>
            </div>
          )}
        </div>
      </NodeConfigBand>

      <NodeConfigBand title="Node configuration">
        <div className="flex flex-col gap-3">
          <SampleScopeMultiSelect
            value={parseSampleScopeJson(getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_SAMPLE_SCOPE_ENV))}
            readOnly={readOnly}
            onChange={(next) => onPatchPipelineEnvRow(WOE_TRANSFORM_SAMPLE_SCOPE_ENV, stringifySampleScopeJson(next))}
            labelCls={labelCls}
            tooltip="Scopes applied when transforming rows (train / test / val / all). Stored as woe_transform_sample_scope."
          />
          <div className="flex items-center justify-between gap-2">
            <p className={`${labelCls} mb-0`}>
              feature_report
              <FieldTooltip text="When enabled, emit a feature analysis report alongside transform output (woe_transform_feature_report)." />
            </p>
            <button
              type="button"
              disabled={readOnly}
              onClick={() =>
                !readOnly &&
                onPatchPipelineEnvRow(WOE_TRANSFORM_FEATURE_REPORT_ENV, featureReportOn ? 'false' : 'true')
              }
              className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0 disabled:opacity-50 ${featureReportOn ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${featureReportOn ? 'translate-x-3' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <div>
            <p className={labelCls}>
              stability_dim
              <FieldTooltip text="Hive column used as the stability dimension in reports (woe_transform_stability_dim)." />
            </p>
            <div className="relative">
              <select
                value={stabilityDimSelect}
                disabled={readOnly}
                onChange={(e) => onPatchPipelineEnvRow(WOE_TRANSFORM_STABILITY_DIM_ENV, e.target.value)}
                className={selectCls}
              >
                {stabilityDims.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
          <ReportTabsMultiSelect
            value={parseReportTabsJson(getPipelineEnvValue(mergedEnv, WOE_TRANSFORM_REPORT_TABS_ENV))}
            readOnly={readOnly}
            onChange={(next) => onPatchPipelineEnvRow(WOE_TRANSFORM_REPORT_TABS_ENV, stringifyReportTabsJson(next))}
            labelCls={labelCls}
            tooltip="Report sections to include: performance, trend, stability, mono. Stored as JSON in woe_transform_report_tabs."
          />
        </div>
      </NodeConfigBand>

      <NodeResourceAdvBlock readOnly={readOnly} pipelineEnv={task.pipelineEnv} onPatchEnv={onPatchPipelineEnvRow} />

      <NodeConfigBand title="Output path">
        <div className="flex flex-col gap-2 pb-0.5">
          <CopyPathField label="data_save_path" path={dataSavePath} labelCls={labelCls} />
          <CopyPathField label="feature_report_save_path" path={featureReportPath} labelCls={labelCls} />
        </div>
      </NodeConfigBand>

      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/80 border-l-4 border-l-[#13c2c2]/40 bg-gradient-to-r from-[#13c2c2]/[0.07] to-white"
      >
        <div className="min-w-0 flex-1">
          <p className={`${labelCls} mb-0`}>
            Node checkpoint
            <FieldTooltip text="When enabled, the run pauses in Checking after this node completes until you confirm artifacts and choose Continue." />
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
            Cached checkpoint lets you resume or re-run from this node without redoing upstream work.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() =>
            !readOnly &&
            onPatchPipelineEnvRow(
              WOE_TRANSFORM_CHECKPOINT_AFTER_NODE_ENV,
              transformCheckpointAfterNode ? 'false' : 'true',
            )
          }
          className={`w-8 h-[18px] rounded-full transition-colors flex items-center px-0.5 shrink-0 ${transformCheckpointAfterNode ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${transformCheckpointAfterNode ? 'translate-x-3.5' : 'translate-x-0'}`}
          />
        </button>
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
const FS_METHODS = ['by_iv', 'by_corr', 'by_gini', 'by_psi'] as const;
type FsMethod = (typeof FS_METHODS)[number];

function parseFsMethodsJson(raw: string): FsMethod[] {
  try {
    const a = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(a)) return ['by_iv', 'by_corr'];
    const ok = a.filter(
      (x): x is FsMethod => typeof x === 'string' && (FS_METHODS as readonly string[]).includes(x),
    );
    return ok.length ? ok : ['by_iv', 'by_corr'];
  } catch {
    return ['by_iv', 'by_corr'];
  }
}

function stringifyFsMethodsJson(methods: FsMethod[]): string {
  return JSON.stringify(methods);
}

function FeatureSelectionConfigPanel({
  task,
  onPatchPipelineEnvRow,
  readOnly,
  featureSelectionDagContext,
}: NodePanelEnvProps) {
  const mergedEnv = React.useMemo(() => mergePipelineEnvWithDefaults(task.pipelineEnv), [task.pipelineEnv]);
  const bindingRaw = getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_INPUT_BINDING_ENV);
  const fixedPathRaw = getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_FIXED_DATA_PATH_ENV);
  const [fixedMenuChosen, setFixedMenuChosen] = useState(false);

  useEffect(() => {
    if (!bindingRaw.trim() && fixedPathRaw.trim()) setFixedMenuChosen(true);
  }, [task.id, bindingRaw, fixedPathRaw]);

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const methods = parseFsMethodsJson(getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_SELECT_METHODS_ENV));
  const [methodOpen, setMethodOpen] = useState(false);
  const methodRef = useRef<HTMLDivElement>(null);

  const ivThreshold = (() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_IV_THRESHOLD_ENV));
    return Number.isFinite(n) ? n : 0.02;
  })();
  const corrThreshold = (() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_CORR_THRESHOLD_ENV));
    return Number.isFinite(n) ? n : 0.7;
  })();
  const psiThreshold = (() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_PSI_THRESHOLD_ENV));
    return Number.isFinite(n) ? n : 0.1;
  })();

  const fsCheckpointAfterNode =
    getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_CHECKPOINT_AFTER_NODE_ENV).toLowerCase() === 'true';

  const selectionReportPath = buildFeatureSelectionSelectionReportPathDisplay(task, task.pipelineEnv);
  const featureListPath = buildFeatureSelectionFeatureListPathDisplay(task, task.pipelineEnv);
  const fallbackDataPath = buildWoeTransformDataSavePathDisplay(task, task.pipelineEnv);

  const upstreamForFs = featureSelectionDagContext
    ? getUpstreamNodesForTarget(
        featureSelectionDagContext.edges,
        featureSelectionDagContext.nodes,
        featureSelectionDagContext.featureSelectionNodeId,
      )
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (methodRef.current && !methodRef.current.contains(e.target as Node)) {
        setMethodOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleFsMethod = (m: FsMethod) => {
    if (readOnly) return;
    const next = methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m];
    onPatchPipelineEnvRow(FEATURE_SELECTION_SELECT_METHODS_ENV, stringifyFsMethodsJson(next));
  };

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      <NodeConfigBand title="Input data path">
        <div className="flex flex-col gap-2">
          {featureSelectionDagContext ? (
            <WoeCascadeBindingField
              task={task}
              readOnly={readOnly}
              upstreamNodes={upstreamForFs}
              allNodes={featureSelectionDagContext.nodes}
              bindingRaw={bindingRaw}
              fixedPathRaw={fixedPathRaw}
              fixedMenuChosen={fixedMenuChosen}
              onFixedMenuChosen={setFixedMenuChosen}
              onBindingChange={(raw) => {
                onPatchPipelineEnvRow(FEATURE_SELECTION_INPUT_BINDING_ENV, raw);
                if (raw.trim()) {
                  onPatchPipelineEnvRow(FEATURE_SELECTION_FIXED_DATA_PATH_ENV, '');
                  setFixedMenuChosen(false);
                }
              }}
              onFixedPathChange={(path) => {
                onPatchPipelineEnvRow(FEATURE_SELECTION_FIXED_DATA_PATH_ENV, path);
                if (path.trim()) onPatchPipelineEnvRow(FEATURE_SELECTION_INPUT_BINDING_ENV, '');
              }}
              onClearAll={() => {
                onPatchPipelineEnvRow(FEATURE_SELECTION_INPUT_BINDING_ENV, '');
                onPatchPipelineEnvRow(FEATURE_SELECTION_FIXED_DATA_PATH_ENV, '');
                setFixedMenuChosen(false);
              }}
              numInputCls={numInputCls}
              fieldName="data_path"
              typeBadge="data"
              cascadeKind="feature_selection_data"
              cardNoUpstreamHint={`Connect an upstream node on the canvas, or ${WOE_FIT_FIXED_VALUE_LABEL} for a manual path.`}
              portalNoUpstreamHint={`No upstream — connect a node or ${WOE_FIT_FIXED_VALUE_LABEL}.`}
            />
          ) : (
            <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
              <Database size={10} className="shrink-0 text-slate-300 mt-0.5" />
              <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{fallbackDataPath}</span>
            </div>
          )}
        </div>
      </NodeConfigBand>

      <NodeConfigBand title="Node configuration">
        <div className="flex flex-col gap-3">
          <SampleScopeMultiSelect
            value={parseSampleScopeJson(getPipelineEnvValue(mergedEnv, FEATURE_SELECTION_SAMPLE_SCOPE_ENV))}
            readOnly={readOnly}
            onChange={(next) => onPatchPipelineEnvRow(FEATURE_SELECTION_SAMPLE_SCOPE_ENV, stringifySampleScopeJson(next))}
            labelCls={labelCls}
            tooltip="Scopes for selection input rows (train / test / val / all). Stored as feature_selection_sample_scope."
          />
          <div>
            <p className={labelCls}>
              exclude_cols
              <FieldTooltip text="JSON list of columns to exclude; pre-filled from Pipeline ENV exclude_columns until you override (feature_selection_exclude_columns)." />
            </p>
            <textarea
              value={woeFitEnvOrGlobal(mergedEnv, FEATURE_SELECTION_EXCLUDE_COLUMNS_ENV, 'exclude_columns')}
              readOnly={readOnly}
              onChange={(e) => onPatchPipelineEnvRow(FEATURE_SELECTION_EXCLUDE_COLUMNS_ENV, e.target.value)}
              rows={5}
              spellCheck={false}
              className={`${numInputCls} min-h-[88px] resize-y py-1.5 text-[10px]`}
            />
          </div>
          <div ref={methodRef}>
            <p className={labelCls}>
              fs_methods
              <FieldTooltip text="Selection methods: by_iv, by_corr, by_gini, by_psi. Stored as JSON in feature_selection_select_methods." />
            </p>
            <div className="relative">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && setMethodOpen((v) => !v)}
                className={`w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between
                  text-xs transition-colors
                  focus:outline-none focus:border-[#13c2c2]/60
                  disabled:bg-slate-50 disabled:cursor-not-allowed
                  ${methodOpen ? 'border-[#13c2c2]/60 ring-1 ring-[#13c2c2]/20' : 'hover:border-slate-300'}`}
              >
                <span className="truncate text-left font-mono text-[10px] text-slate-700">
                  {methods.length === 0 ? (
                    <span className="text-slate-400">— select methods —</span>
                  ) : (
                    methods.join(', ')
                  )}
                </span>
                <ChevronDown
                  size={11}
                  className={`shrink-0 text-slate-400 ml-1 transition-transform ${methodOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {methodOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                  {FS_METHODS.map((m) => {
                    const checked = methods.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleFsMethod(m)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all
                          ${checked ? 'bg-[#13c2c2] border-[#13c2c2]' : 'border-slate-300 bg-white'}`}
                        >
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
          <div>
            <p className={labelCls}>
              iv_threshold
              <FieldTooltip text="IV filter threshold (default 0.02)." />
            </p>
            <input
              type="number"
              step={0.001}
              min={0}
              max={1}
              value={ivThreshold}
              disabled={readOnly}
              onChange={(e) => onPatchPipelineEnvRow(FEATURE_SELECTION_IV_THRESHOLD_ENV, String(Number(e.target.value)))}
              className={numInputCls}
            />
          </div>
          <div>
            <p className={labelCls}>
              corr_threshold
              <FieldTooltip text="Correlation threshold (default 0.7)." />
            </p>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={corrThreshold}
              disabled={readOnly}
              onChange={(e) => onPatchPipelineEnvRow(FEATURE_SELECTION_CORR_THRESHOLD_ENV, String(Number(e.target.value)))}
              className={numInputCls}
            />
          </div>
          <div>
            <p className={labelCls}>
              psi_threshold
              <FieldTooltip text="PSI threshold when by_psi is selected (default 0.1)." />
            </p>
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={psiThreshold}
              disabled={readOnly}
              onChange={(e) => onPatchPipelineEnvRow(FEATURE_SELECTION_PSI_THRESHOLD_ENV, String(Number(e.target.value)))}
              className={numInputCls}
            />
          </div>
        </div>
      </NodeConfigBand>

      <NodeResourceAdvBlock readOnly={readOnly} pipelineEnv={task.pipelineEnv} onPatchEnv={onPatchPipelineEnvRow} />

      <NodeConfigBand title="Output path">
        <div className="flex flex-col gap-2 pb-0.5">
          <CopyPathField label="selection_report_path" path={selectionReportPath} labelCls={labelCls} />
          <CopyPathField label="feature_list_path" path={featureListPath} labelCls={labelCls} />
        </div>
      </NodeConfigBand>

      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/80 border-l-4 border-l-[#13c2c2]/40 bg-gradient-to-r from-[#13c2c2]/[0.07] to-white"
      >
        <div className="min-w-0 flex-1">
          <p className={`${labelCls} mb-0`}>
            Node checkpoint
            <FieldTooltip text="When enabled, the run pauses in Checking after this node completes until you confirm artifacts and choose Continue." />
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
            Cached checkpoint lets you resume or re-run from this node without redoing upstream work.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() =>
            !readOnly &&
            onPatchPipelineEnvRow(FEATURE_SELECTION_CHECKPOINT_AFTER_NODE_ENV, fsCheckpointAfterNode ? 'false' : 'true')
          }
          className={`w-8 h-[18px] rounded-full transition-colors flex items-center px-0.5 shrink-0 ${fsCheckpointAfterNode ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${fsCheckpointAfterNode ? 'translate-x-3.5' : 'translate-x-0'}`}
          />
        </button>
      </div>
    </div>
  );
}

/* ─────────────── LGBM tune & train Config Panel ─────────────── */
const TUNE_INIT_HYPER_PARAM_KEYS = [
  'learning_rate',
  'max_depth',
  'num_leaves',
  'feature_fraction',
  'bagging_fraction',
  'bagging_freq',
  'reg_alpha',
  'reg_lambda',
  'min_gain_to_split',
  'scale_pos_weight',
  'min_child_samples',
  'early_stopping_round',
] as const;
type TuneInitHyperKey = (typeof TUNE_INIT_HYPER_PARAM_KEYS)[number];

const TUNE_HYPER_TYPES = ['uniform', 'randint', 'loguniform'] as const;
type TuneHyperType = (typeof TUNE_HYPER_TYPES)[number];

function getDefaultTuneInitHypersRaw(): string {
  const rows = getDefaultPipelineEnvRows();
  const row = rows.find((r) => r.name === TUNE_TRAIN_INIT_HYPERS_ENV);
  return row?.value ?? '{}';
}

function parseTuneInitHypersObject(raw: string): Record<string, unknown> {
  try {
    const o = JSON.parse(raw || '{}') as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  try {
    return JSON.parse(getDefaultTuneInitHypersRaw()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readTuneHyperSpec(v: unknown, fallback: unknown): { type: TuneHyperType; lower: number; upper: number } {
  const src = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const fb =
    fallback && typeof fallback === 'object' && !Array.isArray(fallback)
      ? (fallback as Record<string, unknown>)
      : {};
  const pick = src ?? fb;
  const tRaw = typeof pick.type === 'string' ? pick.type : String(fb.type ?? 'uniform');
  const t = (TUNE_HYPER_TYPES as readonly string[]).includes(tRaw) ? (tRaw as TuneHyperType) : 'uniform';
  const lower = Number(pick.lower ?? fb.lower ?? 0);
  const upper = Number(pick.upper ?? fb.upper ?? 1);
  return {
    type: t,
    lower: Number.isFinite(lower) ? lower : 0,
    upper: Number.isFinite(upper) ? upper : 1,
  };
}

function ModelTuneConfigPanel({
  task,
  onPatchPipelineEnvRow,
  readOnly,
  tuneTrainDagContext,
}: NodePanelEnvProps) {
  const mergedEnv = React.useMemo(() => mergePipelineEnvWithDefaults(task.pipelineEnv), [task.pipelineEnv]);
  const dataBindingRaw = getPipelineEnvValue(mergedEnv, TUNE_TRAIN_DATA_INPUT_BINDING_ENV);
  const dataFixedRaw = getPipelineEnvValue(mergedEnv, TUNE_TRAIN_FIXED_DATA_PATH_ENV);
  const fsBindingRaw = getPipelineEnvValue(mergedEnv, TUNE_TRAIN_FEATURE_SELECTION_INPUT_BINDING_ENV);
  const fsFixedRaw = getPipelineEnvValue(mergedEnv, TUNE_TRAIN_FIXED_FEATURE_SELECTION_PATH_ENV);
  const [dataFixedMenuChosen, setDataFixedMenuChosen] = useState(false);
  const [fsFixedMenuChosen, setFsFixedMenuChosen] = useState(false);
  const [tuneDataConfigOpen, setTuneDataConfigOpen] = useState(true);

  useEffect(() => {
    if (!dataBindingRaw.trim() && dataFixedRaw.trim()) setDataFixedMenuChosen(true);
  }, [task.id, dataBindingRaw, dataFixedRaw]);

  useEffect(() => {
    if (!fsBindingRaw.trim() && fsFixedRaw.trim()) setFsFixedMenuChosen(true);
  }, [task.id, fsBindingRaw, fsFixedRaw]);

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;
  const selectCls = `w-full h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-[11px] font-mono
    appearance-none cursor-pointer transition-colors text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;
  const hyperNumCls = `w-full h-7 px-1.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const tuneCheckpointAfterNode =
    getPipelineEnvValue(mergedEnv, TUNE_TRAIN_CHECKPOINT_AFTER_NODE_ENV).toLowerCase() === 'true';
  const autoScalePosWeight =
    getPipelineEnvValue(mergedEnv, TUNE_TRAIN_AUTO_SCALE_POS_WEIGHT_ENV).toLowerCase() === 'true';

  const defaultInitObj = parseTuneInitHypersObject(getDefaultTuneInitHypersRaw());
  const initHypersRaw = getPipelineEnvValue(mergedEnv, TUNE_TRAIN_INIT_HYPERS_ENV);
  const initHypersObj = parseTuneInitHypersObject(initHypersRaw);

  const nTrialsParsed = Number.parseInt(getPipelineEnvValue(mergedEnv, TUNE_TRAIN_N_TRIALS_ENV), 10);
  const nTrials = Number.isFinite(nTrialsParsed) && nTrialsParsed >= 1 ? nTrialsParsed : 10;

  const metricRaw = getPipelineEnvValue(mergedEnv, TUNE_TRAIN_METRIC_FOR_TRAIN_TUNE_ENV);
  const metricForTune =
    metricRaw === 'ks' || metricRaw === 'gini' || metricRaw === 'auc' ? metricRaw : 'auc';

  const trainValSplitParsed = Number.parseFloat(getPipelineEnvValue(mergedEnv, TUNE_TRAIN_TRAIN_VAL_SPLIT_ENV));
  const trainValSplit = Number.isFinite(trainValSplitParsed) ? trainValSplitParsed : 0.8;

  const ksThParsed = Number.parseFloat(getPipelineEnvValue(mergedEnv, TUNE_TRAIN_TRAIN_VAL_KS_DIFF_THRESHOLD_ENV));
  const ksThreshold = Number.isFinite(ksThParsed) ? ksThParsed : 0.005;

  const coefParsed = Number.parseFloat(getPipelineEnvValue(mergedEnv, TUNE_TRAIN_COEF_OVERFIT_PUNISHMENT_ENV));
  const coefOverfit = Number.isFinite(coefParsed) ? coefParsed : 10;

  const fallbackDataPath = buildWoeTransformDataSavePathDisplay(task, task.pipelineEnv);
  const fallbackFsReportPath = buildFeatureSelectionSelectionReportPathDisplay(task, task.pipelineEnv);

  const upstreamForTune = tuneTrainDagContext
    ? getUpstreamNodesForTarget(
        tuneTrainDagContext.edges,
        tuneTrainDagContext.nodes,
        tuneTrainDagContext.tuneTrainNodeId,
      )
    : [];

  const patchInitHypers = (updater: (o: Record<string, unknown>) => void) => {
    const m = mergePipelineEnvWithDefaults(task.pipelineEnv);
    const raw = getPipelineEnvValue(m, TUNE_TRAIN_INIT_HYPERS_ENV);
    const o = { ...parseTuneInitHypersObject(raw) };
    updater(o);
    onPatchPipelineEnvRow(TUNE_TRAIN_INIT_HYPERS_ENV, JSON.stringify(o));
  };

  const setHyperRow = (
    paramKey: TuneInitHyperKey,
    patch: Partial<{ type: TuneHyperType; lower: number; upper: number }>,
  ) => {
    patchInitHypers((o) => {
      const spec = readTuneHyperSpec(o[paramKey], defaultInitObj[paramKey]);
      const next = { ...spec, ...patch };
      o[paramKey] = { type: next.type, lower: next.lower, upper: next.upper };
    });
  };

  const objectiveDisp = String(initHypersObj.objective ?? defaultInitObj.objective ?? 'binary');
  let metricDisp = '[]';
  try {
    metricDisp = JSON.stringify(initHypersObj.metric ?? defaultInitObj.metric ?? []);
  } catch {
    metricDisp = '[]';
  }
  const treeLearnerDisp = String(initHypersObj.tree_learner ?? defaultInitObj.tree_learner ?? '');

  const boHistoryPath = buildLgbmTuneBoHistoryOutputPath(task, task.pipelineEnv);
  const featureImportancePath = buildLgbmTuneFeatureImportanceOutputPath(task, task.pipelineEnv);
  const bestModelPath = buildLgbmTuneBestModelOutputPath(task, task.pipelineEnv);
  const tunePredictPath = buildLgbmTunePredictResultOutputPath(task, task.pipelineEnv);
  const tuneBestHypersPath = buildLgbmTuneBestHypersOutputPath(task, task.pipelineEnv);
  const tuneTrialPath = buildLgbmTuneTrialOutputPath(task, task.pipelineEnv);
  const trainedModelPath = buildLgbmTuneTrainedModelOutputPath(task, task.pipelineEnv);
  const trainPredictPath = buildLgbmTuneTrainPredictResultOutputPath(task, task.pipelineEnv);

  return (
    <div className="px-4 py-3 flex flex-col gap-4">
      <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
        <Settings size={11} className="shrink-0" />
        <span className="font-mono tracking-wide">LGBM tune &amp; train</span>
      </div>

      <NodeConfigBand title="Input data path">
        <div className="flex flex-col gap-3">
          {tuneTrainDagContext ? (
            <WoeCascadeBindingField
              task={task}
              readOnly={readOnly}
              upstreamNodes={upstreamForTune}
              allNodes={tuneTrainDagContext.nodes}
              bindingRaw={dataBindingRaw}
              fixedPathRaw={dataFixedRaw}
              fixedMenuChosen={dataFixedMenuChosen}
              onFixedMenuChosen={setDataFixedMenuChosen}
              onBindingChange={(raw) => {
                onPatchPipelineEnvRow(TUNE_TRAIN_DATA_INPUT_BINDING_ENV, raw);
                if (raw.trim()) {
                  onPatchPipelineEnvRow(TUNE_TRAIN_FIXED_DATA_PATH_ENV, '');
                  setDataFixedMenuChosen(false);
                }
              }}
              onFixedPathChange={(path) => {
                onPatchPipelineEnvRow(TUNE_TRAIN_FIXED_DATA_PATH_ENV, path);
                if (path.trim()) onPatchPipelineEnvRow(TUNE_TRAIN_DATA_INPUT_BINDING_ENV, '');
              }}
              onClearAll={() => {
                onPatchPipelineEnvRow(TUNE_TRAIN_DATA_INPUT_BINDING_ENV, '');
                onPatchPipelineEnvRow(TUNE_TRAIN_FIXED_DATA_PATH_ENV, '');
                setDataFixedMenuChosen(false);
              }}
              numInputCls={numInputCls}
              fieldName="data_input"
              typeBadge="data"
              cascadeKind="feature_selection_data"
              cardNoUpstreamHint={`Connect an upstream node on the canvas, or ${WOE_FIT_FIXED_VALUE_LABEL} for a manual path.`}
              portalNoUpstreamHint={`No upstream — connect a node or ${WOE_FIT_FIXED_VALUE_LABEL}.`}
            />
          ) : (
            <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
              <Database size={10} className="shrink-0 text-slate-300 mt-0.5" />
              <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{fallbackDataPath}</span>
            </div>
          )}
          {tuneTrainDagContext ? (
            <WoeCascadeBindingField
              task={task}
              readOnly={readOnly}
              upstreamNodes={upstreamForTune}
              allNodes={tuneTrainDagContext.nodes}
              bindingRaw={fsBindingRaw}
              fixedPathRaw={fsFixedRaw}
              fixedMenuChosen={fsFixedMenuChosen}
              onFixedMenuChosen={setFsFixedMenuChosen}
              onBindingChange={(raw) => {
                onPatchPipelineEnvRow(TUNE_TRAIN_FEATURE_SELECTION_INPUT_BINDING_ENV, raw);
                if (raw.trim()) {
                  onPatchPipelineEnvRow(TUNE_TRAIN_FIXED_FEATURE_SELECTION_PATH_ENV, '');
                  setFsFixedMenuChosen(false);
                }
              }}
              onFixedPathChange={(path) => {
                onPatchPipelineEnvRow(TUNE_TRAIN_FIXED_FEATURE_SELECTION_PATH_ENV, path);
                if (path.trim()) onPatchPipelineEnvRow(TUNE_TRAIN_FEATURE_SELECTION_INPUT_BINDING_ENV, '');
              }}
              onClearAll={() => {
                onPatchPipelineEnvRow(TUNE_TRAIN_FEATURE_SELECTION_INPUT_BINDING_ENV, '');
                onPatchPipelineEnvRow(TUNE_TRAIN_FIXED_FEATURE_SELECTION_PATH_ENV, '');
                setFsFixedMenuChosen(false);
              }}
              numInputCls={numInputCls}
              fieldName="feature_selection_input"
              typeBadge="data"
              cascadeKind="tune_train_selection_report"
              cardNoUpstreamHint={`Connect Feature Selection upstream, or ${WOE_FIT_FIXED_VALUE_LABEL} for a manual report path.`}
              portalNoUpstreamHint={`No upstream — connect Feature Selection or ${WOE_FIT_FIXED_VALUE_LABEL}.`}
            />
          ) : (
            <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
              <Filter size={10} className="shrink-0 text-slate-300 mt-0.5" />
              <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{fallbackFsReportPath}</span>
            </div>
          )}
        </div>
      </NodeConfigBand>

      <NodeConfigBand title="Node configuration">
        <div className="flex flex-col gap-3.5">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setTuneDataConfigOpen((o) => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors text-left
                ${tuneDataConfigOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
            >
              <span className="text-[10px] font-semibold text-slate-600">
                data_config
                <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                  Overrides Pipeline ENV for this node (tune_train_* keys).
                </span>
              </span>
              <ChevronDown
                size={14}
                className={`text-slate-400 shrink-0 transition-transform ${tuneDataConfigOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {tuneDataConfigOpen && (
              <div className="border-t border-slate-100 px-3 py-2.5 flex flex-col gap-2 bg-white">
                <div>
                  <p className={labelCls}>
                    exclude_cols
                    <FieldTooltip text="JSON array; empty inherits Pipeline ENV exclude_columns. Edit to override tune_train_exclude_cols." />
                  </p>
                  <textarea
                    value={tuneTrainEnvOrGlobal(mergedEnv, TUNE_TRAIN_EXCLUDE_COLS_ENV, 'exclude_columns')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(TUNE_TRAIN_EXCLUDE_COLS_ENV, e.target.value)}
                    rows={2}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[52px] resize-y py-1.5 text-[10px]`}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    auxilary_cols
                    <FieldTooltip text="JSON array; empty inherits Pipeline ENV removed_features. Edit to override tune_train_auxilary_cols." />
                  </p>
                  <textarea
                    value={tuneTrainEnvOrGlobal(mergedEnv, TUNE_TRAIN_AUXILARY_COLS_ENV, 'removed_features')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(TUNE_TRAIN_AUXILARY_COLS_ENV, e.target.value)}
                    rows={2}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[52px] resize-y py-1.5 text-[10px]`}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    sample_weight_col
                    <FieldTooltip text="Optional; empty inherits Pipeline ENV sample_weight_column. Edit to override tune_train_sample_weight_col." />
                  </p>
                  <input
                    type="text"
                    value={woeFitEnvOrGlobal(mergedEnv, TUNE_TRAIN_SAMPLE_WEIGHT_COL_ENV, 'sample_weight_column')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(TUNE_TRAIN_SAMPLE_WEIGHT_COL_ENV, e.target.value)}
                    className={numInputCls}
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <p className={labelCls}>
              n_trials
              <FieldTooltip text="Number of HPO trials (tune_train_n_trials). Minimum 1." />
            </p>
            <input
              type="number"
              min={1}
              step={1}
              value={nTrials}
              disabled={readOnly}
              onChange={(e) => {
                const v = Number(e.target.value);
                onPatchPipelineEnvRow(TUNE_TRAIN_N_TRIALS_ENV, String(Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1));
              }}
              className={numInputCls}
            />
          </div>
          <div>
            <p className={labelCls}>
              metric_for_train_tune
              <FieldTooltip text="Optimization metric: auc, ks, or gini (tune_train_metric_for_train_tune)." />
            </p>
            <div className="relative">
              <select
                disabled={readOnly}
                value={metricForTune}
                onChange={(e) => onPatchPipelineEnvRow(TUNE_TRAIN_METRIC_FOR_TRAIN_TUNE_ENV, e.target.value)}
                className={selectCls}
              >
                <option value="auc">auc</option>
                <option value="ks">ks</option>
                <option value="gini">gini</option>
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <p className={labelCls}>
              train_val_split
              <FieldTooltip text="Train fraction for internal split (tune_train_train_val_split)." />
            </p>
            <input
              type="number"
              min={0.01}
              max={0.99}
              step={0.01}
              value={trainValSplit}
              disabled={readOnly}
              onChange={(e) =>
                onPatchPipelineEnvRow(TUNE_TRAIN_TRAIN_VAL_SPLIT_ENV, String(Number(e.target.value)))
              }
              className={numInputCls}
            />
          </div>
          <div>
            <p className={labelCls}>
              train_val_ks_diff_threshold
              <FieldTooltip text="Max train vs val KS gap (tune_train_train_val_ks_diff_threshold)." />
            </p>
            <input
              type="number"
              min={0}
              step={0.001}
              value={ksThreshold}
              disabled={readOnly}
              onChange={(e) =>
                onPatchPipelineEnvRow(TUNE_TRAIN_TRAIN_VAL_KS_DIFF_THRESHOLD_ENV, String(Number(e.target.value)))
              }
              className={numInputCls}
            />
          </div>
          <div>
            <p className={labelCls}>
              coef_overfit_punishment
              <FieldTooltip text="KS overfit penalty coefficient (tune_train_coef_overfit_punishment)." />
            </p>
            <input
              type="number"
              min={0}
              step={1}
              value={coefOverfit}
              disabled={readOnly}
              onChange={(e) =>
                onPatchPipelineEnvRow(TUNE_TRAIN_COEF_OVERFIT_PUNISHMENT_ENV, String(Number(e.target.value)))
              }
              className={numInputCls}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={`${labelCls} mb-0`}>
              auto_scale_pos_weight
              <FieldTooltip text="When true, auto scale_pos_weight; false uses init_hypers range (tune_train_auto_scale_pos_weight)." />
            </p>
            <button
              type="button"
              disabled={readOnly}
              onClick={() =>
                !readOnly &&
                onPatchPipelineEnvRow(
                  TUNE_TRAIN_AUTO_SCALE_POS_WEIGHT_ENV,
                  autoScalePosWeight ? 'false' : 'true',
                )
              }
              className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 shrink-0 disabled:opacity-50 ${autoScalePosWeight ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${autoScalePosWeight ? 'translate-x-3' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <div>
            <p className={labelCls}>
              init_hypers
              <FieldTooltip text="Structured search space JSON; edit hyper rows below (type, lower, upper). Objective, metric, and tree_learner are read-only here." />
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">objective</p>
                  <div className="h-7 px-2 rounded border border-slate-100 bg-white flex items-center text-[10px] font-mono text-slate-500 truncate" title={objectiveDisp}>
                    {objectiveDisp}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">tree_learner</p>
                  <div className="h-7 px-2 rounded border border-slate-100 bg-white flex items-center text-[10px] font-mono text-slate-500 truncate" title={treeLearnerDisp}>
                    {treeLearnerDisp}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">metric</p>
                <div className="min-h-7 px-2 py-1 rounded border border-slate-100 bg-white text-[10px] font-mono text-slate-500 break-all leading-snug">
                  {metricDisp}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/80">
                <div className="grid grid-cols-[minmax(0,1fr)_88px_76px_76px] gap-x-1.5 gap-y-1 items-center text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  <span>Param</span>
                  <span>type</span>
                  <span>Lower</span>
                  <span>Upper</span>
                </div>
                <div className="flex flex-col">
                  {TUNE_INIT_HYPER_PARAM_KEYS.map((paramKey) => {
                    const spec = readTuneHyperSpec(initHypersObj[paramKey], defaultInitObj[paramKey]);
                    return (
                      <div
                        key={paramKey}
                        className="grid grid-cols-[minmax(0,1fr)_88px_76px_76px] gap-x-1.5 gap-y-1 items-center py-1.5 border-b border-slate-100/90 last:border-0"
                      >
                        <div
                          className="min-w-0 min-h-7 flex items-center pr-1 cursor-help"
                          title={paramKey}
                        >
                          <span className="text-[10px] font-mono text-slate-600 truncate block w-full">
                            {paramKey}
                          </span>
                        </div>
                        <div className="relative min-w-0">
                          <select
                            disabled={readOnly}
                            value={spec.type}
                            onChange={(e) =>
                              setHyperRow(paramKey, { type: e.target.value as TuneHyperType })
                            }
                            className={`${selectCls} h-7 text-[10px] pl-1.5 pr-5`}
                          >
                            {TUNE_HYPER_TYPES.map((ht) => (
                              <option key={ht} value={ht}>
                                {ht}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={spec.lower}
                          disabled={readOnly}
                          onChange={(e) => setHyperRow(paramKey, { lower: Number(e.target.value) })}
                          className={hyperNumCls}
                        />
                        <input
                          type="number"
                          step="any"
                          value={spec.upper}
                          disabled={readOnly}
                          onChange={(e) => setHyperRow(paramKey, { upper: Number(e.target.value) })}
                          className={hyperNumCls}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </NodeConfigBand>

      <NodeResourceAdvBlock
        readOnly={readOnly}
        pipelineEnv={task.pipelineEnv}
        onPatchEnv={onPatchPipelineEnvRow}
        profile="tune_train"
      />

      <NodeConfigBand title="Output path">
        <div className="pb-0.5 flex flex-col gap-3.5">
          <CopyPathField label="bo_history_output" path={boHistoryPath} labelCls={labelCls} />
          <CopyPathField label="feature_importance_output" path={featureImportancePath} labelCls={labelCls} />
          <CopyPathField label="best_model_output" path={bestModelPath} labelCls={labelCls} />
          <CopyPathField label="tune_predict_result_output" path={tunePredictPath} labelCls={labelCls} />
          <CopyPathField label="tune_best_hypers_output" path={tuneBestHypersPath} labelCls={labelCls} />
          <CopyPathField label="tune_trial_output" path={tuneTrialPath} labelCls={labelCls} />
          <CopyPathField label="trained_model_output" path={trainedModelPath} labelCls={labelCls} />
          <CopyPathField label="train_predict_result_output" path={trainPredictPath} labelCls={labelCls} />
        </div>
      </NodeConfigBand>

      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200/80 border-l-4 border-l-[#13c2c2]/40 bg-gradient-to-r from-[#13c2c2]/[0.07] to-white"
      >
        <div className="min-w-0 flex-1">
          <p className={`${labelCls} mb-0`}>
            Node checkpoint
            <FieldTooltip text="When enabled, the run pauses in Checking after this node completes until you confirm artifacts and choose Continue." />
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
            Cached checkpoint lets you resume or re-run from this node without redoing upstream work.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() =>
            !readOnly &&
            onPatchPipelineEnvRow(
              TUNE_TRAIN_CHECKPOINT_AFTER_NODE_ENV,
              tuneCheckpointAfterNode ? 'false' : 'true',
            )
          }
          className={`w-8 h-[18px] rounded-full transition-colors flex items-center px-0.5 shrink-0 ${tuneCheckpointAfterNode ? 'bg-[#13c2c2]' : 'bg-slate-200'}`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${tuneCheckpointAfterNode ? 'translate-x-3.5' : 'translate-x-0'}`}
          />
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Model Prediction Config Panel (infer) ─────────────── */
function ModelInferenceConfigPanel({
  task,
  onPatchPipelineEnvRow,
  readOnly,
  modelPredictionDagContext,
}: NodePanelEnvProps) {
  const mergedEnv = React.useMemo(() => mergePipelineEnvWithDefaults(task.pipelineEnv), [task.pipelineEnv]);
  const dataBindingRaw = getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_DATA_INPUT_BINDING_ENV);
  const dataFixedRaw = getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_FIXED_DATA_PATH_ENV);
  const bestBindingRaw = getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_BEST_MODEL_BINDING_ENV);
  const bestFixedRaw = getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_FIXED_BEST_MODEL_PATH_ENV);
  const [dataFixedMenuChosen, setDataFixedMenuChosen] = useState(false);
  const [bestFixedMenuChosen, setBestFixedMenuChosen] = useState(false);
  const [mpDataConfigOpen, setMpDataConfigOpen] = useState(true);

  useEffect(() => {
    if (!dataBindingRaw.trim() && dataFixedRaw.trim()) setDataFixedMenuChosen(true);
  }, [task.id, dataBindingRaw, dataFixedRaw]);

  useEffect(() => {
    if (!bestBindingRaw.trim() && bestFixedRaw.trim()) setBestFixedMenuChosen(true);
  }, [task.id, bestBindingRaw, bestFixedRaw]);

  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';
  const numInputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-mono
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`;

  const fallbackDataPath = buildWoeTransformDataSavePathDisplay(task, task.pipelineEnv);
  const fallbackBestModelPath = buildLgbmTuneBestModelOutputPath(task, task.pipelineEnv);
  const predictResultPath = buildModelPredictionPredictResultPathDisplay(task, task.pipelineEnv);

  const upstreamForPrediction = modelPredictionDagContext
    ? getUpstreamNodesForTarget(
        modelPredictionDagContext.edges,
        modelPredictionDagContext.nodes,
        modelPredictionDagContext.modelPredictionNodeId,
      )
    : [];

  const batchParsed = Number.parseInt(getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_BATCH_SIZE_ENV), 10);
  const batchSize = Number.isFinite(batchParsed) && batchParsed >= 1 ? batchParsed : 1024;

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <NodeConfigBand title="Input data path">
        <div className="flex flex-col gap-3">
          {modelPredictionDagContext ? (
            <WoeCascadeBindingField
              task={task}
              readOnly={readOnly}
              upstreamNodes={upstreamForPrediction}
              allNodes={modelPredictionDagContext.nodes}
              bindingRaw={dataBindingRaw}
              fixedPathRaw={dataFixedRaw}
              fixedMenuChosen={dataFixedMenuChosen}
              onFixedMenuChosen={setDataFixedMenuChosen}
              onBindingChange={(raw) => {
                onPatchPipelineEnvRow(MODEL_PREDICTION_DATA_INPUT_BINDING_ENV, raw);
                if (raw.trim()) {
                  onPatchPipelineEnvRow(MODEL_PREDICTION_FIXED_DATA_PATH_ENV, '');
                  setDataFixedMenuChosen(false);
                }
              }}
              onFixedPathChange={(path) => {
                onPatchPipelineEnvRow(MODEL_PREDICTION_FIXED_DATA_PATH_ENV, path);
                if (path.trim()) onPatchPipelineEnvRow(MODEL_PREDICTION_DATA_INPUT_BINDING_ENV, '');
              }}
              onClearAll={() => {
                onPatchPipelineEnvRow(MODEL_PREDICTION_DATA_INPUT_BINDING_ENV, '');
                onPatchPipelineEnvRow(MODEL_PREDICTION_FIXED_DATA_PATH_ENV, '');
                setDataFixedMenuChosen(false);
              }}
              numInputCls={numInputCls}
              fieldName="data_input"
              typeBadge="data"
              cascadeKind="feature_selection_data"
              cardNoUpstreamHint={`Connect an upstream node on the canvas, or ${WOE_FIT_FIXED_VALUE_LABEL} for a manual path.`}
              portalNoUpstreamHint={`No upstream — connect a node or ${WOE_FIT_FIXED_VALUE_LABEL}.`}
            />
          ) : (
            <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
              <Database size={10} className="shrink-0 text-slate-300 mt-0.5" />
              <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{fallbackDataPath}</span>
            </div>
          )}
          {modelPredictionDagContext ? (
            <WoeCascadeBindingField
              task={task}
              readOnly={readOnly}
              upstreamNodes={upstreamForPrediction}
              allNodes={modelPredictionDagContext.nodes}
              bindingRaw={bestBindingRaw}
              fixedPathRaw={bestFixedRaw}
              fixedMenuChosen={bestFixedMenuChosen}
              onFixedMenuChosen={setBestFixedMenuChosen}
              onBindingChange={(raw) => {
                onPatchPipelineEnvRow(MODEL_PREDICTION_BEST_MODEL_BINDING_ENV, raw);
                if (raw.trim()) {
                  onPatchPipelineEnvRow(MODEL_PREDICTION_FIXED_BEST_MODEL_PATH_ENV, '');
                  setBestFixedMenuChosen(false);
                }
              }}
              onFixedPathChange={(path) => {
                onPatchPipelineEnvRow(MODEL_PREDICTION_FIXED_BEST_MODEL_PATH_ENV, path);
                if (path.trim()) onPatchPipelineEnvRow(MODEL_PREDICTION_BEST_MODEL_BINDING_ENV, '');
              }}
              onClearAll={() => {
                onPatchPipelineEnvRow(MODEL_PREDICTION_BEST_MODEL_BINDING_ENV, '');
                onPatchPipelineEnvRow(MODEL_PREDICTION_FIXED_BEST_MODEL_PATH_ENV, '');
                setBestFixedMenuChosen(false);
              }}
              numInputCls={numInputCls}
              fieldName="best_model_path"
              typeBadge="pkl"
              cascadeKind="tune_train_best_model"
              cardNoUpstreamHint={`Connect LGBM tune &amp; train upstream, or ${WOE_FIT_FIXED_VALUE_LABEL} for a manual .pkl path.`}
              portalNoUpstreamHint={`No upstream — connect LGBM tune &amp; train or ${WOE_FIT_FIXED_VALUE_LABEL}.`}
            />
          ) : (
            <div className="min-h-8 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 flex items-start gap-1.5">
              <FolderOpen size={10} className="shrink-0 text-slate-300 mt-0.5" />
              <span className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{fallbackBestModelPath}</span>
            </div>
          )}
        </div>
      </NodeConfigBand>

      <NodeConfigBand title="Node configuration">
        <div className="flex flex-col gap-3">
          <SampleScopeMultiSelect
            value={parseModelPredictionSampleScopeJson(getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_SAMPLE_SCOPE_ENV))}
            readOnly={readOnly}
            onChange={(next) => onPatchPipelineEnvRow(MODEL_PREDICTION_SAMPLE_SCOPE_ENV, stringifySampleScopeJson(next))}
            labelCls={labelCls}
            tooltip="Scopes applied when scoring rows (train / test / val / all). Stored as model_prediction_sample_scope. Default test."
          />
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setMpDataConfigOpen((o) => !o)}
              className={`w-full flex items-center justify-between px-3 py-2 transition-colors text-left
                ${mpDataConfigOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
            >
              <span className="text-[10px] font-semibold text-slate-600">
                data_config
                <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                  Overrides Pipeline ENV for this node (model_prediction_* keys).
                </span>
              </span>
              <ChevronDown
                size={14}
                className={`text-slate-400 shrink-0 transition-transform ${mpDataConfigOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {mpDataConfigOpen && (
              <div className="border-t border-slate-100 px-3 py-2.5 flex flex-col gap-2 bg-white">
                <div>
                  <p className={labelCls}>
                    auxilary_cols
                    <FieldTooltip text="JSON array; empty inherits Pipeline ENV removed_features. Edit to override model_prediction_auxilary_cols." />
                  </p>
                  <textarea
                    value={tuneTrainEnvOrGlobal(mergedEnv, MODEL_PREDICTION_AUXILARY_COLS_ENV, 'removed_features')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(MODEL_PREDICTION_AUXILARY_COLS_ENV, e.target.value)}
                    rows={2}
                    spellCheck={false}
                    className={`${numInputCls} min-h-[52px] resize-y py-1.5 text-[10px]`}
                  />
                </div>
                <div>
                  <p className={labelCls}>
                    sample_weight_col
                    <FieldTooltip text="Optional; empty inherits Pipeline ENV sample_weight_column. Edit to override model_prediction_sample_weight_col." />
                  </p>
                  <input
                    type="text"
                    value={woeFitEnvOrGlobal(mergedEnv, MODEL_PREDICTION_SAMPLE_WEIGHT_COL_ENV, 'sample_weight_column')}
                    readOnly={readOnly}
                    onChange={(e) => onPatchPipelineEnvRow(MODEL_PREDICTION_SAMPLE_WEIGHT_COL_ENV, e.target.value)}
                    className={numInputCls}
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <p className={labelCls}>
              batch_size
              <FieldTooltip text="Batch size for prediction (model_prediction_batch_size). Minimum 1." />
            </p>
            <input
              type="number"
              min={1}
              step={1}
              value={batchSize}
              disabled={readOnly}
              onChange={(e) => {
                const v = Number(e.target.value);
                onPatchPipelineEnvRow(
                  MODEL_PREDICTION_BATCH_SIZE_ENV,
                  String(Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1024),
                );
              }}
              className={numInputCls}
            />
          </div>
          <div>
            <p className={labelCls}>
              output_columns
              <FieldTooltip text="JSON array of output column names, e.g. [&quot;score&quot;,&quot;probability&quot;] (model_prediction_output_columns)." />
            </p>
            <input
              type="text"
              value={getPipelineEnvValue(mergedEnv, MODEL_PREDICTION_OUTPUT_COLUMNS_ENV)}
              readOnly={readOnly}
              onChange={(e) => onPatchPipelineEnvRow(MODEL_PREDICTION_OUTPUT_COLUMNS_ENV, e.target.value)}
              className={numInputCls}
              spellCheck={false}
            />
          </div>
        </div>
      </NodeConfigBand>

      <NodeResourceAdvBlock
        readOnly={readOnly}
        pipelineEnv={task.pipelineEnv}
        onPatchEnv={onPatchPipelineEnvRow}
        profile="model_prediction"
      />

      <NodeConfigBand title="Result output">
        <CopyPathField label="predict_result_path" path={predictResultPath} labelCls={labelCls} />
      </NodeConfigBand>
    </div>
  );
}

function buildDataSourceLoadedOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/data/loaded/`;
}

/** Upstream Data Source output for WOE Fit input.data_path (parquet features), per partner spec default pattern. */
function buildDataSourceFeaturesInputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/features`;
}

function buildWoeEncoderSavePathDisplay(task: TrainingTask, nBins: number, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/woe/encoder/${task.modelName}_best_ks_${nBins}bin.pkl`;
}

function buildWoeTransformDataSavePathDisplay(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/woe/transform/woe_features_merged.parquet`;
}

function buildWoeTransformFeatureReportSavePathDisplay(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/reports/feature_report_${task.modelName}.html`;
}

function buildFeatureSelectionSelectionReportPathDisplay(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/feature_selection/selection_report.xlsx`;
}

function buildFeatureSelectionFeatureListPathDisplay(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/feature_selection/selected_feature_list.json`;
}

function buildLgbmTuneOutputDir(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/lgbm_tune`;
}

function buildLgbmTuneBoHistoryOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/bo_history.json`;
}
function buildLgbmTuneFeatureImportanceOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/feature_importance.json`;
}
function buildLgbmTuneBestModelOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/best_model.pkl`;
}
function buildLgbmTunePredictResultOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/tune_predict_result.parquet`;
}
function buildLgbmTuneBestHypersOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/tune_best_hypers.json`;
}
function buildLgbmTuneTrialOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/tune_trial_log.json`;
}
function buildLgbmTuneTrainedModelOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/trained_model.pkl`;
}
function buildLgbmTuneTrainPredictResultOutputPath(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  return `${buildLgbmTuneOutputDir(task, pipelineEnv)}/train_predict_result.parquet`;
}

function buildModelPredictionPredictResultPathDisplay(task: TrainingTask, pipelineEnv?: PipelineEnvRow[]): string {
  const merged = mergePipelineEnvWithDefaults(pipelineEnv);
  let fpBase = getPipelineEnvValue(merged, 'base_train_path');
  fpBase = fpBase.replace(/\{model_name\}/g, task.modelName);
  const trimmed = fpBase.replace(/\/+$/, '');
  return `${trimmed}/${task.modelName}{run_id}/model_prediction/predict_result.parquet`;
}

function DataSourceConfigPanel({ task, onPatchPipelineEnvRow, readOnly }: NodePanelEnvProps) {
  const mergedEnv = React.useMemo(
    () => mergePipelineEnvWithDefaults(task.pipelineEnv),
    [task.pipelineEnv],
  );

  const [sourceType, setSourceType] = useState<'hive' | 's3'>('hive');
  const [sampleMode, setSampleMode] = useState<'use_existing' | 'auto_generate'>('use_existing');
  const [trainRatio, setTrainRatio] = useState('0.70');
  const [testRatio, setTestRatio] = useState('0.15');
  const [valRatio, setValRatio] = useState('0.15');
  const [randomSeed, setRandomSeed] = useState('42');

  const [tableScheme, setTableScheme] = useState('dw_feature');
  const [tableName, setTableName] = useState('user_credit_features_v12');
  const [customFilter, setCustomFilter] = useState('dt = \'2025-03-01\' AND sample_flag IN (\'train\', \'test\')');
  const [s3Path, setS3Path] = useState('s3://ml-data/credit/features/v12/');

  const [labelCol, setLabelCol] = useState(() => getPipelineEnvValue(mergedEnv, 'label_column'));
  const [categoricalCol, setCategoricalCol] = useState(() => getPipelineEnvValue(mergedEnv, 'categorical_columns'));
  const [sampleTypeCol, setSampleTypeCol] = useState(() => getPipelineEnvValue(mergedEnv, 'sample_type_column'));

  useEffect(() => {
    const m = mergePipelineEnvWithDefaults(task.pipelineEnv);
    setLabelCol(getPipelineEnvValue(m, 'label_column'));
    setCategoricalCol(getPipelineEnvValue(m, 'categorical_columns'));
    setSampleTypeCol(getPipelineEnvValue(m, 'sample_type_column'));
  }, [task.id, task.pipelineEnv]);

  const schemaReady = tableScheme.trim() !== '' && tableName.trim() !== '';
  const availableCols = schemaReady ? MOCK_HIVE_COLUMNS : [];
  const colOptionsForSample = sourceType === 'hive' ? availableCols : MOCK_HIVE_COLUMNS;
  const sampleColsDisabled = sourceType === 'hive' ? !schemaReady : false;

  const outputPath = buildDataSourceLoadedOutputPath(task, task.pipelineEnv);

  const inputCls = `w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700
    focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20 transition-colors
    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300`;
  const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1';

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <NodeConfigBand title="Input data path">
        <div>
          <p className={labelCls}>Source Type</p>
          <div className="flex gap-2">
            {(['hive', 's3'] as const).map(t => (
              <button
                key={t}
                type="button"
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
            <div>
              <p className={labelCls}><Table2 size={10} />table_scheme</p>
              <input
                value={tableScheme}
                onChange={e => setTableScheme(e.target.value)}
                disabled={readOnly}
                placeholder="e.g. dw_feature"
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}><Table2 size={10} />table_name</p>
              <input
                value={tableName}
                onChange={e => setTableName(e.target.value)}
                disabled={readOnly}
                placeholder="e.g. user_credit_features_v12"
                className={inputCls}
              />
            </div>
            <div>
              <p className={labelCls}>custom_filter</p>
              <textarea
                value={customFilter}
                onChange={e => setCustomFilter(e.target.value)}
                disabled={readOnly}
                rows={3}
                placeholder={"e.g. dt = '2025-03-01' AND\nsample_flag IN ('train','test')"}
                className={`w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700
                  font-mono resize-none focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1
                  focus:ring-[#13c2c2]/20 transition-colors leading-relaxed
                  disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300`}
              />
            </div>
          </>
        ) : (
          <div>
            <p className={labelCls}><FolderOpen size={10} />s3_path</p>
            <input
              value={s3Path}
              onChange={e => setS3Path(e.target.value)}
              disabled={readOnly}
              placeholder="s3://bucket/prefix/"
              className={inputCls}
            />
          </div>
        )}
      </NodeConfigBand>

      <NodeConfigBand title="Node configuration">
        <SampleTypeColumnSection
          mode={sampleMode}
          onModeChange={setSampleMode}
          colValue={sampleTypeCol}
          onColChange={setSampleTypeCol}
          colOptions={colOptionsForSample}
          colsDisabled={sampleColsDisabled}
          trainRatio={trainRatio}
          testRatio={testRatio}
          valRatio={valRatio}
          onTrainRatio={setTrainRatio}
          onTestRatio={setTestRatio}
          onValRatio={setValRatio}
          randomSeed={randomSeed}
          onRandomSeedChange={setRandomSeed}
          readOnly={readOnly}
        />
        <div>
          <p className={labelCls}>
            label_col
            <FieldTooltip text="Defaults from pipeline ENV label_column; editable per node." />
          </p>
          {sourceType === 'hive' ? (
            <ColSelect
              value={labelCol}
              onChange={setLabelCol}
              options={availableCols}
              disabled={readOnly || !schemaReady}
              placeholder={schemaReady ? '— select column —' : '— fill schema to load columns —'}
            />
          ) : (
            <ColSelect
              value={labelCol}
              onChange={setLabelCol}
              options={MOCK_HIVE_COLUMNS}
              disabled={readOnly}
              placeholder="— select column —"
            />
          )}
        </div>
        <div>
          <p className={labelCls}>
            categorical_columns
            <FieldTooltip text="Same format as pipeline ENV categorical_columns (JSON array string or comma-separated)." />
          </p>
          <textarea
            value={categoricalCol}
            onChange={e => setCategoricalCol(e.target.value)}
            disabled={readOnly}
            rows={2}
            placeholder='e.g. ["col_a","col_b"] or col_a,col_b'
            className={`w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-mono text-slate-700 resize-none
              focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20
              disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:text-slate-300`}
          />
        </div>
      </NodeConfigBand>

      <NodeResourceAdvBlock
        readOnly={readOnly}
        pipelineEnv={task.pipelineEnv}
        onPatchEnv={onPatchPipelineEnvRow}
      />

      <NodeConfigBand title="Output path">
        <div>
          <p className={labelCls}>data_format</p>
          <div className="h-8 px-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center text-xs font-mono text-slate-500">
            parquet
          </div>
        </div>
        <CopyPathField
          label="loaded_data_path (S3 / resolved)"
          path={outputPath}
          labelCls={labelCls}
        />
      </NodeConfigBand>
    </div>
  );
}

/* ────────���────── Regular node panel ─────────────── */
function RegularNodePanel({ node, lastRunMap, propOverrides, readOnly, task, onPatchPipelineEnvRow, dagNodes, dagEdges }: {
  node: DagNode;
  lastRunMap: LastRunMap;
  propOverrides?: Partial<Record<NodeType, { label: string; value: string }[]>>;
  readOnly?: boolean;
  task: TrainingTask;
  onPatchPipelineEnvRow: (key: string, value: string) => void;
  dagNodes: DagNode[];
  dagEdges: DagEdge[];
}) {
  const style = NODE_STYLES[node.type] ?? NODE_STYLES.data_source;
  const [activeTab, setActiveTab] = useState<'config' | 'lastrun'>('config');
  const [showBinning, setShowBinning] = useState(false);
  const [showFeatureReport, setShowFeatureReport] = useState(false);
  const [showSelectionReport, setShowSelectionReport] = useState(false);

  const props = propOverrides?.[node.type] ?? DEFAULT_PROPS[node.type] ?? [];
  const runInfo = lastRunMap[node.type];

  const mergedPanelEnv = React.useMemo(() => mergePipelineEnvWithDefaults(task.pipelineEnv), [task.pipelineEnv]);
  const woeTransformFeatureReportConfigOn =
    getPipelineEnvValue(mergedPanelEnv, WOE_TRANSFORM_FEATURE_REPORT_ENV).toLowerCase() !== 'false';
  const woeTransformReportTabs = parseReportTabsJson(getPipelineEnvValue(mergedPanelEnv, WOE_TRANSFORM_REPORT_TABS_ENV));
  const woeTransformStabilityDim = getPipelineEnvValue(mergedPanelEnv, WOE_TRANSFORM_STABILITY_DIM_ENV).trim() || 'user_id';

  const lastRunFeatureReportArtifactOn = (() => {
    if (!runInfo?.artifact?.length) return false;
    const fr = runInfo.artifact.find((a) => a.label === 'feature_report')?.value?.trim().toLowerCase() ?? '';
    const p = runInfo.artifact.find((a) => a.label === 'feature_report_save_path')?.value?.trim() ?? '';
    return fr === 'on' && p !== '' && p !== '—';
  })();

  const fsActiveMethods = parseFsMethodsJson(getPipelineEnvValue(mergedPanelEnv, FEATURE_SELECTION_SELECT_METHODS_ENV));
  const fsIvThreshold = (() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedPanelEnv, FEATURE_SELECTION_IV_THRESHOLD_ENV));
    return Number.isFinite(n) ? n : 0.02;
  })();
  const fsCorrThreshold = (() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedPanelEnv, FEATURE_SELECTION_CORR_THRESHOLD_ENV));
    return Number.isFinite(n) ? n : 0.7;
  })();
  const fsPsiThreshold = (() => {
    const n = Number.parseFloat(getPipelineEnvValue(mergedPanelEnv, FEATURE_SELECTION_PSI_THRESHOLD_ENV));
    return Number.isFinite(n) ? n : 0.1;
  })();
  const lastRunHasSelectionReport = (() => {
    if (!runInfo?.artifact?.length) return false;
    const p = runInfo.artifact.find((a) => a.label === 'Report path')?.value?.trim() ?? '';
    return p !== '' && p !== '—';
  })();

  const statusStyle: Record<string, { dot: string; text: string; bg: string }> = {
    SUCCESS: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    FAILED:  { dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
    RUNNING: { dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
    SKIPPED: { dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
  };

  return (
    <div className="flex min-h-0 flex-col h-full">
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
            <DataSourceConfigPanel task={task} onPatchPipelineEnvRow={onPatchPipelineEnvRow} readOnly={readOnly} />
          ) : node.type === 'woe_fit' ? (
            <WoeFitConfigPanel
              task={task}
              onPatchPipelineEnvRow={onPatchPipelineEnvRow}
              readOnly={readOnly}
              woeFitDagContext={{ woeFitNodeId: node.id, nodes: dagNodes, edges: dagEdges }}
            />
          ) : node.type === 'woe_transform' ? (
            <WoeTransformConfigPanel
              task={task}
              onPatchPipelineEnvRow={onPatchPipelineEnvRow}
              readOnly={readOnly}
              woeTransformDagContext={{ woeTransformNodeId: node.id, nodes: dagNodes, edges: dagEdges }}
            />
          ) : node.type === 'feature_selection' ? (
            <FeatureSelectionConfigPanel
              task={task}
              onPatchPipelineEnvRow={onPatchPipelineEnvRow}
              readOnly={readOnly}
              featureSelectionDagContext={{ featureSelectionNodeId: node.id, nodes: dagNodes, edges: dagEdges }}
            />
          ) : node.type === 'tune_train' ? (
            <ModelTuneConfigPanel
              task={task}
              onPatchPipelineEnvRow={onPatchPipelineEnvRow}
              readOnly={readOnly}
              tuneTrainDagContext={{ tuneTrainNodeId: node.id, nodes: dagNodes, edges: dagEdges }}
            />
          ) : node.type === 'infer' ? (
            <ModelInferenceConfigPanel
              task={task}
              onPatchPipelineEnvRow={onPatchPipelineEnvRow}
              readOnly={readOnly}
              modelPredictionDagContext={{ modelPredictionNodeId: node.id, nodes: dagNodes, edges: dagEdges }}
            />
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
            {/* View WOE Binning — WOE fit only */}
            {node.type === 'woe_fit' && (
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
            {node.type === 'woe_transform' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowFeatureReport(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                    bg-gradient-to-r from-[#13c2c2]/10 to-cyan-50
                    border border-[#13c2c2]/30 hover:border-[#13c2c2] hover:from-[#13c2c2]/15 hover:to-cyan-100/80
                    text-[#13c2c2] hover:text-[#0d9e9e] transition-all group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#13c2c2]/15 border border-[#13c2c2]/30 flex items-center justify-center shrink-0 group-hover:bg-[#13c2c2]/25 transition-colors">
                    <FileText size={14} className="text-[#13c2c2]" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold">View feature report</p>
                    <p className="text-[10px] text-[#13c2c2]/70 mt-0.5">Performance · trend · stability · mono →</p>
                  </div>
                </button>
                {showFeatureReport && (
                  <FeatureReportModal
                    onClose={() => setShowFeatureReport(false)}
                    runId={runInfo?.runId ?? '—'}
                    configFeatureReportOn={woeTransformFeatureReportConfigOn}
                    reportTabs={woeTransformReportTabs}
                    stabilityDimLabel={woeTransformStabilityDim}
                    lastRunFeatureReportOn={lastRunFeatureReportArtifactOn}
                  />
                )}
              </>
            )}
            {node.type === 'feature_selection' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSelectionReport(true)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                    bg-gradient-to-r from-[#13c2c2]/10 to-cyan-50
                    border border-[#13c2c2]/30 hover:border-[#13c2c2] hover:from-[#13c2c2]/15 hover:to-cyan-100/80
                    text-[#13c2c2] hover:text-[#0d9e9e] transition-all group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#13c2c2]/15 border border-[#13c2c2]/30 flex items-center justify-center shrink-0 group-hover:bg-[#13c2c2]/25 transition-colors">
                    <Filter size={14} className="text-[#13c2c2]" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold">View selection report</p>
                    <p className="text-[10px] text-[#13c2c2]/70 mt-0.5">selection_report · pass/fail per method →</p>
                  </div>
                </button>
                {showSelectionReport && (
                  <FeatureSelectionReportModal
                    onClose={() => setShowSelectionReport(false)}
                    runId={runInfo?.runId ?? '—'}
                    activeMethods={fsActiveMethods}
                    ivThreshold={fsIvThreshold}
                    corrThreshold={fsCorrThreshold}
                    psiThreshold={fsPsiThreshold}
                    lastRunHasSelectionReport={lastRunHasSelectionReport}
                  />
                )}
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
function PropertyPanel({ node, lastRunMap, propOverrides, readOnly, task, onPatchPipelineEnvRow, dagNodes, dagEdges }: {
  node: DagNode | null;
  lastRunMap: LastRunMap;
  propOverrides?: Partial<Record<NodeType, { label: string; value: string }[]>>;
  readOnly?: boolean;
  task: TrainingTask;
  onPatchPipelineEnvRow: (key: string, value: string) => void;
  dagNodes: DagNode[];
  dagEdges: DagEdge[];
}) {
  if (!node) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 px-6">
      <Settings size={28} />
      <p className="text-sm text-center text-slate-400">Click a pipeline node to view<br />and configure its properties</p>
    </div>
  );
  return (
    <RegularNodePanel
      node={node}
      lastRunMap={lastRunMap}
      propOverrides={propOverrides}
      readOnly={readOnly}
      task={task}
      onPatchPipelineEnvRow={onPatchPipelineEnvRow}
      dagNodes={dagNodes}
      dagEdges={dagEdges}
    />
  );
}

/* ─────────────── Validation ─────────────── */
interface CheckResult { passed: boolean; items: { label: string; ok: boolean; detail: string }[]; }

function runFrontendCheck(nodes: DagNode[], edges: DagEdge[]): CheckResult {
  const hasSource    = nodes.some(n => n.type === 'data_source');
  const hasTrain     = nodes.some(n => n.type === 'tune_train');
  const hasOutput    = nodes.some(n => n.type === 'infer');
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
    { label: 'LGBM tune & train exists', ok: hasTrain,     detail: hasTrain     ? 'LGBM tune & train node found'     : 'Add an LGBM tune & train node' },
    { label: 'Model Prediction node exists', ok: hasOutput, detail: hasOutput ? 'Model prediction node on canvas' : 'Add a model prediction node' },
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
    data_source:       '#93c5fd',
    woe_fit:           '#93c5fd',
    woe_transform:     '#93c5fd',
    feature_selection: '#93c5fd',
    tune_train:        '#fcd34d',
    infer:             '#fcd34d',
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
    if (node.type === 'tune_train' && node.sublabel.toLowerCase().includes('bayesopt')) {
      errorMessages.push({
        nodeId: node.id,
        message: 'BayesOpt requires ≥ 100 trials for reliable convergence (currently 50)',
      });
    }
    if (node.status === 'locked' && mode === 'from_start') {
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

function PipelineEnvModal({
  rows,
  onChangeRows,
  onClose,
  onApply,
}: {
  rows: PipelineEnvRow[];
  onChangeRows: React.Dispatch<React.SetStateAction<PipelineEnvRow[]>>;
  onClose: () => void;
  onApply: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Pipeline ENV</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Parameters · Description · Value</p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  <th className="px-3 py-2.5 w-[22%]">Parameters</th>
                  <th className="px-3 py-2.5 w-[38%]">Description</th>
                  <th className="px-3 py-2.5 w-[32%]">Value</th>
                  <th className="px-3 py-2.5 w-[8%]" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-16 text-center">
                      <Inbox size={36} className="mx-auto text-slate-200 mb-2" strokeWidth={1.25} />
                      <p className="text-sm text-slate-400">No Data</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={index} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <input
                            type="text"
                            value={row.name}
                            onChange={e =>
                              onChangeRows(prev =>
                                prev.map((r, j) => (j === index ? { ...r, name: e.target.value } : r))
                              )
                            }
                            placeholder="PARAM_NAME"
                            className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20"
                          />
                          {row.description ? (
                            <FieldTooltip text={row.description} />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[min(38vw,14rem)]">
                        <input
                          type="text"
                          value={row.description}
                          title={row.description}
                          onChange={e =>
                            onChangeRows(prev =>
                              prev.map((r, j) => (j === index ? { ...r, description: e.target.value } : r))
                            )
                          }
                          placeholder="Description"
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20 block overflow-hidden text-ellipsis whitespace-nowrap"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.value}
                          onChange={e =>
                            onChangeRows(prev =>
                              prev.map((r, j) => (j === index ? { ...r, value: e.target.value } : r))
                            )
                          }
                          placeholder="Value"
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 focus:outline-none focus:border-[#13c2c2]/60 focus:ring-1 focus:ring-[#13c2c2]/20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          title="Remove row"
                          onClick={() => onChangeRows(prev => prev.filter((_, j) => j !== index))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={() => onChangeRows(prev => [...prev, { name: '', description: '', value: '' }])}
            className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-white hover:border-[#13c2c2]/40 flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} className="text-[#13c2c2]" />
            Add row
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              className="h-8 px-5 rounded-lg bg-[#13c2c2] text-white text-xs font-semibold hover:bg-[#10a3a3] transition-colors shadow-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
export function ConfigDetailPage({ task: initialTask, onBack, onPersistDraft, onSave, runInstance, onBackToConfig, onKill, onRunCreated }: ConfigDetailPageProps) {
  const { nodes: initNodes, edges } = buildDefaultDag();
  const [task, setTask]             = useState<TrainingTask>(initialTask);
  useEffect(() => {
    setTask({
      ...initialTask,
      pipelineEnv: mergePipelineEnvWithDefaults(initialTask.pipelineEnv),
    });
  }, [initialTask.id]);
  // Guard: if stored nodes contain stale types (e.g. from HMR state preservation), reset to fresh DAG
  const [nodes, setNodes]           = useState<DagNode[]>(() => {
    return initNodes;
  });
  // Fresh DAG labels/structure when switching experiments (avoids stale canvas state).
  useEffect(() => {
    setNodes(buildDefaultDag().nodes);
  }, [initialTask.id]);
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
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envModalRows, setEnvModalRows] = useState<PipelineEnvRow[]>([]);
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
      if (showSettingsModal)   { setShowSettingsModal(false); return; }
      if (showEnvModal)             { setShowEnvModal(false); return; }
      if (showExpMetaEditModal)     { setShowExpMetaEditModal(false); return; }
      if (showCheckPanel)           { setShowCheckPanel(false); return; }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showTriggerModal, showSettingsModal, showEnvModal, showExpMetaEditModal, showCheckPanel]);

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
    <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden bg-slate-100">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center shrink-0">
        {/* Left */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <button
            onClick={() => {
              if (!isRunView && !isRunHistoryView) onPersistDraft?.(task);
              onBack();
            }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#13c2c2] transition-colors group shrink-0"
          >
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
        {showSettingsModal && (
          <SettingsModal
            onClose={() => setShowSettingsModal(false)}
            execConfig={execConfig}
            onSaveExec={patch => setExecConfig(prev => ({ ...prev, ...patch }))}
            scheduleConfig={scheduleConfig}
            onUpdateSchedule={setScheduleConfig}
            readOnly={isRunHistoryView || isRunView}
          />
        )}
        {showEnvModal && (
          <PipelineEnvModal
            rows={envModalRows}
            onChangeRows={setEnvModalRows}
            onClose={() => setShowEnvModal(false)}
            onApply={() => {
              setTask((prev) => ({
                ...prev,
                pipelineEnv: mergePipelineEnvWithDefaults(envModalRows).map((r) => ({ ...r })),
              }));
              setShowEnvModal(false);
            }}
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
                onClick={() => {
                  setEnvModalRows(mergePipelineEnvWithDefaults(task.pipelineEnv).map((r) => ({ ...r })));
                  setShowEnvModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 border border-slate-200 bg-white rounded-lg hover:border-[#13c2c2]/60 hover:text-[#0d9e9e] transition-all shadow-sm"
              >
                ENV
              </button>

              <button
                type="button"
                title="Settings"
                aria-label="Settings"
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-800 border-2 border-teal-400/80 bg-teal-50/70 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all shadow-sm"
              >
                Settings
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
        <div
          className="min-h-0 h-full overflow-hidden bg-white border-l border-slate-200 flex flex-col shrink-0"
          style={{ width: CONFIG_PANEL_WIDTH_PX }}
        >
          <PropertyPanel
            node={selectedNode}
            lastRunMap={effectiveLastRunMap}
            propOverrides={effectivePropOverrides}
            readOnly={isRunHistoryView || isRunView}
            task={task}
            dagNodes={effectiveNodes}
            dagEdges={edges}
            onPatchPipelineEnvRow={(key, value) => {
              setTask(prev => ({ ...prev, pipelineEnv: upsertPipelineEnvRow(prev.pipelineEnv, key, value) }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
