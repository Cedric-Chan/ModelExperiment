# 模型训练 Pipeline 文档

## Pipeline 流程图

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Feature Engineering (特征工程)                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Feature Domain 1 (e.g. user_features)                                              │    │
│  │                                                                                      │    │
│  │  ┌────────────┐   woe_fit    ┌────────────┐  woe_transform  ┌────────────────────┐  │    │
│  │  │  Raw Data  │ ──────────▶  │  Encoder   │ ──────────────▶ │ Transformed Data 1 │  │    │
│  │  │  (S3)      │              │  (.pkl)    │                 │ (WOE encoded)      │  │    │
│  │  └────────────┘              └─────┬──────┘                 └─────────┬──────────┘  │    │
│  │                                    │                                  │             │    │
│  │                                    ▼ (Optional)                       │             │    │
│  │                           ┌────────────────┐                          │             │    │
│  │                           │ feature_report │                          │             │    │
│  │                           └────────────────┘                          │             │    │
│  └───────────────────────────────────────────────────────────────────────┼─────────────┘    │
│                                                                          │                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Feature Domain 2 (e.g. order_features)                                             │    │
│  │                                                                                      │    │
│  │  ┌────────────┐   woe_fit    ┌────────────┐  woe_transform  ┌────────────────────┐  │    │
│  │  │  Raw Data  │ ──────────▶  │  Encoder   │ ──────────────▶ │ Transformed Data 2 │  │    │
│  │  │  (S3)      │              │  (.pkl)    │                 │ (WOE encoded)      │  │    │
│  │  └────────────┘              └────────────┘                 └─────────┬──────────┘  │    │
│  └───────────────────────────────────────────────────────────────────────┼─────────────┘    │
│                                                                          │                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │  Feature Domain N ...                                                               │    │
│  │                                                     ┌────────────────────┐          │    │
│  │                                                     │ Transformed Data N │ ─────────┼────┼──┐
│  │                                                     └────────────────────┘          │    │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │  │
│                                                                                              │  │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │                        woe_merge (可在 Spark 完成，Ray 不擅长 Join)                    │◀──┘  │
│  │  ┌────────────────────┐                                                              │◀─────┘
│  │  │  Transformed Data  │──┐                                                           │
│  │  │  1, 2, ... N       │  │  JOIN on userid   ┌─────────────────────────────────┐     │
│  │  └────────────────────┘  │ ────────────────▶ │       Merged Data               │     │
│  │                          │                   │  (All features combined)        │     │
│  │                          └──────────────────▶└─────────────────┬───────────────┘     │
│  └────────────────────────────────────────────────────────────────┼─────────────────────┘
│                                                                   │                      │
│                                                                   ▼                      │
│                                                    ┌──────────────────────────┐          │
│                                                    │    feature_selection     │          │
│                                                    │  (IV/Corr/PSI/Gini筛选)  │          │
│                                                    └────────────┬─────────────┘          │
│                                                                 │                        │
└─────────────────────────────────────────────────────────────────┼────────────────────────┘
                                                                  │
                                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Model Training (模型训练)                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   ┌────────────────┐      ┌───────────────┐      ┌─────────────────┐                        │
│   │  Merged Data   │─────▶│  model_tune   │─────▶│   Best Hypers   │                        │
│   │  + FS Report   │      │  (Ray Tune)   │      │   (.parquet)    │                        │
│   └────────────────┘      └───────────────┘      └────────┬────────┘                        │
│                                                           │                                  │
│                                                           ▼                                  │
│                                                    ┌───────────────┐                        │
│                                                    │  model_train  │                        │
│                                                    │  (LightGBM)   │                        │
│                                                    └───────┬───────┘                        │
│                                                            │                                 │
│                                                            ▼                                 │
│                                                    ┌───────────────┐                        │
│                                                    │   LightGBM    │                        │
│                                                    │  Model (.pkl) │                        │
│                                                    └───────┬───────┘                        │
│                                                            │                                 │
│                                                            ▼                                 │
│                                                    ┌───────────────┐                        │
│                                                    │ model_predict │                        │
│                                                    └───────┬───────┘                        │
│                                                            │                                 │
│                                                            ▼                                 │
│                                                    ┌───────────────┐                        │
│                                                    │   Sub-model   │                        │
│                                                    │  Predictions  │                        │
│                                                    └───────────────┘                        │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                           Mega Model & Calibration (集成与校准)                               │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   ┌────────────────┐      ┌───────────────┐      ┌─────────────────┐                        │
│   │   Sub-model    │─────▶│   model_bm    │─────▶│   Mega Model    │                        │
│   │   Predictions  │      │  (Logistic)   │      │     (.pkl)      │                        │
│   └────────────────┘      └───────────────┘      └────────┬────────┘                        │
│                                                           │                                  │
│                                                           ▼                                  │
│                                                    ┌───────────────┐                        │
│                                                    │ calibrate_fit │                        │
│                                                    └───────┬───────┘                        │
│                                                            │                                 │
│                                                            ▼                                 │
│                                                    ┌───────────────┐                        │
│                                                    │  Calibrator   │                        │
│                                                    │    (.pkl)     │                        │
│                                                    └───────┬───────┘                        │
│                                                            │                                 │
│                                                            ▼                                 │
│                                                    ┌─────────────────┐                      │
│                                                    │calibrate_transform│                    │
│                                                    └────────┬────────┘                      │
│                                                             │                                │
│                                                             ▼                                │
│                                                    ┌─────────────────┐                      │
│                                                    │   Final Score   │                      │
│                                                    │   (MegaScore)   │                      │
│                                                    └─────────────────┘                      │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 流程说明

1. **woe_fit**: 对每个特征域(Feature Domain)的原始数据进行 WOE 分箱训练，生成 Encoder (.pkl)
2. **feature_report** (可选): 基于 Encoder 生成特征报告（性能、趋势、稳定性、单调性）
3. **woe_transform**: 使用 Encoder 将原始数据转换为 WOE 编码数据
4. **woe_merge**: 将多个特征域的 WOE 数据按 userid 进行 JOIN 合并
   - ⚠️ **注意**: Ray 不擅长 Join 操作，建议在 Spark 中完成此步骤
