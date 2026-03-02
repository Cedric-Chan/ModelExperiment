"""
============================================================================
  完整训练 Pipeline 样例 — 提交至 Ray 集群
  场景：3000 列 Hive 宽表，异常值/缺失值已由上游清洗完毕
  流程：WOE Fit → Transform → Merge → Feature Selection → Model Tune → Train → Predict
============================================================================

使用前请根据实际环境替换以下占位符：
  - S3 路径前缀（S3_BASE）
  - Hive 凭证（HADOOP_USER / HADOOP_PASSWORD）
  - 特征域名称与分类特征列表
  - 标签列、主键列、样本划分列

参考文档：分布式训练使用手册 v1.4
"""

import numpy as np
from config.config import Config
from util.ray_helper.ray_util import RayUtil

# ============================================================================
# 0. 全局配置 — 按实际环境修改
# ============================================================================

PROJECT_TAG = "my_model_v1"
EXPERIMENT_DATE = "20260302"

S3_BASE = f"s3://sg-rescbds-credit-temp/{PROJECT_TAG}/{EXPERIMENT_DATE}"

LABEL_COL = "label_dpd30_3term"
SAMPLE_USE_COL = "sample_use"
PRIMARY_KEY = "userid"
CLUSTER_IDC = "SG"

EXCLUDE_COLS = [
    PRIMARY_KEY,
    "activation_date",
    "request_date",
    "request_id",
    "credit_limit",
    "risk_tier",
]

# 特征域定义（3000 列按业务逻辑拆为多个域，每域独立做 WOE）
FEATURE_DOMAINS = {
    "ft_user_profile": {
        "data_path": f"{S3_BASE}/raw_features/ft_user_profile",
        "categorical_features": [
            "user_acct_status",
            "user_gender",
            "user_kyc_level",
            "user_is_phone_verified",
        ],
        "ls_high_risk_na_features": ["user_is_phone_verified"],
        "missing_logic": {
            "user_is_phone_verified": "high_risk",
            "user_acct_status": "neutral",
        },
    },
    "ft_transaction": {
        "data_path": f"{S3_BASE}/raw_features/ft_transaction",
        "categorical_features": [],
        "ls_high_risk_na_features": [],
        "missing_logic": {},
    },
    "ft_device_app": {
        "data_path": f"{S3_BASE}/raw_features/ft_device_app",
        "categorical_features": ["device_os", "device_brand"],
        "ls_high_risk_na_features": [],
        "missing_logic": {},
    },
    "ft_behavior": {
        "data_path": f"{S3_BASE}/raw_features/ft_behavior",
        "categorical_features": [],
        "ls_high_risk_na_features": [],
        "missing_logic": {},
    },
}

# WOE 全局参数
WOE_N_BINS = 5
WOE_METHOD = "best_ks"
WOE_TRANSFORM_METHOD = "woe"

# 特征选择参数
FS_METHODS = ["by_iv", "by_corr", "by_gini", "by_psi", "by_stability"]
FS_IV_THRESHOLD = 0.02
FS_CORR_THRESHOLD = 0.7
FS_PSI_THRESHOLD = 0.1
FS_STABILITY_LAMBDA_GRID = list(np.logspace(-3, -1, 8))
FS_STABILITY_THRESHOLD = 0.1
FS_STABILITY_N_RESAMPLING = 30
FS_STABILITY_SAMPLE_FRACTION = 0.5

# Ray Tune 超参搜索配置
TUNE_N_TRIALS = 50
TUNE_NUM_WORKERS = 25
TUNE_CPU_PER_WORKER = 2
TUNE_MEMORY_PER_WORKER = 3

TRAIN_NUM_WORKERS = 30
TRAIN_CPU_PER_WORKER = 3
TRAIN_MEMORY_PER_WORKER = 3

