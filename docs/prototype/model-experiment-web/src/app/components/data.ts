export type InstanceStatus = 'QUEUING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'KILLED';
export type Region = 'SG' | 'ID' | 'TH' | 'MY' | 'PH' | 'VN';
export type Framework = 'XGBoost' | 'LightGBM' | 'TensorFlow' | 'PyTorch' | 'Benchmark';
export type BizTeam = 'DataSci' | 'Policy' | 'AntiFraud' | 'RiskData' | 'Aimos' | 'MoneeAlgo';
export type Template = 'woe_tune_train' | 'model_inference' | 'Custom';

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
  owner: string;
  bizTeam: BizTeam;
  description: string;
  createTime: string;
  updateTime: string;
  instances: TaskInstance[];
  history: HistoryVersion[];
}

export const REGIONS: Region[] = ['SG', 'ID', 'TH', 'MY', 'PH', 'VN'];
export const FRAMEWORKS: Framework[] = ['XGBoost', 'LightGBM', 'TensorFlow', 'PyTorch', 'Benchmark'];
export const BIZ_TEAMS: BizTeam[] = ['DataSci', 'Policy', 'AntiFraud', 'RiskData', 'Aimos', 'MoneeAlgo'];
export const TEMPLATES: Template[] = ['woe_tune_train', 'model_inference', 'Custom'];

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

export const initialMockTasks: TrainingTask[] = [
  {
    id: 't1',
    taskName: 'XGBoost Churn Narrow',
    modelName: 'sg_churn_acard',
    modelVersion: 'v3',
    region: 'SG',
    status: 'ENABLED',
    framework: 'XGBoost',
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