5. **feature_selection**: 对合并后的数据进行特征筛选（IV、相关性、PSI、Gini）
6. **model_tune**: 使用 Ray Tune 进行超参数优化
7. **model_train**: 使用最佳超参数训练 LightGBM 模型
8. **model_predict**: 使用训练好的模型进行预测
9. **model_bm**: 将多个子模型的预测结果通过逻辑回归组合成 Mega Model
10. **calibrate_fit**: 拟合校准模型
11. **calibrate_transform**: 将概率转换为最终分数 (MegaScore)

---

## 1. WOE Fit (WOE 分箱训练)

将原始特征数据进行 WOE 分箱，生成 encoder。

### 输入参数

| 参数                            | 类型      | 必填 | 默认值       | 说明                                        |
| ------------------------------- | --------- | ---- | ------------ | ------------------------------------------- |
| `feature_name`                | str       | ✅   | -            | 特征名称                                    |
| `data_path`                   | str       | ✅   | -            | 原始数据目录路径 (S3 parquet)               |
| `encoder_save_filepath`       | str       | ✅   | -            | Encoder 保存文件路径 (S3 .pkl)              |
| `label`                       | str       | ✅   | -            | 标签列名                                    |
| `n_bins`                      | int       |      | 5            | 分箱数                                      |
| `min_bin_rate`                | float     |      | 0.02         | 最小分箱比例                                |
| `min_bin_size`                | int       |      | 50           | 最小分箱样本数                              |
| `min_missing_bad_cnt`         | int       |      | 30           | 最小缺失值坏样本数                          |
| `method`                      | str       |      | 'best_ks'    | 分箱方法 ('best_ks' / 'quantile')           |
| `transform_method`            | str       |      | 'woe'        | 转换方法 ('woe' / 'bin')                    |
| `exclude`                     | List[str] |      | None         | 排除的特征列表                              |
| `categorical_features`        | List[str] |      | None         | 类别特征列表                                |
| `missing_values`              | List      |      | None         | 缺失值列表                                  |
| `missing_logic`               | Dict      |      | None         | 缺失值处理逻辑，如 {"feature": "high_risk"} |
| `dict_nbins`                  | Dict      |      | None         | 特征级分箱数，如 {"feat": 6}                |
| `dict_missing_values`         | Dict      |      | None         | 特征级缺失值                                |
| `dict_min_bin_rate`           | Dict      |      | None         | 特征级最小分箱比例                          |
| `dict_min_bin_size`           | Dict      |      | None         | 特征级最小分箱样本数                        |
| `dict_min_missing_bad_cnt`    | Dict      |      | None         | 特征级缺失值坏样本阈值                      |
| `model_level`                 | str       |      | 'sub'        | 模型层级 ('sub' / 'mega')                   |
| `sample_use_col`              | str       |      | 'sample_use' | 样本使用列                                  |
| `ls_high_risk_na_features`    | List[str] |      | None         | 高风险缺失值特征                            |
| `ls_neutral_risk_na_features` | List[str] |      | None         | 中性风险缺失值特征                          |

### 输出

| 输出                  | 路径参数                  | 说明                  |
| --------------------- | ------------------------- | --------------------- |
| **WOE Encoder** | `encoder_save_filepath` | WOE 编码器文件 (.pkl) |

---

## 2. Feature Report (特征报告) - 可选

生成特征的性能、趋势、稳定性、单调性报告。

### 输入参数

| 参数                      | 类型      | 必填 | 默认值       | 说明                                                                         |
| ------------------------- | --------- | ---- | ------------ | ---------------------------------------------------------------------------- |
| `feature_name`          | str       | ✅   | -            | 特征名称                                                                     |
| `data_path`             | str       | ✅   | -            | 数据目录路径 (S3 parquet)                                                    |
| `encoder_load_filepath` | str       | ✅   | -            | Encoder 加载文件路径 (S3 .pkl)                                               |
| `report_filepath`       | str       | ✅   | -            | 报告保存文件路径 (S3 .xlsx)                                                  |
| `label`                 | str       | ✅   | -            | 标签列名                                                                     |
| `sample_type`           | str       | ✅   | -            | 样本类型 (train/test/oot)                                                    |
| `pkey`                  | str       | ✅   | -            | 主键列名                                                                     |
| `dim`                   | str       | ✅   | -            | 维度列名 (用于稳定性分析)                                                    |
| `n_bins`                | int       |      | 5            | 分箱数                                                                       |
| `sample_use_col`        | str       |      | 'sample_use' | 样本使用列                                                                   |
| `gdrive_folder_id`      | str       |      | 'NA'         | Google Drive 文件夹 ID，'NA' 表示不上传                                      |
| `reports`               | List[str] |      | None         | 报告类型列表，如 ['performance', 'trend', 'stability', 'mono']，默认生成所有 |

### 输出

| 输出                     | 路径参数                  | 说明             |
| ------------------------ | ------------------------- | ---------------- |
| **Feature Report** | `report_filepath`       | 特征报告 (.xlsx) |
| **Raw Report**     | `raw_{report_filepath}` | 原始报告数据     |

---

## 3. WOE Transform (WOE 转换)

使用训练好的 encoder 对数据进行 WOE 转换。

### 输入参数

| 参数                      | 类型 | 必填 | 默认值              | 说明                                                |
| ------------------------- | ---- | ---- | ------------------- | --------------------------------------------------- |
| `feature_name`          | str  | ✅   | -                   | 特征名称                                            |
| `data_path`             | str  | ✅   | -                   | 原始数据目录路径 (S3 parquet)                       |
| `encoder_load_filepath` | str  | ✅   | -                   | Encoder 加载文件路径 (S3 .pkl)                      |
| `data_save_path`        | str  | ✅   | -                   | 转换后数据保存目录路径 (S3)                         |
| `sample_type`           | str  |      | 'training_features' | 样本类型                                            |
| `model_level`           | str  |      | 'sub'               | 模型层级                                            |
| `transform_method`      | str  |      | 'woe'               | 转换方法                                            |
| `n_bins`                | int  |      | 5                   | 分箱数                                              |
| `method`                | str  |      | 'best_ks'           | 分箱方法                                            |
| `ooot_date`             | str  |      | None                | OOOT 日期 (仅当 sample_type='ooot_features' 时需要) |