# LightGBM 搜索空间
LGBM_SEARCH_SPACE = {
    "metric": ["binary_logloss", "auc"],
    "objective": "binary",
    "tree_learner": "data",
    "learning_rate": {"type": "uniform", "lower": 0.01, "upper": 0.2},
    "max_depth": {"type": "randint", "lower": 4, "upper": 10},
    "num_leaves": {"type": "randint", "lower": 31, "upper": 256},
    "min_child_samples": {"type": "randint", "lower": 20, "upper": 200},
    "reg_alpha": {"type": "uniform", "lower": 0, "upper": 500},
    "reg_lambda": {"type": "uniform", "lower": 0, "upper": 500},
    "subsample": {"type": "uniform", "lower": 0.6, "upper": 1.0},
    "colsample_bytree": {"type": "uniform", "lower": 0.5, "upper": 1.0},
    "num_boost_round": {"type": "randint", "lower": 100, "upper": 1000},
    "scale_pos_weight": True,
    "early_stopping_round": 50,
}

SUB_MODEL_NAME = "full_model"

# ============================================================================
# 路径规划（统一归档结构）
# ============================================================================

PATHS = {
    "woe_encoder":          f"{S3_BASE}/woe/encoder",
    "woe_transformed":      f"{S3_BASE}/woe/data/features",
    "woe_merge":            f"{S3_BASE}/woe/data/merge",
    "feature_selection":    f"{S3_BASE}/feature_selection",
    "tune_best_hypers":     f"{S3_BASE}/model/tuning/best_hypers/{SUB_MODEL_NAME}/v1",
    "tune_best_model":      f"{S3_BASE}/model/tuning/model/{SUB_MODEL_NAME}/v1/lgb.pkl",
    "tune_predict":         f"{S3_BASE}/model/tuning/predict_result/{SUB_MODEL_NAME}/v1",
    "tune_bo_history":      f"{S3_BASE}/model/tuning/bo_history/{SUB_MODEL_NAME}/v1",
    "tune_feat_importance": f"{S3_BASE}/model/tuning/feature_importance/{SUB_MODEL_NAME}/v1",
    "tune_checkpoint":      f"{S3_BASE}/model/tuning/trial/{SUB_MODEL_NAME}/v1",
    "train_model":          f"{S3_BASE}/model/train/model/{SUB_MODEL_NAME}/v1/lgb.pkl",
    "train_predict":        f"{S3_BASE}/model/train/predict_result/{SUB_MODEL_NAME}/v1",
    "final_predict":        f"{S3_BASE}/model/predict/predict_result/{SUB_MODEL_NAME}/v1",
}


def init_ray_util():
    """Step 0: 初始化全局配置与 Ray 集群连接"""
    Config.base_config.fp_hadoop_user_name = "rescbds_credit"       # TODO: 替换
    Config.base_config.fp_hadoop_user_password = "YOUR_PASSWORD"    # TODO: 替换
    Config.base_config.label = LABEL_COL
    Config.base_config.sample_use_col = SAMPLE_USE_COL
    Config.base_config.fp_base = S3_BASE + "/"
    Config.base_config.cluster_idc = CLUSTER_IDC

    ray_util = RayUtil(
        cluster_name=f"risk-model-{PROJECT_TAG}",
        cluster_spec_yaml="./cluster_spec.yml",
        enable_log_tail=True,
    )
    print(f"[Pipeline] Ray 集群已就绪: risk-model-{PROJECT_TAG}")
    return ray_util


# ============================================================================
# Step 1: WOE Fit + Transform（按特征域循环）
# ============================================================================

