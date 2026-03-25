export type ModelLevel = 'sub' | 'mega';

export type TaskStatus = 'DRAFT' | 'ENABLED' | 'DISABLED';
export type InstanceStatus = 'QUEUING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'KILLED';
export type Region = 'SG' | 'ID' | 'TH' | 'MY' | 'PH' | 'VN';
export type Framework = 'XGBoost' | 'LightGBM' | 'TensorFlow' | 'PyTorch' | 'Benchmark';
export type BizTeam = 'DataSci' | 'Policy' | 'AntiFraud' | 'RiskData' | 'Aimos' | 'MoneeAlgo';

/** Model Experiment–level ENV row (Parameters / Description / Value). */
export interface PipelineEnvRow {
  name: string;
  description: string;
  value: string;
}

export interface RegisteredModel {
  name: string;
  regionTag: Region;
  versions: string[];
}

export interface ArtifactData {
  parameters: Record<string, string | number>;
  metrics: Record<string, number>;
}

export interface TaskInstance {
  id: string;
  taskId: string;
  status: InstanceStatus;
  bindTask: string;
  notes?: string;
  triggerTime: string;
  startTime: string;
  finishTime: string;
  duration: string;
  rayVersion?: string;
  artifacts?: ArtifactData;
}

export interface HistoryVersion {
  version: string;
  createdAt: string;
  createdBy: string;
  config: Record<string, unknown>;
}

export interface TrainingTask {
  id: string;
  taskName: string;
  modelName: string;
  modelVersion?: string;
  region: Region;
  status: TaskStatus;
  framework: Framework;
  /** Partner pipeline model_level; immutable after create in product spec. */
  modelLevel: ModelLevel;
  owner: string;
  bizTeam: BizTeam;
  description: string;
  createTime: string;
  updateTime: string;
  instances: TaskInstance[];
  history: HistoryVersion[];
  /** Optional: copy-from / align-with experiment name (visible experiments only). */
  templateExperimentName?: string;
  /** Pipeline-level global variables for this experiment. */
  pipelineEnv?: PipelineEnvRow[];
}

const EXCLUDE_COLUMNS_DEFAULT_JSON = JSON.stringify([
  'userid', 'activation_term', 'label_dpd30_3term', 'user_create_time',
  'mp_order_create_time', 'dp_order_create_time', 'mp_lgx_create_time',
  'mp_item_create_time', 'activation_date', 'sample_use', 'credit_user_id',
  'airpay_user_id', 'grass_date', 'score_date', 'user_type', 'sample_type',
  '1term_dpd12', '1term_dpd30', '2term_dpd30', '3term_dpd30',
  'activation_month', 'bill_term', 'bill_date', 'clear_date',
  'overdue_date', '2term_max_overdue_date', '3term_max_overdue_date',
  'spl_bill_day', 'spl_overdue_day', 'spl_bill_cnt', 'is_overdue',
  'is_acct_frozen', 'has_airpay', 'has_device', 'has_contact',
  'spl_bill_num', 'spl_frozen_tag', 'spl_overdue_tag', 'bcl_ascore',
  'bcl_credit_behavior_subscore', 'bcl_user_and_order_subscore',
  'bcl_ecomm_behavior_subscore', 'bcl_payment_subscore',
  'bcl_device_and_app_subscore', 'first_activation_month',
  'first_activation_time', 'first_activation_week', 'is_cod_user',
]);

const REMOVED_FEATURES_DEFAULT_JSON = JSON.stringify([
  'user_has_set_up_password', 'device_hf_app_version_01', 'user_phone',
]);

const CATEGORICAL_COLUMNS_DEFAULT_JSON = JSON.stringify([
  'user_acct_status', 'user_is_email_verified', 'user_gender',
]);

/** Partner pipeline-level keys (frontend_node_config_spec_latest.md). */
export function getDefaultPipelineEnvRows(): PipelineEnvRow[] {
  return [
    {
      name: 'base_train_path',
      description: 'Root path for training data in this pipeline.',
      value: '{fp_data}/{model_name}/{run_id}',
    },
    {
      name: 'label_column',
      description: 'Global label column name (default for all nodes). Nodes may override via data_config.label_column.',
      value: 'label_dpd30_3term',
    },
    {
      name: 'categorical_columns',
      description: 'Global categorical column names (default for all nodes). Nodes may override via data_config.categorical_columns.',
      value: CATEGORICAL_COLUMNS_DEFAULT_JSON,
    },
    {
      name: 'sample_type_column',
      description: 'Column name for sample split; values include train / test / val / all.',
      value: 'sample_type',
    },
    {
      name: 'exclude_columns',
      description: 'Global exclude list (not used in training but kept in data). Nodes may append excludes without replacing global.',
      value: EXCLUDE_COLUMNS_DEFAULT_JSON,
    },
    {
      name: 'removed_features',
      description: 'Feature-group level removal list (manually defined).',
      value: REMOVED_FEATURES_DEFAULT_JSON,
    },
    {
      name: 'default_cpu',
      description: 'Default CPU cores when a node does not specify.',
      value: '4',
    },
    {
      name: 'default_memory',
      description: 'Default memory size when a node does not specify.',
      value: '8',
    },
    {
      name: 'default_image',
      description: 'Default Docker image when a node does not specify.',
      value: 'risk-model-training:latest',
    },
  ];
}