### 输出

| 输出                       | 路径参数           | 说明                       |
| -------------------------- | ------------------ | -------------------------- |
| **Transformed Data** | `data_save_path` | WOE 转换后的数据 (parquet) |

---

## 4. WOE Merge (数据合并)

合并多个特征域的 WOE 转换数据。

### 输入参数 (woe_merge - Modin 版本)

| 参数               | 类型           | 必填 | 默认值   | 说明                                   |
| ------------------ | -------------- | ---- | -------- | -------------------------------------- |
| `data_path_dict` | Dict[str, str] | ✅   | -        | 数据路径字典 {feature_name: file_path} |
| `data_save_path` | str            | ✅   | -        | 合并后数据保存目录路径 (S3)            |
| `on`             | str            |      | 'userid' | Join key 列名                          |
| `how`            | str            |      | 'inner'  | Join 类型 (inner/left/right/outer)     |
| `n_partitions`   | int            |      | 30       | Modin 分区数                           |
| `cpu_count`      | int            |      | 100      | CPU 数量                               |

### 输入参数 (woe_merge_v2 - Ray Data 版本)

| 参数               | 类型           | 必填 | 默认值   | 说明                                   |
| ------------------ | -------------- | ---- | -------- | -------------------------------------- |
| `data_path_dict` | Dict[str, str] | ✅   | -        | 数据路径字典 {feature_name: file_path} |
| `data_save_path` | str            | ✅   | -        | 合并后数据保存目录路径 (S3)            |
| `on`             | str            |      | 'userid' | Join key 列名                          |
| `how`            | str            |      | 'inner'  | Join 类型                              |
| `num_partitions` | int            |      | None     | 分区数量，None 时自动计算              |

### 输出

| 输出                  | 路径参数           | 说明                   |
| --------------------- | ------------------ | ---------------------- |
| **Merged Data** | `data_save_path` | 合并后的数据 (parquet) |

---

## 5. Feature Selection (特征选择)

基于 IV、相关性、PSI、Gini 等指标进行特征筛选。

### 输入参数 (feature_selection - Modin 版本)

| 参数                | 类型      | 必填 | 默认值                                    | 说明                          |
| ------------------- | --------- | ---- | ----------------------------------------- | ----------------------------- |
| `data_path`       | str       | ✅   | -                                         | 输入数据目录路径 (S3 parquet) |
| `output_filepath` | str       | ✅   | -                                         | 输出报告文件路径 (S3 .csv)    |
| `label`           | str       | ✅   | -                                         | 标签列名                      |
| `model_name`      | str       |      | 'model'                                   | 模型名称                      |
| `sample_use_col`  | str       |      | 'sample_use'                              | 样本使用列 (区分 train/test)  |
| `fs_methods`      | List[str] |      | ['by_iv', 'by_corr', 'by_psi', 'by_gini'] | 特征选择方法                  |
| `exclude_cols`    | List[str] |      | None                                      | 排除的列列表                  |
| `iv_threshold`    | float     |      | 0.02                                      | IV 阈值                       |
| `corr_threshold`  | float     |      | 0.7                                       | 相关性阈值                    |
| `psi_threshold`   | float     |      | 0.25                                      | PSI 阈值                      |

### 输入参数 (feature_selection_v2 - Ray Data 版本，支持 Stability Selection)

| 参数                          | 类型        | 必填 | 默认值                                    | 说明                            |
| ----------------------------- | ----------- | ---- | ----------------------------------------- | ------------------------------- |
| `data_path`                 | str         | ✅   | -                                         | 输入数据目录路径 (S3 parquet)   |
| `output_filepath`           | str         | ✅   | -                                         | 输出报告文件路径 (S3 .csv)      |
| `label`                     | str         | ✅   | -                                         | 标签列名                        |
| `model_name`                | str         |      | 'model'                                   | 模型名称                        |
| `sample_use_col`            | str         |      | 'sample_use'                              | 样本使用列                      |
| `fs_methods`                | List[str]   |      | ['by_iv', 'by_corr', 'by_psi', 'by_gini'] | 特征选择方法                    |
| `exclude_cols`              | List[str]   |      | None                                      | 排除的列列表                    |
| `iv_threshold`              | float       |      | 0.02                                      | IV 阈值                         |
| `corr_threshold`            | float       |      | 0.7                                       | 相关性阈值                      |
| `psi_threshold`             | float       |      | 0.25                                      | PSI 阈值                        |
| `stability_lambda_grid`     | List[float] |      | None                                      | Stability Selection Lambda 网格 |
| `stability_threshold`       | float       |      | 0.1                                       | 稳定性阈值                      |
| `stability_n_resampling`    | int         |      | 50                                        | 重采样次数                      |
| `stability_sample_fraction` | float       |      | 0.5                                       | 采样比例                        |
| `stability_max_sample_rows` | int         |      | None                                      | 最大采样行数                    |
| `stability_random_state`    | int         |      | 0                                         | 随机种子                        |
| `stability_max_iter`        | int         |      | 100                                       | 最大迭代次数                    |
| `stability_tol`             | float       |      | 1e-4                                      | 收敛容差                        |

### 输出

| 输出                       | 路径参数            | 说明                |
| -------------------------- | ------------------- | ------------------- |
| **Selection Report** | `output_filepath` | 特征选择报告 (.csv) |

---

## 6. Model Tune (模型调参)

使用 Ray Tune 进行 LightGBM 超参数优化。

### 输入参数