def run_woe_pipeline(ray_util):
    """对每个特征域执行 WOE Fit → Transform (training + test)"""

    for domain_name, domain_cfg in FEATURE_DOMAINS.items():
        encoder_path = (
            f"{PATHS['woe_encoder']}/{domain_name}_{WOE_METHOD}_{WOE_N_BINS}bin.pkl"
        )

        # --- 1.1 WOE Fit ---
        print(f"\n{'='*60}")
        print(f"[WOE Fit] 特征域: {domain_name}")
        print(f"{'='*60}")

        ray_util.woe_fit(
            feature_name=domain_name,
            model_level="sub",
            data_path=domain_cfg["data_path"],
            encoder_save_path=encoder_path,
            label=LABEL_COL,
            sample_use_col=SAMPLE_USE_COL,
            n_bins=WOE_N_BINS,
            method=WOE_METHOD,
            transform_method=WOE_TRANSFORM_METHOD,
            min_bin_rate=0.02,
            min_bin_size=50,
            min_missing_bad_cnt=30,
            categorical_features=domain_cfg.get("categorical_features", []),
            ls_high_risk_na_features=domain_cfg.get("ls_high_risk_na_features", []),
            missing_logic=domain_cfg.get("missing_logic", {}),
            exclude=EXCLUDE_COLS,
        )

        # --- 1.2 WOE Transform (training_features) ---
        for sample_type in ["training_features", "test_features"]:
            transformed_path = (
                f"{PATHS['woe_transformed']}/{sample_type}_{domain_name}_{WOE_N_BINS}bin"
            )

            print(f"[WOE Transform] {domain_name} / {sample_type}")

            ray_util.woe_transform(
                feature_name=domain_name,
                sample_type=sample_type,
                data_path=domain_cfg["data_path"],
                data_save_path=transformed_path,
                encoder_load_path=encoder_path,
                n_bins=WOE_N_BINS,
                method=WOE_METHOD,
                transform_method=WOE_TRANSFORM_METHOD,
            )

    print("\n[WOE Pipeline] 全部特征域 Fit + Transform 完成 ✓")


# ============================================================================
# Step 2: WOE Merge（合并所有特征域 → 训练宽表）
# ============================================================================

def run_woe_merge(ray_util):
    """使用 woe_merge_v2（Ray 原生 Join）合并所有特征域"""

    for sample_type in ["training_features", "test_features"]:
        data_path_dict = {
            domain_name: (
                f"{PATHS['woe_transformed']}/{sample_type}_{domain_name}_{WOE_N_BINS}bin"
            )
            for domain_name in FEATURE_DOMAINS
        }
        merge_save_path = (
            f"{PATHS['woe_merge']}/{sample_type}_{SUB_MODEL_NAME}_{WOE_N_BINS}bin"
        )

        print(f"\n[WOE Merge v2] {sample_type} → {merge_save_path}")

        ray_util.woe_merge_v2(
            model_name=SUB_MODEL_NAME,
            sample_type=sample_type,
            data_path_dict=data_path_dict,
            on=PRIMARY_KEY,
            how="inner",
            n_bins=WOE_N_BINS,
            data_save_path=merge_save_path,
        )

    print("[WOE Merge] 全部样本集合并完成 ✓")


# ============================================================================
# Step 3: 特征选择（5 种方法联合筛选 3000→精选特征子集）
# ============================================================================

def run_feature_selection(ray_util):
    """使用 feature_selection_v2 对 3000 列做大规模筛选"""

    merged_data_path = (
        f"{PATHS['woe_merge']}/training_features_{SUB_MODEL_NAME}_{WOE_N_BINS}bin"
    )
    fs_output_path = (
        f"{PATHS['feature_selection']}/selection_report_{SUB_MODEL_NAME}.csv"
    )

    print(f"\n{'='*60}")
    print(f"[Feature Selection v2] 输入: {merged_data_path}")
    print(f"  方法: {FS_METHODS}")
    print(f"  IV < {FS_IV_THRESHOLD} 剔除 | Corr > {FS_CORR_THRESHOLD} 剔除 | PSI > {FS_PSI_THRESHOLD} 剔除")
    print(f"  Stability: lambda_grid={len(FS_STABILITY_LAMBDA_GRID)}点, "
          f"n_resampling={FS_STABILITY_N_RESAMPLING}, threshold={FS_STABILITY_THRESHOLD}")
    print(f"{'='*60}")

    ray_util.feature_selection_v2(
        model_name=SUB_MODEL_NAME,
        fp_fs_input_path=merged_data_path,
        fp_fs_output_path=fs_output_path,
        fp_fs_methods=FS_METHODS,
        fp_fs_iv_threshold=FS_IV_THRESHOLD,
        fp_fs_corr_threshold=FS_CORR_THRESHOLD,
        fp_fs_psi_threshold=FS_PSI_THRESHOLD,
        exclude=EXCLUDE_COLS,
        fp_fs_lambda_grid=FS_STABILITY_LAMBDA_GRID,
        fp_fs_stability_threshold=FS_STABILITY_THRESHOLD,
        fp_fs_stability_n_resampling=FS_STABILITY_N_RESAMPLING,
        fp_fs_stability_sample_fraction=FS_STABILITY_SAMPLE_FRACTION,
        fp_fs_random_state=42,
    )

    print(f"[Feature Selection] 报告已输出: {fs_output_path} ✓")
    return fs_output_path