/** Merge stored ENV with spec defaults: keep user rows by name, fill missing keys. */
export function mergePipelineEnvWithDefaults(rows: PipelineEnvRow[] | undefined): PipelineEnvRow[] {
  const defaults = getDefaultPipelineEnvRows();
  const map = new Map((rows ?? []).map((r) => [r.name, r]));
  const merged = defaults.map((d) => {
    const ex = map.get(d.name);
    if (!ex) return { ...d };
    return {
      name: d.name,
      description: ex.description?.trim() ? ex.description : d.description,
      value: ex.value,
    };
  });
  const extra = (rows ?? []).filter((r) => !defaults.some((d) => d.name === r.name));
  return [...merged, ...extra];
}

export function getPipelineEnvValue(rows: PipelineEnvRow[] | undefined, key: string): string {
  const hit = rows?.find((r) => r.name === key);
  if (hit && hit.value !== '') return hit.value;
  const d = getDefaultPipelineEnvRows().find((r) => r.name === key);
  return d?.value ?? '';
}

export function upsertPipelineEnvRow(
  rows: PipelineEnvRow[] | undefined,
  key: string,
  value: string,
): PipelineEnvRow[] {
  const base = mergePipelineEnvWithDefaults(rows);
  return base.map((r) => (r.name === key ? { ...r, value } : r));
}

export const REGIONS: Region[] = ['SG', 'ID', 'TH', 'MY', 'PH', 'VN'];
export const FRAMEWORKS: Framework[] = ['XGBoost', 'LightGBM', 'TensorFlow', 'PyTorch', 'Benchmark'];
export const BIZ_TEAMS: BizTeam[] = ['DataSci', 'Policy', 'AntiFraud', 'RiskData', 'Aimos', 'MoneeAlgo'];

export const ALL_OWNERS = ['alice', 'bob', 'carol', 'david', 'eve', 'frank', 'grace', 'henry'];

export const REGISTERED_MODELS: RegisteredModel[] = [
  { name: 'sg_churn_acard',     regionTag: 'SG', versions: ['v4', 'v3', 'v2', 'v1'] },
  { name: 'sg_score_acard',     regionTag: 'SG', versions: ['v2', 'v1'] },
  { name: 'sg_risk_bcard',      regionTag: 'SG', versions: ['v5', 'v4', 'v3', 'v2', 'v1'] },
  { name: 'id_ltv_acard',       regionTag: 'ID', versions: ['v3', 'v2', 'v1'] },
  { name: 'id_fraud_bcard',     regionTag: 'ID', versions: ['v2', 'v1'] },
  { name: 'th_fraud_acard',     regionTag: 'TH', versions: ['v6', 'v5', 'v4', 'v3', 'v2', 'v1'] },
  { name: 'my_nlp_acard',       regionTag: 'MY', versions: ['v1'] },
  { name: 'my_churn_bcard',     regionTag: 'MY', versions: ['v3', 'v2', 'v1'] },
  { name: 'ph_demand_acard',    regionTag: 'PH', versions: ['v2', 'v1'] },
  { name: 'vn_retention_acard', regionTag: 'VN', versions: ['v4', 'v3', 'v2', 'v1'] },
  { name: 'vn_score_bcard',     regionTag: 'VN', versions: ['v2', 'v1'] },
];

export const CURRENT_USER = 'alice';
export const IS_ADMIN = false;

/** Experiments the current operator may use as Template (same visibility as list). */
export function filterExperimentsVisibleToOperator(allTasks: TrainingTask[]): TrainingTask[] {
  if (IS_ADMIN) return allTasks;
  return allTasks.filter((t) => {
    const owners = t.owner.split(',').map((s) => s.trim()).filter(Boolean);
    return owners.includes(CURRENT_USER);
  });
}

function seedPipelineEnv(): PipelineEnvRow[] {
  return getDefaultPipelineEnvRows().map((r) => ({ ...r }));
}