| 参数                              | 类型      | 必填 | 默认值       | 说明                                                         |
| --------------------------------- | --------- | ---- | ------------ | ------------------------------------------------------------ |
| `sample_path`                   | str       | ✅   | -            | 数据路径 (S3 parquet)                                        |
| `label`                         | str       | ✅   | -            | 标签列名                                                     |
| `best_model_filepath`           | str       |      | None         | 最佳模型保存路径 (S3 .pkl)                                   |
| `best_hypers_path`              | str       |      | None         | 最佳超参数保存路径 (S3 parquet)                              |
| `feature_importance_path`       | str       |      | None         | 特征重要性保存路径 (S3 parquet)                              |
| `bo_history_path`               | str       |      | None         | BO 历史保存路径 (S3 parquet)                                 |
| `predict_result_path`           | str       |      | None         | 预测结果保存路径 (S3 parquet)                                |
| `checkpoint_path`               | str       |      | None         | Checkpoint 保存路径 (S3)                                     |
| `fp_base`                       | str       |      | ''           | 允许删除的路径前缀                                           |
| `sample_use_col`                | str       |      | 'sample_use' | 样本使用列 (区分 train/test)                                 |
| `exclude_cols`                  | List[str] |      | None         | 排除的列列表                                                 |
| `feature_selection_path`        | str       |      | None         | 特征选择结果路径                                             |
| `use_feature_selection`         | List[str] |      | None         | 使用的特征选择方法 ['by_iv', 'by_corr', 'by_psi', 'by_gini'] |
| `sample_weight_col`             | str       |      | None         | 样本权重列                                                   |
| `auxilary_cols`                 | List[str] |      | None         | 辅助列 (预测时保留)                                          |
| `init_hypers`                   | Dict      |      | None         | 超参数搜索空间 (见下方示例)                                  |
| `n_trials`                      | int       |      | 100          | 试验次数                                                     |
| `metric_for_tune`               | str       |      | 'ks'         | 优化指标 ('ks' 或 'auc')                                     |
| `train_val_ks_diff_threshold`   | float     |      | 0.05         | 训练验证 KS 差异阈值                                         |
| `coeffcient_overfit_punishment` | float     |      | 0.5          | 过拟合惩罚系数                                               |
| `num_workers`                   | int       |      | 4            | Worker 数量                                                  |
| `cpu_per_worker`                | int       |      | 4            | 每个 Worker 的 CPU                                           |
| `memory_per_worker`             | int       |      | 16           | 每个 Worker 的内存 (GB)                                      |

#### init_hypers 格式示例

```python
init_hypers = {
    'objective': 'binary',
    'metric': ['binary_logloss', 'auc'],
    'learning_rate': {'type': 'uniform', 'lower': 0.01, 'upper': 0.1},
    'max_depth': {'type': 'randint', 'lower': 3, 'upper': 8},
    'num_leaves': {'type': 'randint', 'lower': 20, 'upper': 100},
    'feature_fraction': {'type': 'uniform', 'lower': 0.4, 'upper': 0.8},
    'bagging_fraction': {'type': 'uniform', 'lower': 0.4, 'upper': 0.8},
    'reg_alpha': {'type': 'loguniform', 'lower': 0.1, 'upper': 100},
    'reg_lambda': {'type': 'loguniform', 'lower': 0.1, 'upper': 100},
}
```

### 输出

| 输出                         | 路径参数                    | 说明                     |
| ---------------------------- | --------------------------- | ------------------------ |
| **Best Model**         | `best_model_filepath`     | 最佳模型 (.pkl)          |
| **Best Hypers**        | `best_hypers_path`        | 最佳超参数 (parquet)     |
| **Feature Importance** | `feature_importance_path` | 特征重要性 (parquet)     |
| **BO History**         | `bo_history_path`         | 贝叶斯优化历史 (parquet) |
| **Predict Result**     | `predict_result_path`     | 预测结果 (parquet)       |

---

## 7. Model Train (模型训练)

使用固定超参数训练 LightGBM 模型。

### 输入参数

| 参数                       | 类型      | 必填 | 默认值       | 说明                                               |
| -------------------------- | --------- | ---- | ------------ | -------------------------------------------------- |
| `sample_path`            | str       | ✅   | -            | 数据路径 (S3 parquet)                              |
| `label`                  | str       | ✅   | -            | 标签列名                                           |
| `best_model_filepath`    | str       | ✅   | -            | 模型保存路径 (S3 .pkl)                             |
| `checkpoint_path`        | str       | ✅   | -            | Checkpoint 保存路径 (S3)                           |
| `sample_use_col`         | str       |      | 'sample_use' | 样本使用列 (区分 train/test)                       |
| `exclude_cols`           | List[str] |      | None         | 排除的列列表                                       |
| `feature_selection_path` | str       |      | None         | 特征选择结果路径                                   |
| `use_feature_selection`  | List[str] |      | None         | 使用的特征选择方法                                 |
| `sample_weight_col`      | str       |      | None         | 样本权重列                                         |
| `auxilary_cols`          | List[str] |      | None         | 辅助列 (预测时保留)                                |
| `fp_base`                | str       |      | ''           | 允许删除的路径前缀                                 |
| `predict_result_path`    | str       |      | None         | 预测结果保存路径 (S3 parquet)                      |
| `best_hyper_filepath`    | str       |      | None         | 最佳超参数文件路径 (优先使用)                      |
| `hypers`                 | Dict      |      | None         | 超参数字典 (如果 best_hyper_filepath 未提供则使用) |
| `auto_scale_pos_weight`  | bool      |      | False        | 是否自动计算 scale_pos_weight                      |
| `num_workers`            | int       |      | 4            | Worker 数量                                        |
| `cpu_per_worker`         | int       |      | 4            | 每个 Worker 的 CPU                                 |
| `memory_per_worker`      | int       |      | 16           | 每个 Worker 的内存 (GB)                            |

### 输出

| 输出                     | 路径参数                | 说明                |
| ------------------------ | ----------------------- | ------------------- |
| **Trained Model**  | `best_model_filepath` | 训练好的模型 (.pkl) |
| **Predict Result** | `predict_result_path` | 预测结果 (parquet)  |

---

## 8. Model Predict (模型预测)

使用训练好的模型进行批量预测。

### 输入参数

| 参数                    | 类型      | 必填 | 默认值 | 说明                           |
| ----------------------- | --------- | ---- | ------ | ------------------------------ |
| `sample_path`         | str       | ✅   | -      | 数据路径 (S3 parquet)          |
| `model_filepath`      | str       | ✅   | -      | 模型文件路径 (S3 .pkl)         |
| `predict_result_path` | str       | ✅   | -      | 预测结果保存路径 (S3 parquet)  |
| `feature_cols`        | List[str] |      | None   | 特征列列表 (None 则从模型获取) |
| `auxilary_cols`       | List[str] |      | None   | 辅助列列表 (预测时保留)        |
| `exclude_cols`        | List[str] |      | None   | 排除的列列表                   |
| `fp_base`             | str       |      | ''     | 允许删除的路径前缀             |
| `num_workers`         | int       |      | 4      | Worker 数量                    |