# ============================================================================
# Step 4: 模型调参（Ray Tune — BayesOpt + LightGBM）
# ============================================================================

def run_model_tune(ray_util, fs_report_path):
    """使用 Ray Tune 进行大规模超参搜索（Bayesian Optimization）"""

    merged_data_path = (
        f"{PATHS['woe_merge']}/training_features_{SUB_MODEL_NAME}_{WOE_N_BINS}bin"
    )
    auxilary_cols = [PRIMARY_KEY, SAMPLE_USE_COL, LABEL_COL, "activation_date"]

    print(f"\n{'='*60}")
    print(f"[Model Tune] Ray Tune — n_trials={TUNE_N_TRIALS}")
    print(f"  Workers: {TUNE_NUM_WORKERS} x {TUNE_CPU_PER_WORKER}CPU x {TUNE_MEMORY_PER_WORKER}GB")
    print(f"  搜索空间: LightGBM (lr: 0.01~0.2, depth: 4~10, leaves: 31~256, ...)")
    print(f"{'='*60}")

    ray_util.model_tune(
        sub_model=SUB_MODEL_NAME,
        sample_path=merged_data_path,
        feature_selection_path=fs_report_path,
        use_feature_selection=["by_iv", "by_corr", "by_psi", "by_stability"],
        n_trails=TUNE_N_TRIALS,
        num_workers=TUNE_NUM_WORKERS,
        cpu_per_worker=TUNE_CPU_PER_WORKER,
        memory_per_worker=TUNE_MEMORY_PER_WORKER,
        metric_for_train_tune="auc",
        train_val_ks_diff_threshold=0.03,
        coeffcient_overfit_punishment=0.5,
        init_hypers=LGBM_SEARCH_SPACE,
        tune_exclude_cols=EXCLUDE_COLS + [SAMPLE_USE_COL],
        auxilary_cols=auxilary_cols,
        best_hypers_path=PATHS["tune_best_hypers"],
        best_model_path=PATHS["tune_best_model"],
        predict_result_path=PATHS["tune_predict"],
        bo_history_path=PATHS["tune_bo_history"],
        feature_importance_path=PATHS["tune_feat_importance"],
        checkpoint_path=PATHS["tune_checkpoint"],
    )

    print(f"[Model Tune] 最优超参已保存: {PATHS['tune_best_hypers']} ✓")
    print(f"[Model Tune] 最优模型已保存: {PATHS['tune_best_model']} ✓")


# ============================================================================
# Step 5: 正式模型训练（用 Tune 产出的最优超参）
# ============================================================================

def run_model_train(ray_util, fs_report_path):
    """使用 Tune 阶段产出的 best_hyper_path 进行正式训练"""

    merged_data_path = (
        f"{PATHS['woe_merge']}/training_features_{SUB_MODEL_NAME}_{WOE_N_BINS}bin"
    )
    auxilary_cols = [PRIMARY_KEY, SAMPLE_USE_COL, LABEL_COL, "activation_date"]

    print(f"\n{'='*60}")
    print(f"[Model Train] 使用最优超参正式训练")
    print(f"  Workers: {TRAIN_NUM_WORKERS} x {TRAIN_CPU_PER_WORKER}CPU x {TRAIN_MEMORY_PER_WORKER}GB")
    print(f"{'='*60}")

    ray_util.model_train(
        sub_model=SUB_MODEL_NAME,
        sample_path=merged_data_path,
        feature_selection_path=fs_report_path,
        use_feature_selection=["by_iv", "by_corr", "by_psi", "by_stability"],
        best_hyper_path=PATHS["tune_best_hypers"],
        num_workers=TRAIN_NUM_WORKERS,
        cpu_per_worker=TRAIN_CPU_PER_WORKER,
        memory_per_worker=TRAIN_MEMORY_PER_WORKER,
        tune_exclude_cols=EXCLUDE_COLS + [SAMPLE_USE_COL],
        auxilary_cols=auxilary_cols,
        best_model_path=PATHS["train_model"],
        predict_result_path=PATHS["train_predict"],
    )

    print(f"[Model Train] 最终模型: {PATHS['train_model']} ✓")
    print(f"[Model Train] 预测结果: {PATHS['train_predict']} ✓")