export const initialMockTasks: TrainingTask[] = [
  {
    id: 't1',
    taskName: 'XGBoost Churn Narrow',
    modelName: 'sg_churn_acard',
    modelVersion: 'v3',
    region: 'SG',
    status: 'ENABLED',
    framework: 'XGBoost',
    modelLevel: 'sub',
    pipelineEnv: seedPipelineEnv(),
    owner: 'alice',
    bizTeam: 'RiskData',
    description: 'Narrow search space for churn prediction model with balanced dataset',
    createTime: '2025-02-28 09:00:00',
    updateTime: '2025-03-01 08:00:00',
    history: [
      {
        version: 'V3', createdAt: '2025-03-01 08:00', createdBy: 'alice',
        config: { max_depth: [3, 6], learning_rate: [0.01, 0.1], n_estimators: 200, subsample: 0.8, colsample_bytree: 0.8, objective: 'binary:logistic' }
      },
      {
        version: 'V2', createdAt: '2025-02-25 10:00', createdBy: 'alice',
        config: { max_depth: [3, 8], learning_rate: [0.01, 0.2], n_estimators: 150, subsample: 0.7, colsample_bytree: 0.7, objective: 'binary:logistic' }
      },
      {
        version: 'V1', createdAt: '2025-02-20 09:00', createdBy: 'alice',
        config: { max_depth: 6, learning_rate: 0.1, n_estimators: 100, objective: 'binary:logistic' }
      },
    ],
    instances: [
      {
        id: 'inst-101', taskId: 't1', status: 'SUCCESS', bindTask: 'V3',
        notes: 'Narrowed depth range to [3,6], reduced colsample to 0.8 for better generalization',
        triggerTime: '2025-03-01 09:00', startTime: '2025-03-01 09:02',
        finishTime: '2025-03-01 10:15', duration: '1h 13m',
        rayVersion: '2.10.0',
        artifacts: {
          parameters: { max_depth: 5, learning_rate: 0.05, n_estimators: 200, subsample: 0.8, colsample_bytree: 0.8 },
          metrics: { auc: 0.8923, f1: 0.7654, precision: 0.789, recall: 0.7432, logloss: 0.3211 }
        }
      },
      {
        id: 'inst-102', taskId: 't1', status: 'RUNNING', bindTask: 'V3',
        notes: 'Re-run with same V3 config to verify reproducibility after env upgrade',
        triggerTime: '2025-03-02 08:00', startTime: '2025-03-02 08:05',
        finishTime: '-', duration: '-',
        rayVersion: '2.10.0',
      },
      {
        id: 'inst-103', taskId: 't1', status: 'QUEUING', bindTask: 'V3',
        triggerTime: '2025-03-02 07:00', startTime: '-',
        finishTime: '-', duration: '-',
        rayVersion: '2.9.3',
      },
    ]
  },
  {
    id: 't2',
    taskName: 'LightGBM LTV Wide',
    modelName: 'id_ltv_acard',
    modelVersion: 'v2',
    region: 'ID',
    status: 'DRAFT',
    framework: 'LightGBM',
    modelLevel: 'sub',
    pipelineEnv: seedPipelineEnv(),
    owner: 'bob',
    bizTeam: 'DataSci',
    description: 'Wide search for LTV model with extended feature set and cross-validation',
    createTime: '2025-03-01 11:00:00',
    updateTime: '2025-03-01 11:00:00',
    history: [
      {
        version: 'V1', createdAt: '2025-03-01 11:00', createdBy: 'bob',
        config: { num_leaves: [31, 127], learning_rate: [0.01, 0.1], n_estimators: 300, feature_fraction: 0.9, bagging_fraction: 0.8, objective: 'regression' }
      },
    ],
    instances: []
  },
  {
    id: 't3',
    taskName: 'XGBoost Fraud A',
    modelName: 'th_fraud_acard',
    modelVersion: 'v5',
    region: 'TH',
    status: 'DISABLED',
    framework: 'XGBoost',
    modelLevel: 'sub',
    pipelineEnv: seedPipelineEnv(),
    owner: 'alice',
    bizTeam: 'AntiFraud',
    description: 'Fraud detection experiment A with balanced sampling and SMOTE oversampling',
    createTime: '2025-02-20 10:00:00',
    updateTime: '2025-02-25 09:00:00',
    history: [
      {
        version: 'V2', createdAt: '2025-02-24 09:00', createdBy: 'alice',
        config: { max_depth: [4, 8], learning_rate: [0.01, 0.05], n_estimators: 500, scale_pos_weight: 10 }
      },
      {
        version: 'V1', createdAt: '2025-02-20 10:00', createdBy: 'alice',
        config: { max_depth: 6, learning_rate: 0.05, n_estimators: 300 }
      },
    ],
    instances: [
      {
        id: 'inst-201', taskId: 't3', status: 'FAILED', bindTask: 'V2',
        notes: 'Added SMOTE oversampling and scale_pos_weight=10; OOM on trial #23 due to memory spike',
        triggerTime: '2025-02-24 14:00', startTime: '2025-02-24 14:02',
        finishTime: '2025-02-24 15:30', duration: '1h 28m',
        rayVersion: '2.9.1',
      },
    ]
  },
  {
    id: 't4',
    taskName: 'Mega Score Fusion',
    modelName: 'sg_score_acard',
    modelVersion: 'v1',
    region: 'SG',
    status: 'DRAFT',
    framework: 'Benchmark',
    modelLevel: 'mega',
    pipelineEnv: seedPipelineEnv(),
    owner: 'bob',
    bizTeam: 'Aimos',
    description: 'Fuse user_score and order_score for overall purchase probability ranking',
    createTime: '2025-03-02 14:00:00',
    updateTime: '2025-03-02 14:00:00',
    history: [],
    instances: []
  },
  {
    id: 't5',
    taskName: 'PyTorch NLP Classifier',
    modelName: 'my_nlp_acard',
    modelVersion: 'v1',
    region: 'MY',
    status: 'ENABLED',
    framework: 'PyTorch',
    modelLevel: 'sub',
    pipelineEnv: seedPipelineEnv(),
    owner: 'carol',
    bizTeam: 'MoneeAlgo',
    description: 'Multi-label text classifier for Malay product categorization using BERT',
    createTime: '2025-02-15 09:30:00',
    updateTime: '2025-03-01 07:00:00',
    history: [
      {
        version: 'V3', createdAt: '2025-03-01 07:00', createdBy: 'carol',
        config: { hidden_size: [128, 512], dropout: [0.1, 0.5], lr: [0.0001, 0.001], epochs: 20, batch_size: 32 }
      },
    ],
    instances: [
      {
        id: 'inst-301', taskId: 't5', status: 'QUEUING', bindTask: 'V3',
        notes: 'Extended hidden_size range to [128,512] and increased dropout sweep for regularization test',
        triggerTime: '2025-03-02 09:00', startTime: '-', finishTime: '-', duration: '-',
        rayVersion: '2.10.0',
      },
    ]
  },
  {
    id: 't6',
    taskName: 'TF Demand Forecast',
    modelName: 'ph_demand_acard',
    modelVersion: 'v2',
    region: 'PH',
    status: 'ENABLED',
    framework: 'TensorFlow',
    modelLevel: 'sub',
    pipelineEnv: seedPipelineEnv(),
    owner: 'david',
    bizTeam: 'Policy',
    description: 'Demand forecasting for Philippine market with seasonal decomposition',
    createTime: '2025-02-10 10:00:00',
    updateTime: '2025-02-28 08:00:00',
    history: [
      {
        version: 'V2', createdAt: '2025-02-28 08:00', createdBy: 'david',
        config: { layers: [2, 4], units: [64, 256], dropout: 0.2, epochs: 50, optimizer: 'adam', loss: 'mse' }
      },
    ],
    instances: [
      {
        id: 'inst-401', taskId: 't6', status: 'KILLED', bindTask: 'V2',
        notes: 'Increased model depth to [2,4] layers; killed manually due to upstream data pipeline failure',
        triggerTime: '2025-03-01 06:00', startTime: '2025-03-01 06:03',
        finishTime: '2025-03-01 07:00', duration: '57m',
        rayVersion: '2.8.1',
      },
    ]
  },
  {
    id: 't7',
    taskName: 'LightGBM Retention V2',
    modelName: 'vn_retention_acard',
    modelVersion: 'v4',
    region: 'VN',
    status: 'ENABLED',
    framework: 'LightGBM',
    modelLevel: 'sub',
    pipelineEnv: seedPipelineEnv(),
    owner: 'alice',
    bizTeam: 'RiskData',
    description: 'User retention prediction for Vietnam market with weekly cohort features',
    createTime: '2025-01-28 16:00:00',
    updateTime: '2025-03-01 10:00:00',
    history: [
      {
        version: 'V4', createdAt: '2025-03-01 10:00', createdBy: 'alice',
        config: { num_leaves: [63, 255], learning_rate: [0.005, 0.05], min_child_samples: [20, 100], reg_alpha: [0, 1] }
      },
    ],
    instances: [
      {
        id: 'inst-501', taskId: 't7', status: 'SUCCESS', bindTask: 'V4',
        notes: 'Tuned reg_alpha range and tightened min_child_samples; AUC improved from 0.901 to 0.913',
        triggerTime: '2025-03-01 10:30', startTime: '2025-03-01 10:32',
        finishTime: '2025-03-01 12:15', duration: '1h 43m',
        rayVersion: '2.10.0',
        artifacts: {
          parameters: { num_leaves: 127, learning_rate: 0.02, min_child_samples: 50, reg_alpha: 0.1 },
          metrics: { auc: 0.9134, ks: 0.7823, precision: 0.8341, recall: 0.7901, f1: 0.8115 }
        }
      },
    ]
  },
];