### 输出

| 输出                     | 路径参数                | 说明                                 |
| ------------------------ | ----------------------- | ------------------------------------ |
| **Predict Result** | `predict_result_path` | 预测结果，包含 `pred` 列 (parquet) |

---

## 9. Model BM (Benchmark Model - 逻辑回归)

将多个子模型的预测结果通过逻辑回归组合成 Mega Model。

### 输入参数 (model_bm - 基础版本)

| 参数                    | 类型      | 必填 | 默认值 | 说明                          |
| ----------------------- | --------- | ---- | ------ | ----------------------------- |
| `sample_path`         | str       | ✅   | -      | 数据路径 (S3 parquet)         |
| `label`               | str       | ✅   | -      | 标签列名                      |
| `submodel_list`       | List[str] | ✅   | -      | 子模型特征列表                |
| `model_filepath`      | str       | ✅   | -      | 模型保存路径 (S3 .pkl)        |
| `predict_result_path` | str       | ✅   | -      | 预测结果保存路径 (S3 parquet) |
| `sample_use_col`      | str       |      | None   | 样本使用列 (区分 train/test)  |
| `auxilary_cols`       | List[str] |      | None   | 辅助列列表                    |
| `fp_base`             | str       |      | ''     | 允许删除的路径前缀            |
| `positive_coef`       | bool      |      | False  | 是否强制正系数                |
| `remove_method`       | str       |      | 'iv'   | 特征移除方法                  |
| `pvalue_threshold`    | float     |      | 0.05   | p值阈值                       |

### 输入参数 (model_bm_v2 - Ray IRLS 版本，处理submodel)

| 参数                          | 类型      | 必填 | 默认值      | 说明                             |
| ----------------------------- | --------- | ---- | ----------- | -------------------------------- |
| `sample_path`               | str       | ✅   | -           | 数据路径 (S3 parquet)            |
| `label`                     | str       | ✅   | -           | 标签列名                         |
| `model_filepath`            | str       | ✅   | -           | 模型保存路径 (S3 .pkl)           |
| `predict_result_path`       | str       | ✅   | -           | 预测结果保存路径 (S3 parquet)    |
| `submodel_list`             | List[str] |      | None        | 子模型特征列表 (None 则自动选择) |
| `sample_use_col`            | str       |      | None        | 样本使用列                       |
| `auxilary_cols`             | List[str] |      | None        | 辅助列列表                       |
| `exclude_cols`              | List[str] |      | None        | 排除的列列表                     |
| `fp_base`                   | str       |      | ''          | 允许删除的路径前缀               |
| `positive_coef`             | bool      |      | True        | 是否强制正系数                   |
| `remove_method`             | str       |      | 'iv'        | 特征移除方法                     |
| `pvalue_threshold`          | float     |      | 0.05        | p值阈值                          |
| `enable_feature_selection`  | bool      |      | False       | 是否启用特征选择                 |
| `feature_selection_path`    | str       |      | None        | 特征选择文件路径                 |
| `feature_selection_methods` | List[str] |      | None        | 特征选择方法列表                 |
| `enable_coef_selection`     | bool      |      | True        | 是否启用系数选择                 |
| `enable_pvalue_selection`   | bool      |      | True        | 是否启用 p 值选择                |
| `coef_remove_batch`         | bool      |      | False       | 是否批量移除系数                 |
| `model_backend`             | str       |      | 'ray_logit' | 模型后端                         |
| `ray_model_params`          | Dict      |      | None        | Ray 模型参数                     |
| `parallelism`               | int       |      | None        | 并行度                           |

### 输出

| 输出                     | 路径参数                | 说明                    |
| ------------------------ | ----------------------- | ----------------------- |
| **Mega Model**     | `model_filepath`      | 逻辑回归模型 (.pkl)     |
| **Predict Result** | `predict_result_path` | Mega 预测结果 (parquet) |

---

## 10. Calibrate Fit (校准模型拟合)

拟合校准模型，将概率转换为分数。

### 输入参数 (calibrate_fit - 单阶段校准)

| 参数                 | 类型      | 必填 | 默认值 | 说明                         |
| -------------------- | --------- | ---- | ------ | ---------------------------- |
| `sample_path`      | str       | ✅   | -      | 数据路径 (S3 parquet)        |
| `label`            | str       | ✅   | -      | 标签列名                     |
| `feature_list`     | List[str] | ✅   | -      | 特征列列表 (要校准的分数列)  |
| `model_filepath`   | str       | ✅   | -      | 模型保存路径 (S3 .pkl)       |
| `sample_use_col`   | str       |      | None   | 样本使用列                   |
| `sample_use_value` | List[str] |      | None   | 样本使用值列表，如 ['train'] |
| `auxilary_cols`    | List[str] |      | None   | 辅助列列表                   |
| `n_bins`           | int       |      | 10     | 分箱数量                     |
| `n_degree`         | int       |      | 3      | 多项式次数                   |
| `score_type`       | str       |      | 'prob' | 分数类型 ('prob' / 'score')  |

### 输入参数 (multi_stage_calibrate_fit - 多阶段校准)

| 参数                 | 类型        | 必填 | 默认值 | 说明                                   |
| -------------------- | ----------- | ---- | ------ | -------------------------------------- |
| `sample_path`      | str         | ✅   | -      | 数据路径 (S3 parquet)                  |
| `label`            | str         | ✅   | -      | 标签列名                               |
| `feature_list`     | List[str]   | ✅   | -      | 特征列列表 (要校准的分数列)            |
| `model_filepath`   | str         | ✅   | -      | 模型保存路径 (S3 .pkl)                 |
| `sample_use_col`   | str         |      | None   | 样本使用列                             |
| `sample_use_value` | List[str]   |      | None   | 样本使用值列表                         |
| `auxilary_cols`    | List[str]   |      | None   | 辅助列列表                             |
| `n_bins`           | int         |      | 10     | 分箱数量                               |
| `n_degree`         | int         |      | 3      | 多项式次数                             |
| `score_type`       | str         |      | 'prob' | 分数类型                               |
| `n_stages`         | int         |      | 1      | 阶段数量                               |
| `breakpoints`      | List[float] |      | None   | 阶段断点列表，如 [900, 600]            |
| `label_term`       | str         |      | None   | 标签期限 ('1term' / '3term' / '6term') |