# ============================================================================
# Step 6: 批量预测（OOT / 新数据集）
# ============================================================================

def run_model_predict(ray_util, oot_data_path=None):
    """在 OOT 或其他数据集上执行批量预测"""

    if oot_data_path is None:
        oot_data_path = (
            f"{PATHS['woe_merge']}/test_features_{SUB_MODEL_NAME}_{WOE_N_BINS}bin"
        )

    auxilary_cols = [PRIMARY_KEY, SAMPLE_USE_COL, LABEL_COL, "activation_date"]

    print(f"\n[Model Predict] 数据源: {oot_data_path}")

    ray_util.model_predict(
        sub_model=SUB_MODEL_NAME,
        sample_path=oot_data_path,
        best_model_path=PATHS["train_model"],
        predict_result_path=PATHS["final_predict"],
        auxilary_cols=auxilary_cols,
    )

    print(f"[Model Predict] 预测结果: {PATHS['final_predict']} ✓")


# ============================================================================
# Step 7 (可选): Feature Report — 生成分箱性能/稳定性/单调性报告
# ============================================================================

def run_feature_reports(ray_util):
    """为每个特征域生成详细报告（性能、稳定性、单调性）"""

    for domain_name in FEATURE_DOMAINS:
        print(f"[Feature Report] {domain_name}")

        ray_util.feature_report(
            feature_name=domain_name,
            sample_type="training_features",
            pkey=PRIMARY_KEY,
            dim="activation_date",
            n_bins=WOE_N_BINS,
            gdrive_folder_id="NA",
            data_path=f"{PATHS['woe_transformed']}/training_features_{domain_name}_{WOE_N_BINS}bin",
            encoder_load_path=f"{PATHS['woe_encoder']}/{domain_name}_{WOE_METHOD}_{WOE_N_BINS}bin.pkl",
            feature_report_save_path=f"{S3_BASE}/woe/reports/{domain_name}",
            reports="performance,stability,mono",
        )

    print("[Feature Report] 全部报告生成完成 ✓")


# ============================================================================
# Main — 端到端执行
# ============================================================================

def main():
    print("=" * 70)
    print(f"  离线模型训练 Pipeline — {PROJECT_TAG} / {EXPERIMENT_DATE}")
    print(f"  S3 根路径: {S3_BASE}")
    print(f"  特征域数: {len(FEATURE_DOMAINS)}")
    print(f"  标签列: {LABEL_COL} | 主键: {PRIMARY_KEY}")
    print("=" * 70)

    # Step 0: 初始化
    ray_util = init_ray_util()

    # Step 1: WOE Fit + Transform
    run_woe_pipeline(ray_util)

    # Step 2: WOE Merge (v2, Ray 原生 Join)
    run_woe_merge(ray_util)

    # Step 3: 特征选择 (3000 列 → 精选子集)
    fs_report_path = run_feature_selection(ray_util)

    # Step 4: Ray Tune 超参搜索 (Bayesian, 50 trials)
    run_model_tune(ray_util, fs_report_path)

    # Step 5: 正式训练 (用最优超参)
    run_model_train(ray_util, fs_report_path)

    # Step 6: 批量预测 (test 数据集)
    run_model_predict(ray_util)

    # Step 7 (可选): 特征报告
    # run_feature_reports(ray_util)

    print("\n" + "=" * 70)
    print("  Pipeline 全部完成!")
    print(f"  最终模型:   {PATHS['train_model']}")
    print(f"  最优超参:   {PATHS['tune_best_hypers']}")
    print(f"  预测结果:   {PATHS['final_predict']}")
    print(f"  特征报告:   {PATHS['feature_selection']}")
    print("=" * 70)

    # 清理集群（可选，生产环境建议保留）
    # ray_util.stop_cluster()


if __name__ == "__main__":
    main()
