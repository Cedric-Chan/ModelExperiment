export type ModelLevel = 'sub' | 'mega';

export type TaskStatus = 'DRAFT' | 'ENABLED' | 'DISABLED';
export type InstanceStatus =
  | 'QUEUING'
  | 'WAITING'
  | 'RUNNING'
  | 'CHECKING'
  | 'SUCCESS'
  | 'FAILED'
  | 'KILLED';

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

const WOE_MISSING_VALUE_DEFAULT_JSON = JSON.stringify([
  -9999, -9998, -9997, -999998, -999999, 999999, -990000, -999990,
]);

/** Prototype: concrete S3 encoder URI for woe_update input (no template placeholders). */
export const WOE_FIT_WOE_ENCODER_PATH_MOCK = 's3://sg-risk-model-prod/risk/id/spl_acard/acard_model/20240315_v1/woe/encoder/acard_ft_user_v1_best_ks_5bin.pkl';

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
      name: 'sample_weight_column',
      description:
        'Optional global sample weight column; LGBM tune node tune_train_sample_weight_col overrides when non-empty.',
      value: '',
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
      name: 'woe_missing_value',
      description:
        'Values treated as missing for WOE binning; each is binned separately as a missing bucket.',
      value: WOE_MISSING_VALUE_DEFAULT_JSON,
    },
    {
      name: 'woe_missing_logic',
      description: 'Risk mapping for missing bins (WOE of missing bucket); null uses platform default.',
      value: 'null',
    },
    {
      name: 'woe_fit_input_binding',
      description:
        'Optional WOE Fit input.data_path cascade binding as `upstreamNodeId|outputPort` (e.g. n1|features_data_path). Empty uses default features path from base_train_path.',
      value: '',
    },
    {
      name: 'woe_fit_fixed_data_path',
      description:
        'When set (and binding empty), WOE Fit reads feature data from this S3 path instead of an upstream node output.',
      value: '',
    },
    {
      name: 'woe_fit_sample_scope',
      description:
        'JSON array of sample scopes used when fitting: train, test, val, all. Default ["train"].',
      value: '["train"]',
    },
    {
      name: 'woe_fit_label_column',
      description:
        'WOE Fit data_config.label override; empty inherits Pipeline ENV label_column.',
      value: '',
    },
    {
      name: 'woe_fit_categorical_features',
      description:
        'WOE Fit categorical_features JSON override; empty inherits categorical_columns.',
      value: '',
    },
    {
      name: 'woe_fit_woe_missing_values',
      description:
        'WOE Fit woe_missing_values JSON override; empty inherits woe_missing_value.',
      value: '',
    },
    {
      name: 'woe_fit_woe_missing_logic',
      description: 'WOE Fit woe_missing_logic override; empty inherits woe_missing_logic.',
      value: '',
    },
    {
      name: 'woe_fit_exclude_columns',
      description: 'WOE Fit exclude_columns JSON override; empty inherits exclude_columns.',
      value: '',
    },
    {
      name: 'woe_fit_n_bins',
      description: 'WOE Fit algorithm_config n_bins (5, 10, or 15).',
      value: '10',
    },
    {
      name: 'woe_fit_method',
      description: 'WOE Fit binning method: best_ks or quantile.',
      value: 'best_ks',
    },
    {
      name: 'woe_fit_min_bin_rate',
      description: 'WOE Fit min_bin_rate (fraction per bin).',
      value: '0.02',
    },
    {
      name: 'woe_fit_min_bin_size',
      description: 'WOE Fit min_bin_size (min samples per bin).',
      value: '50',
    },
    {
      name: 'woe_fit_min_missing_bad_cnt',
      description: 'WOE Fit min_missing_bad_cnt.',
      value: '30',
    },
    {
      name: 'woe_fit_dict_nbins',
      description: 'Optional per-feature dict_nbins JSON; empty = no override.',
      value: '',
    },
    {
      name: 'woe_fit_dict_missing_values',
      description: 'Optional dict_missing_values JSON; empty = no override.',
      value: '',
    },
    {
      name: 'woe_fit_dict_min_bin_rate',
      description: 'Optional dict_min_bin_rate JSON; empty = no override.',
      value: '',
    },
    {
      name: 'woe_fit_dict_min_bin_size',
      description: 'Optional dict_min_bin_size JSON; empty = no override.',
      value: '',
    },
    {
      name: 'woe_fit_dict_min_missing_bad_cnt',
      description: 'Optional dict_min_missing_bad_cnt JSON; empty = no override.',
      value: '',
    },
    {
      name: 'woe_fit_woe_update_enabled',
      description: 'Whether WOE Fit post-fit woe_update section is enabled.',
      value: 'false',
    },
    {
      name: 'woe_fit_woe_updates_json',
      description: 'JSON array of WOE update rows {id, featureName, method, payload}.',
      value: '[]',
    },
    {
      name: 'woe_fit_woe_encoder_path',
      description:
        'Input encoder .pkl (concrete S3 URI) for post-fit woe_update. Default / empty-ENV UI fallback: s3://sg-risk-model-prod/risk/id/spl_acard/acard_model/20240315_v1/woe/encoder/acard_ft_user_v1_best_ks_5bin.pkl — edit to another real S3 path as needed. Output is still written to encoder_save_path.',
      value: WOE_FIT_WOE_ENCODER_PATH_MOCK,
    },
    {
      name: 'woe_fit_checkpoint_after_node',
      description: 'Pause for checkpoint after this node when true.',
      value: 'true',
    },
    {
      name: 'woe_transform_input_binding',
      description:
        'WOE Transform input.data_path cascade binding as `upstreamNodeId|outputPort`. Empty uses default features path.',
      value: '',
    },
    {
      name: 'woe_transform_fixed_data_path',
      description: 'Manual S3 path for transform input data when binding is empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'woe_transform_encoder_binding',
      description:
        'WOE Transform encoder_path cascade binding as `upstreamNodeId|encoder_save_path` from upstream WoeFit.',
      value: '',
    },
    {
      name: 'woe_transform_fixed_encoder_path',
      description: 'Manual path to encoder .pkl when encoder binding is empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'woe_transform_sample_scope',
      description: 'JSON array: train, test, val, all for transform row filter. Default ["train"].',
      value: '["train"]',
    },
    {
      name: 'woe_transform_feature_report',
      description: 'Whether to emit feature report during transform (true/false).',
      value: 'true',
    },
    {
      name: 'woe_transform_stability_dim',
      description: 'Column name used as stability analysis dimension.',
      value: 'user_id',
    },
    {
      name: 'woe_transform_report_tabs',
      description: 'JSON array of report tabs: performance, trend, stability, mono.',
      value: '["performance","trend","stability","mono"]',
    },
    {
      name: 'woe_transform_checkpoint_after_node',
      description: 'When true, pause for checkpoint after WOE Transform completes (same semantics as WOE Fit).',
      value: 'true',
    },
    {
      name: 'feature_selection_input_binding',
      description:
        'Feature Selection input.data_path cascade binding `upstreamNodeId|portKey` (e.g. n3|data_save_path from WOE Transform). Empty means pick upstream or FixedValue in UI.',
      value: '',
    },
    {
      name: 'feature_selection_fixed_data_path',
      description: 'Manual S3 path when binding empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'feature_selection_sample_scope',
      description: 'JSON array train / test / val / all for selection input filter.',
      value: '["train"]',
    },
    {
      name: 'feature_selection_label_column',
      description: 'Override label; empty inherits label_column.',
      value: '',
    },
    {
      name: 'feature_selection_categorical_features',
      description: 'JSON override; empty inherits categorical_columns.',
      value: '',
    },
    {
      name: 'feature_selection_woe_missing_values',
      description: 'JSON override; empty inherits woe_missing_value.',
      value: '',
    },
    {
      name: 'feature_selection_woe_missing_logic',
      description: 'Override; empty inherits woe_missing_logic.',
      value: '',
    },
    {
      name: 'feature_selection_exclude_columns',
      description: 'JSON override; empty inherits exclude_columns.',
      value: '',
    },
    {
      name: 'feature_selection_select_methods',
      description: 'JSON array of fs_methods: by_iv, by_corr, by_gini, by_psi.',
      value: '["by_iv","by_corr"]',
    },
    {
      name: 'feature_selection_stability_params',
      description: 'YAML/text stability block when by_stability is selected; empty uses UI default template until edited.',
      value: '',
    },
    {
      name: 'feature_selection_iv_threshold',
      description: 'IV filter threshold.',
      value: '0.02',
    },
    {
      name: 'feature_selection_corr_threshold',
      description: 'Correlation filter threshold.',
      value: '0.7',
    },
    {
      name: 'feature_selection_psi_threshold',
      description: 'PSI threshold when by_psi is used.',
      value: '0.1',
    },
    {
      name: 'feature_selection_feature_report',
      description: 'Emit feature report during selection (true/false).',
      value: 'true',
    },
    {
      name: 'feature_selection_stability_dim',
      description: 'Hive column for stability analysis dimension.',
      value: 'user_id',
    },
    {
      name: 'feature_selection_report_tabs',
      description: 'JSON array: performance, trend, stability, mono.',
      value: '["performance","trend","stability","mono"]',
    },
    {
      name: 'feature_selection_checkpoint_after_node',
      description: 'Pause for checkpoint after Feature Selection completes.',
      value: 'false',
    },
    {
      name: 'tune_train_data_input_binding',
      description:
        'LGBM tune/train input data_path cascade `upstreamNodeId|portKey` (e.g. WOE Transform data_save_path). Empty uses upstream picker or FixedValue.',
      value: '',
    },
    {
      name: 'tune_train_fixed_data_path',
      description: 'Manual S3 path for tune data when binding empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'tune_train_feature_selection_input_binding',
      description:
        'Cascade binding for feature selection report path `upstreamNodeId|selection_report_path` from Feature Selection.',
      value: '',
    },
    {
      name: 'tune_train_fixed_feature_selection_path',
      description: 'Manual path to selection_report when binding empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'tune_train_exclude_cols',
      description:
        'JSON array of columns to exclude from tuning; empty inherits Pipeline ENV exclude_columns (same as global exclude list).',
      value: '',
    },
    {
      name: 'tune_train_auxilary_cols',
      description:
        'JSON array of auxiliary columns stripped from features; empty inherits Pipeline ENV removed_features.',
      value: '',
    },
    {
      name: 'tune_train_sample_weight_col',
      description:
        'Optional sample weight column; empty inherits sample_weight_column (global), or disables if global also empty.',
      value: '',
    },
    {
      name: 'tune_train_n_trials',
      description: 'Number of Ray Tune trials (HPO).',
      value: '10',
    },
    {
      name: 'tune_train_metric_for_train_tune',
      description: 'Metric to optimize: auc, ks, or gini.',
      value: 'auc',
    },
    {
      name: 'tune_train_train_val_split',
      description: 'Train fraction before internal tune train/val split.',
      value: '0.8',
    },
    {
      name: 'tune_train_train_val_ks_diff_threshold',
      description: 'Max train vs val KS gap for overfit detection.',
      value: '0.005',
    },
    {
      name: 'tune_train_coef_overfit_punishment',
      description: 'Penalty coefficient for KS overfit.',
      value: '10',
    },
    {
      name: 'tune_train_auto_scale_pos_weight',
      description: 'When true, auto scale_pos_weight; false uses search space from init_hypers.',
      value: 'false',
    },
    {
      name: 'tune_train_init_hypers',
      description: 'JSON: objective, metric, tree_learner, and hyperparameter search ranges (type, lower, upper).',
      value:
        '{"objective":"binary","metric":["binary_logloss","auc"],"tree_learner":"data","learning_rate":{"type":"uniform","lower":0.01,"upper":0.03},"max_depth":{"type":"randint","lower":3,"upper":6},"num_leaves":{"type":"randint","lower":20,"upper":100},"feature_fraction":{"type":"uniform","lower":0.4,"upper":0.8},"bagging_fraction":{"type":"uniform","lower":0.4,"upper":0.8},"bagging_freq":{"type":"randint","lower":3,"upper":6},"reg_alpha":{"type":"loguniform","lower":0.1,"upper":100},"reg_lambda":{"type":"loguniform","lower":0.1,"upper":100},"min_gain_to_split":{"type":"uniform","lower":0,"upper":0.2},"scale_pos_weight":{"type":"uniform","lower":50,"upper":150},"min_child_samples":{"type":"randint","lower":600,"upper":1000},"early_stopping_round":{"type":"randint","lower":80,"upper":120}}',
    },
    {
      name: 'tune_train_checkpoint_after_node',
      description: 'Pause for checkpoint after LGBM tune & train node completes.',
      value: 'false',
    },
    {
      name: 'tune_train_num_workers',
      description: 'Ray / distributed worker count for LGBM tune & train (Adv. Conf).',
      value: '15',
    },
    {
      name: 'tune_train_cpu_per_worker',
      description: 'CPU cores per worker for LGBM tune & train (Adv. Conf).',
      value: '2',
    },
    {
      name: 'tune_train_memory_per_worker',
      description: 'Memory per worker in GB for LGBM tune & train (Adv. Conf).',
      value: '2',
    },
    {
      name: 'model_prediction_data_input_binding',
      description:
        'Model prediction input data_input cascade `upstreamNodeId|portKey` (e.g. WOE Transform data_save_path). Empty uses upstream picker or FixedValue.',
      value: '',
    },
    {
      name: 'model_prediction_fixed_data_path',
      description: 'Manual S3 path for prediction input data when binding empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'model_prediction_best_model_binding',
      description:
        'Cascade binding for best model .pkl `upstreamNodeId|best_model_output` from LGBM tune & train. Empty uses upstream picker or FixedValue.',
      value: '',
    },
    {
      name: 'model_prediction_fixed_best_model_path',
      description: 'Manual path to best_model.pkl when binding empty and FixedValue is chosen.',
      value: '',
    },
    {
      name: 'model_prediction_sample_scope',
      description: 'JSON array: train, test, val, all for prediction row filter. Default ["test"].',
      value: '["test"]',
    },
    {
      name: 'model_prediction_auxilary_cols',
      description:
        'JSON array of auxiliary columns; empty inherits Pipeline ENV removed_features (same as tune_train_auxilary_cols).',
      value: '',
    },
    {
      name: 'model_prediction_sample_weight_col',
      description:
        'Optional sample weight column; empty inherits sample_weight_column (global), or disables if global also empty.',
      value: '',
    },
    {
      name: 'model_prediction_batch_size',
      description: 'Batch size for prediction scoring.',
      value: '1024',
    },
    {
      name: 'model_prediction_output_columns',
      description: 'JSON array of output column names (e.g. score, probability).',
      value: '["score","probability"]',
    },
    {
      name: 'model_prediction_num_workers',
      description: 'Ray / distributed worker count for model prediction (Adv. Conf).',
      value: '15',
    },
    {
      name: 'model_prediction_cpu_per_worker',
      description: 'CPU cores per worker for model prediction (Adv. Conf).',
      value: '2',
    },
    {
      name: 'model_prediction_memory_per_worker',
      description: 'Memory per worker in GB for model prediction (Adv. Conf).',
      value: '2',
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
  if (hit !== undefined) return hit.value;
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
        id: 'inst-103', taskId: 't1', status: 'CHECKING', bindTask: 'V3',
        notes: 'Paused after CheckPoint node (tune_train)—review then Continue or Kill',
        triggerTime: '2025-03-02 07:00', startTime: '2025-03-02 07:02',
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