### 输出

| 输出                 | 路径参数           | 说明            |
| -------------------- | ------------------ | --------------- |
| **Calibrator** | `model_filepath` | 校准模型 (.pkl) |

---

## 11. Calibrate Transform (校准模型转换)

使用校准模型将概率转换为分数。

### 输入参数 (calibrate_transform - 单阶段)

| 参数               | 类型      | 必填 | 默认值 | 说明                        |
| ------------------ | --------- | ---- | ------ | --------------------------- |
| `sample_path`    | str       | ✅   | -      | 数据路径 (S3 parquet)       |
| `model_filepath` | str       | ✅   | -      | 校准模型路径 (S3 .pkl)      |
| `result_path`    | str       | ✅   | -      | 结果保存路径 (S3 parquet)   |
| `feature_list`   | List[str] | ✅   | -      | 特征列列表 (要校准的分数列) |
| `auxilary_cols`  | List[str] |      | None   | 辅助列列表 (输出时保留)     |
| `fp_base`        | str       |      | ''     | 允许删除的路径前缀          |

### 输入参数 (multi_stage_calibrate_transform - 多阶段)

| 参数               | 类型      | 必填 | 默认值 | 说明                        |
| ------------------ | --------- | ---- | ------ | --------------------------- |
| `sample_path`    | str       | ✅   | -      | 数据路径 (S3 parquet)       |
| `model_filepath` | str       | ✅   | -      | 校准模型路径 (S3 .pkl)      |
| `result_path`    | str       | ✅   | -      | 结果保存路径 (S3 parquet)   |
| `feature_list`   | List[str] | ✅   | -      | 特征列列表 (要校准的分数列) |
| `auxilary_cols`  | List[str] |      | None   | 辅助列列表 (输出时保留)     |
| `fp_base`        | str       |      | ''     | 允许删除的路径前缀          |

### 输出

| 输出                       | 路径参数        | 说明                   |
| -------------------------- | --------------- | ---------------------- |
| **Calibrated Score** | `result_path` | 校准后的分数 (parquet) |

---

## 辅助工具

### WOE 编码器维护

#### woe_update (重设分箱边界)

| 参数                 | 类型 | 必填 | 默认值       | 说明                                          |
| -------------------- | ---- | ---- | ------------ | --------------------------------------------- |
| `feature_name`     | str  | ✅   | -            | 特征名称                                      |
| `data_path`        | str  | ✅   | -            | 数据目录路径 (S3)                             |
| `encoder_filepath` | str  | ✅   | -            | 原 encoder 文件路径 (S3 .pkl)                 |
| `ws_list`          | List | ✅   | -            | 新的分箱边界列表，如 [-inf, -0.12, 0.35, inf] |
| `output_filepath`  | str  | ✅   | -            | 输出文件路径 (S3 .pkl)                        |
| `sample_use_col`   | str  |      | 'sample_use' | 样本使用列                                    |

#### woe_update_by_adding_cutoff (添加分箱切点)

| 参数                 | 类型  | 必填 | 默认值       | 说明                          |
| -------------------- | ----- | ---- | ------------ | ----------------------------- |
| `feature_name`     | str   | ✅   | -            | 特征名称                      |
| `data_path`        | str   | ✅   | -            | 数据目录路径 (S3)             |
| `encoder_filepath` | str   | ✅   | -            | 原 encoder 文件路径 (S3 .pkl) |
| `cutoff`           | float | ✅   | -            | 新增分箱切点                  |
| `output_filepath`  | str   | ✅   | -            | 输出文件路径 (S3 .pkl)        |
| `sample_use_col`   | str   |      | 'sample_use' | 样本使用列                    |

#### set_woe (手动设置 WOE 值)

| 参数                 | 类型  | 必填 | 默认值 | 说明                       |
| -------------------- | ----- | ---- | ------ | -------------------------- |
| `encoder_filepath` | str   | ✅   | -      | encoder 文件路径 (S3 .pkl) |
| `feature_name`     | str   | ✅   | -      | 特征名称                   |
| `bin_name`         | str   | ✅   | -      | 分箱名称                   |
| `woe_value`        | float | ✅   | -      | 新的 WOE 值                |
| `output_filepath`  | str   | ✅   | -      | 输出文件路径 (S3 .pkl)     |

#### encoder_combine (合并多个 encoder)

| 参数                  | 类型            | 必填 | 默认值 | 说明                                 |
| --------------------- | --------------- | ---- | ------ | ------------------------------------ |
| `encoder_filepaths` | List[str] / str | ✅   | -      | encoder 文件路径列表或逗号分隔字符串 |
| `output_filepath`   | str             | ✅   | -      | 输出文件路径 (S3 .pkl)               |
| `feature_list`      | List[str] / str |      | None   | 可选，仅保留指定特征                 |

### 数据处理

#### upload_parquet (上传 Parquet)

| 参数           | 类型 | 必填 | 默认值 | 说明                      |
| -------------- | ---- | ---- | ------ | ------------------------- |
| `data_path`  | str  | ✅   | -      | 源数据路径 (S3 parquet)   |
| `save_path`  | str  | ✅   | -      | 目标保存路径 (S3 parquet) |
| `file_count` | int  |      | 100    | 分区文件数量              |

### 模型转换

#### convert_woe_to_standalone (WOE 转独立版本)

| 参数                | 类型 | 必填 | 默认值 | 说明                                    |
| ------------------- | ---- | ---- | ------ | --------------------------------------- |
| `input_filepath`  | str  | ✅   | -      | 输入文件路径 (S3 .pkl)                  |
| `output_filepath` | str  |      | None   | 输出文件路径，默认添加 _standalone 后缀 |

#### convert_calibrate_to_standalone (Calibrator 转独立版本)

| 参数                | 类型 | 必填 | 默认值 | 说明                                    |
| ------------------- | ---- | ---- | ------ | --------------------------------------- |
| `input_filepath`  | str  | ✅   | -      | 输入文件路径 (S3 .pkl)                  |
| `output_filepath` | str  |      | None   | 输出文件路径，默认添加 _standalone 后缀 |

---

## 完整 Pipeline 示例

```python
from risk_model_on_ray.ray_util.ray_helper.ray_util import RayUtil
from ray.runtime_env import RuntimeEnv

# 初始化 RayUtil
ray_util = RayUtil(
    cluster_name='risk-model-training',
    rayhub_addr='https://rayhub.data-infra.shopee.io',
    hadoop_user_name='your_account',
    hadoop_user_password='your_password',
    runtime_env=RuntimeEnv(pip=['lightgbm', 'modin[ray]']),
    s3_endpoint='https://s3.your-endpoint.com',
)

# ================== Step 1: WOE Fit ==================
ray_util.woe_fit(
    feature_name='user_features',
    data_path='s3://bucket/data/raw/user_features',
    encoder_save_filepath='s3://bucket/models/woe/user_features_best_ks_5bin.pkl',
    label='is_bad',
    n_bins=5,
    min_bin_rate=0.02,
    min_bin_size=50,
    min_missing_bad_cnt=30,
    method='best_ks',
    transform_method='woe',
    categorical_features=['category_col1', 'category_col2'],
    missing_values=[-9999, -9998],
    missing_logic={'col1': 'high_risk', 'col2': 'neutral'},
    dict_nbins={'special_col': 10},
    exclude=['userid', 'activation_date'],
)

# ================== Step 2: Feature Report (可选) ==================
ray_util.feature_report(
    feature_name='user_features',
    data_path='s3://bucket/data/raw/user_features',
    encoder_load_filepath='s3://bucket/models/woe/user_features_best_ks_5bin.pkl',
    report_filepath='s3://bucket/reports/user_features_report.xlsx',
    label='is_bad',
    sample_type='train',
    pkey='userid',
    dim='activation_date',
    n_bins=5,
    sample_use_col='sample_use',
    reports=['performance', 'trend', 'stability', 'mono'],
)

# ================== Step 3: WOE Transform ==================
ray_util.woe_transform(
    feature_name='user_features',
    data_path='s3://bucket/data/raw/user_features',
    encoder_load_filepath='s3://bucket/models/woe/user_features_best_ks_5bin.pkl',
    data_save_path='s3://bucket/data/woe/user_features_5bin',
    sample_type='training_features',
    model_level='sub',
    transform_method='woe',
)

# ================== Step 4: WOE Merge ==================
ray_util.woe_merge(
    data_path_dict={
        'user_features': 's3://bucket/data/woe/user_features_5bin',
        'order_features': 's3://bucket/data/woe/order_features_5bin',
    },
    data_save_path='s3://bucket/data/merged/user_and_order',
    on='userid',
    how='inner',
    n_partitions=30,
    cpu_count=100,
)

# ================== Step 5: Feature Selection ==================
ray_util.feature_selection_v2(
    data_path='s3://bucket/data/merged/user_and_order',
    output_filepath='s3://bucket/reports/fs/selection_report.csv',
    label='is_bad',
    model_name='user_and_order',
    sample_use_col='sample_use',
    fs_methods=['by_iv', 'by_corr', 'by_psi', 'by_gini'],
    iv_threshold=0.02,
    corr_threshold=0.7,
    psi_threshold=0.25,
)

# ================== Step 6: Model Tune ==================
ray_util.model_tune(
    sample_path='s3://bucket/data/merged/user_and_order',
    label='is_bad',
    best_hypers_path='s3://bucket/models/tune/best_hypers',
    best_model_filepath='s3://bucket/models/tune/best_model.pkl',
    feature_importance_path='s3://bucket/models/tune/feature_importance',
    bo_history_path='s3://bucket/models/tune/bo_history',
    predict_result_path='s3://bucket/models/tune/predict_result',
    checkpoint_path='s3://bucket/models/tune/checkpoint',
    sample_use_col='sample_use',
    exclude_cols=['userid', 'activation_date', 'sample_use'],
    feature_selection_path='s3://bucket/reports/fs/selection_report.csv',
    use_feature_selection=['by_iv', 'by_corr'],
    auxilary_cols=['userid', 'activation_date', 'is_bad'],
    init_hypers={
        'objective': 'binary',
        'metric': ['binary_logloss', 'auc'],
        'learning_rate': {'type': 'uniform', 'lower': 0.01, 'upper': 0.1},
        'max_depth': {'type': 'randint', 'lower': 3, 'upper': 8},
        'num_leaves': {'type': 'randint', 'lower': 20, 'upper': 100},
    },
    n_trials=50,
    metric_for_tune='ks',
    train_val_ks_diff_threshold=0.05,
    coeffcient_overfit_punishment=0.5,
    num_workers=10,
    cpu_per_worker=4,
    memory_per_worker=16,
)

# ================== Step 7: Model Train ==================
ray_util.model_train(
    sample_path='s3://bucket/data/merged/user_and_order',
    label='is_bad',
    best_model_filepath='s3://bucket/models/train/lgb_model.pkl',
    checkpoint_path='s3://bucket/models/train/checkpoint',
    sample_use_col='sample_use',
    exclude_cols=['userid', 'activation_date', 'sample_use'],
    feature_selection_path='s3://bucket/reports/fs/selection_report.csv',
    use_feature_selection=['by_iv', 'by_corr'],
    auxilary_cols=['userid', 'activation_date', 'is_bad'],
    predict_result_path='s3://bucket/results/train_predict',
    best_hyper_filepath='s3://bucket/models/tune/best_hypers',
    auto_scale_pos_weight=True,
    num_workers=20,
    cpu_per_worker=4,
    memory_per_worker=16,
)

# ================== Step 8: Model Predict ==================
ray_util.model_predict(
    sample_path='s3://bucket/data/oot/oot_data',
    model_filepath='s3://bucket/models/train/lgb_model.pkl',
    predict_result_path='s3://bucket/results/oot_predict',
    auxilary_cols=['userid', 'activation_date', 'is_bad'],
    num_workers=10,
)

# ================== Step 9: Benchmark Model ==================
ray_util.model_bm_v2(
    sample_path='s3://bucket/data/submodel_scores',
    label='is_bad',
    model_filepath='s3://bucket/models/mega/logit_model.pkl',
    predict_result_path='s3://bucket/results/mega_predict',
    submodel_list=['user_score', 'order_score', 'device_score'],
    sample_use_col='sample_use',
    auxilary_cols=['userid', 'activation_date'],
    positive_coef=True,
    remove_method='iv',
    pvalue_threshold=0.05,
    enable_coef_selection=True,
    enable_pvalue_selection=True,
)

# ================== Step 10: Calibrate Fit ==================
ray_util.multi_stage_calibrate_fit(
    sample_path='s3://bucket/results/mega_predict',
    label='is_bad',
    feature_list=['pred'],
    model_filepath='s3://bucket/models/calibrate/calibrator.pkl',
    sample_use_col='sample_use',
    sample_use_value=['train', 'test'],
    auxilary_cols=['userid', 'activation_date'],
    n_bins=20,
    n_degree=1,
    score_type='megascore',
    n_stages=3,
    breakpoints=[900, 600],
    label_term='6term',
)

# ================== Step 11: Calibrate Transform ==================
ray_util.multi_stage_calibrate_transform(
    sample_path='s3://bucket/results/mega_predict',
    model_filepath='s3://bucket/models/calibrate/calibrator.pkl',
    result_path='s3://bucket/results/final_scores',
    feature_list=['pred'],
    auxilary_cols=['userid', 'activation_date', 'is_bad'],
)

print("Pipeline completed!")
```

---

## 数据流向图

```
                           ┌─────────────────────────────────────────────────────────────────┐
                           │               Feature Domain 1 (e.g. user_features)            │
┌─────────────────┐        │  ┌─────────────┐              ┌─────────────────────────┐       │
│  Raw Data 1     │────────┼─▶│   woe_fit   │─▶ Encoder 1 ─▶│      woe_transform      │──────┼───┐
│  (user_features)│        │  └─────────────┘              └─────────────────────────┘       │   │
└─────────────────┘        │         │ (Optional)                                            │   │
                           │         ▼                                                       │   │
                           │  ┌─────────────────┐                                            │   │
                           │  │ feature_report  │                                            │   │
                           │  └─────────────────┘                                            │   │
                           └─────────────────────────────────────────────────────────────────┘   │
                                                                                                 │
                           ┌─────────────────────────────────────────────────────────────────┐   │
                           │               Feature Domain 2 (e.g. order_features)           │   │
┌─────────────────┐        │  ┌─────────────┐              ┌─────────────────────────┐       │   │
│  Raw Data 2     │────────┼─▶│   woe_fit   │─▶ Encoder 2 ─▶│      woe_transform      │──────┼───┼───┐
│  (order_features)        │  └─────────────┘              └─────────────────────────┘       │   │   │
└─────────────────┘        └─────────────────────────────────────────────────────────────────┘   │   │
                                                                                                 │   │
                           ┌─────────────────────────────────────────────────────────────────┐   │   │
                           │               Feature Domain N ...                              │   │   │
┌─────────────────┐        │  ┌─────────────┐              ┌─────────────────────────┐       │   │   │
│  Raw Data N     │────────┼─▶│   woe_fit   │─▶ Encoder N ─▶│      woe_transform      │──────┼───┼───┼───┐
└─────────────────┘        │  └─────────────┘              └─────────────────────────┘       │   │   │   │
                           └─────────────────────────────────────────────────────────────────┘   │   │   │
                                                                                                 │   │   │
                                                                                                 ▼   ▼   ▼
                           ┌─────────────────────────────────────────────────────────────────────────────────┐
                           │                         woe_merge (可在 Spark 完成)                             │
                           │                                                                                 │
                           │    Transformed Data 1 ─────┐                                                    │
                           │    Transformed Data 2 ─────┼───▶ JOIN on userid ───▶ Merged Data               │
                           │    Transformed Data N ─────┘                                                    │
                           │                                                                                 │
                           └───────────────────────────────────────────┬─────────────────────────────────────┘
                                                                       │
                                                                       ▼
                                                        ┌─────────────────────────┐     ┌───────────────────┐
                                                        │    feature_selection    │────▶│  Selection Report │
                                                        │  (IV/Corr/PSI/Gini)     │     │      (.csv)       │
                                                        └───────────┬─────────────┘     └───────────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐     ┌───────────────────┐
                                                        │      model_tune         │────▶│    Best Hypers    │
                                                        │      (Ray Tune)         │     │    (.parquet)     │
                                                        └───────────┬─────────────┘     └─────────┬─────────┘
                                                                    │                             │
                                                                    ▼                             │
                                                        ┌─────────────────────────┐◀──────────────┘
                                                        │      model_train        │
                                                        │      (LightGBM)         │
                                                        └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐
                                                        │     LightGBM Model      │
                                                        │         (.pkl)          │
                                                        └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐
                                                        │     model_predict       │
                                                        └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐
                                                        │    Sub-model Scores     │
                                                        │     (Predictions)       │
                                                        └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐     ┌───────────────────┐
                                                        │       model_bm          │────▶│    Mega Model     │
                                                        │    (Logistic Reg)       │     │      (.pkl)       │
                                                        └───────────┬─────────────┘     └───────────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐
                                                        │    Mega Predictions     │
                                                        └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐     ┌───────────────────┐
                                                        │     calibrate_fit       │────▶│    Calibrator     │
                                                        └───────────┬─────────────┘     │      (.pkl)       │
                                                                    │                   └─────────┬─────────┘
                                                                    │                             │
                                                                    ▼                             │
                                                        ┌─────────────────────────┐◀──────────────┘
                                                        │   calibrate_transform   │
                                                        └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                        ┌─────────────────────────┐
                                                        │      Final Score        │
                                                        │      (MegaScore)        │
                                                        └─────────────────────────┘
```
