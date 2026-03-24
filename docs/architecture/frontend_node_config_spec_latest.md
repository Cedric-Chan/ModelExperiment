# 🎯 **模型训练平台 - 节点配置 v2.0**

## 📐 **设计原则**

```
1. 基于《分布式训练使用手册 v1.3》的参数
2. 统一结构：输入路径 + 节点配置 + 资源配置 + 输出路径
3. 节点配置 = 数据配置 + 参数配置
4. 全局变量在 Pipeline 级别配置，所有节点共享
```

---


## 🏗️ **节点总览**

```
风控模型训练平台节点
│
├─ Node 1: Data Load（数据读取）
├─ Node 2: WOE Fit（WOE编码器训练）
├─ Node 3: WOE Transform（WOE转换应用）
├─ Node 4: Feature Selection（特征选择）
├─ Node 5: Hyperparameter Tuning + Model Training（超参调优+模型训练）
└─ Node 6: Model Prediction（模型预测）

```

---
## 🌍 **pipeline级别配置（Pipeline Level）**

> **说明**：作用于整条pipeline，所有节点共享，节点可以选择使用或覆盖

```yaml
  model_level:
    type: string
    required: true
    default: "sub"
    options: ["sub", "mega"]
    description: "Pipeline 训练目标层级（决定整个 Pipeline 的数据流向）"
    note: |
      # - sub: 训练子模型（从原始特征开始）
      #   数据流: 原始特征 → WOE Fit → WOE Transform → 子模型训练
      #   输入示例: s3://.../features/acard_ft_user_v1
      
      # - mega: 训练 Mega 模型（从子模型预测结果开始）
      #   数据流: 子模型分数 → WOE Fit → WOE Transform → Mega 模型训练
      #   输入示例: s3://.../model/train/predict_result/user_and_order_5bin/v5
      
      # - 此配置会影响所有节点的输入/输出路径
      # - Pipeline 创建后不可修改（需要创建新 Pipeline）"

  base_train_path: 
    type: string
    required: true
    default: "{fp_data}/{model_name}/{run_id}"
    description: "本次Pipeline 训练数据根路径"

  label_column:
    type: string
    required: true
    default: "label_dpd30_3term"
    description: "全局标签列名（所有节点默认使用此列）"
    note: "节点可以通过 data_config.label_column 覆盖"
  
  categorical_columns:
    type: list
    required: true
    default: ["user_acct_status", "user_is_email_verified", "user_gender"]
    description: "全局枚举列列名（所有节点默认使用此列）"
    note: "节点可以通过 data_config.categorical_columns 覆盖"

  sample_type_column:
    type: string 
    required: true
    description: "数据类型列名,该列内容包含train/test/val/all"
    note: "数据类型列"

  # ========== 全局排除列 ==========
  exclude_columns:
    type: list
    required: false
    default: [
      "userid", "activation_term", "label_dpd30_3term", "user_create_time",
      "mp_order_create_time", "dp_order_create_time", "mp_lgx_create_time",
      "mp_item_create_time", "activation_date", "sample_use", "credit_user_id",
      "airpay_user_id", "grass_date", "score_date", "user_type", "sample_type",
      "1term_dpd12", "1term_dpd30", "2term_dpd30", "3term_dpd30",
      "activation_month", "bill_term", "bill_date", "clear_date",
      "overdue_date", "2term_max_overdue_date", "3term_max_overdue_date",
      "spl_bill_day", "spl_overdue_day", "spl_bill_cnt", "is_overdue",
      "is_acct_frozen", "has_airpay", "has_device", "has_contact",
      "spl_bill_num", "spl_frozen_tag", "spl_overdue_tag", "bcl_ascore",
      "bcl_credit_behavior_subscore", "bcl_user_and_order_subscore",
      "bcl_ecomm_behavior_subscore", "bcl_payment_subscore",
      "bcl_device_and_app_subscore", "first_activation_month",
      "first_activation_time", "first_activation_week", "is_cod_user"
    ]
    description: "全局排除列列表（不参与训练，但保留在数据中）"
    note: "节点可以通过 data_config.exclude 追加额外排除列（不会覆盖全局配置）"

  # ========== 特征组级别剔除配置 ==========
  removed_features:
    type: list
    required: false,
    default: ["user_has_set_up_password", "device_hf_app_version_01", "user_phone"]
    description: "特征组级别剔除配置，本来是使用特征组名称路由获取，现在需要手动定义",
    example: ["user_has_set_up_password", "device_hf_app_version_01", "user_phone"]

  # ========== 默认资源配置 ==========
  default_cpu:
    type: string
    required: false
    default: "4"
    description: "默认 CPU 核数（节点未指定时使用）"
  
  default_memory:
    type: string
    required: false
    default: "8"
    description: "默认内存大小（节点未指定时使用）"
  
  default_image:
    type: string
    required: false
    default: "risk-model-training:latest"
    description: "默认 Docker 镜像（节点未指定时使用）"
```
---

## 🚀 **Node 1: Data Source（数据读取）**

> **功能**：从数据源读取数据，进行数据划分和列标准化  
> **数据流**：原始数据源（Hive/S3）→ 标准化后的特征数据  
> **起始节点**：没有输入

### **1.1 节点配置**

#### **1.1.1 数据配置**
> 前端将数据配置与数据输入相联系，作为数据输入的config表单
```yaml
data_config:

  input:
    data_source:
      type: string
      required: true
      description: "数据源路径，支持 Hive表, S3路径暂不支持"
    
    table_name:
      type: string
      required: true
      description: "Hive表名"

    schema: 
      type: string
      required: true
      description: "数据源路径，支持 Hive 表table"

  partition_filter:
    type: string
    required: false
    default: null
    description: "分区/条件筛选的 WHERE 语句, 可以是分区时间或者是oot的时间内"
    example: "grass_date >= '2024-01-01' AND grass_date <= '2024-12-31'"
    note: "SQL WHERE 子句，不需要包含 WHERE 关键字"

  # ========== 样本划分配置 ==========
  sample_type_column:
    type: string
    required: false
    default: "sample_type"
    description: "用户指定的样本划分列名（区分 train/test/val 的标识列）"
    example: "sample_type"
      
  split_ratio:
    type: dict
    required: false
    default: {"train": 0.7, "test": 0.2, "val": 0.1}
    description: "数据划分比例（仅当 sample_type_column 为空时生效）"
    example: {"train": 0.7, "test": 0.2, "val": 0.1}
    note: "三个比例之和必须等于 1.0"
  
  random_seed:
    type: int
    required: false
    default: 42
    description: "随机种子（用于数据划分的可复现性）"
  
  # ========== 标签列配置 ==========
  label_column:
    type: string
    required: true
    description: "用户指定的标签列名"
    example: "label_dpd30_3term"
    note: "默认使用全局变量"
  
  # ========== 特征类型配置 ==========
  categorical_columns:
    type: list
    required: false
    default: []
    description: "分类特征列名列表，会作为全局变量保存，后续节点可以使用"
    example: ["user_acct_status", "user_is_email_verified", "user_gender"]
    note: "默认使用全局变量"
  
  # # ========== 排除列配置 非特征列 ==========
  # exclude_columns:
  #   type: list
  #   required: false
  #   default: []
  #   description: "需要从特征中排除的列（会保留在数据中，但不参与训练）"
  #   example: ["request_id", "create_time", "update_time"]
  #   note: "默认使用全局变量"
```

### **1.3 资源配置**

```yaml
resources:
  cpu:
    type: string
    required: false
    default: BaseConfig.resources.cpu
    description: "默认使用全局变量"
  
  memory:
    type: string
    required: false
    default: BaseConfig.resources.memory
    description: "默认使用全局变量"
  
  image:
    type: string
    required: false
    default: BaseConfig.resources.image
    description: "默认使用全局变量"
```

### **1.4 输出路径**

```yaml
output:
  data_output_path:
    type: data
    value_type: string
    data_format: "parquet"
    required: false
    default: "{fp_base}/{model_name}{run_id}/data/loaded/"
    description: "加载后的数据输出路径（null=自动生成）"
    # example: "s3://sg-risk-model-prod/risk/id/spl_acard/run_123/data/loaded/" 
```


---

## 📦 **Node 2: WOE Fit（WOE编码器训练）**

> **功能**：对训练集进行分箱，生成WOE编码器  
> **数据流**：原始特征数据 → WOE编码器（.pkl文件）

### **2.1 输入路径**

```yaml
input:
  data_path:
    type: data 
    value_type: string
    required: false                                # 有默认值，非必填
    default: "{fp_base}/{model_name}/{run_id}/features"   
    data_format: "parquet"
    # model_level='sub': {fp_features}/{feature_name}
    # model_level='mega': {fp_model_woe_merge_data}/training_features_{feature_name}
    description: "原始特征数据的 S3 路径，脚本会自动过滤 sample_type='train' 的数据"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/features"
```

### **2.2 节点配置**

#### **2.2.1 数据配置**

```yaml
data_config:
  # ========== 可选参数（带默认值）==========
  sample_type: 
    type: string
      required: false
      default: "train"
      options: ["train", "test", "val", "all"]
      description: "数据筛选, 默认使用train"

  label:
    type: string
    required: false
    default: "BaseConfig.label"
    description: "标签列名，全局配置"
    example: "label_dpd30_3term"
  
  categorical_features:
    type: list
    required: false
    default: "BaseConfig.feature_info[feature].categorical_features"
    description: "分类特征列表, 默认全局配置,用户更改则全覆盖"
    example: ["user_acct_status", "user_is_email_verified"]
  
  missing_values:
    type: list
    required: false
    default: [-9999,-9998,-9997,-999998,-999999,999999,-990000,-999990],
    description: "缺失值列表（列表中的所有值都会被识别为缺失值并单独分箱）"
  
  missing_logic:
    type: dict
    required: false
    default: null
    description: "缺失值的风险映射策略（决定缺失值箱的 WOE 值）"
    example: {"user_is_phone_verified": "high_risk", "user_acct_status": "neutral"}
    options_per_feature: ["high_risk", "low_risk", "neutral"]
    note: |
      - high_risk: 缺失值赋予最小 WOE（最高风险，适用于缺失=高风险的场景）
      - low_risk: 缺失值赋予最大 WOE（最低风险，适用于缺失=低风险的场景）
      - neutral: 缺失值赋予 0（中性，适用于缺失无明确风险倾向的场景）
      - 默认所有特征使用 high_risk
  
  exclude_columns:
    type: list
    required: false
    default: "BaseConfig.exclude_columns + feature_info.removed_features"
    description: "训练时剔除的列，最终 exclude = base_config.exclude + removed_features + 用户传入的 exclude（追加，不覆盖）"
    example: ["userid", "activation_date"]
```

#### **2.2.2 参数配置**

```yaml
algorithm_config:
  # ========== 全局分箱参数 ==========
  n_bins:
    type: int
    required: false
    default: 5
    description: "全局分箱数，可被 dict_nbins 覆盖"
  
  method:
    type: string
    required: false
    default: "best_ks"
    options: ["best_ks", "quantile"]
    description: "分箱策略"
  
  # transform_method:  # 不暴露给用户 但是需要保留这个参数
  #   type: string
  #   required: false
  #   default: "woe"
  #   options: ["woe", "bin"]
  #   description: "输出编码方式"
  
  min_bin_rate:
    type: float
    required: false
    default: 0.02
    description: "单桶最小占比"
  
  min_bin_size:
    type: int
    required: false
    default: 50
    description: "单桶最小样本数"
  
  min_missing_bad_cnt:
    type: int
    required: false
    default: 30
    description: "缺失值桶最小坏样本数"
  
  # ========== 特征级分箱参数（覆盖全局）==========
  dict_nbins:
    type: dict
    required: false
    default: null
    description: "特征级分箱数，如 {'feat': 6}"
    example: {"user_phone_update_change_cnt_180d": 4, "user_phone_update_unbind_cnt_180d": 6}
  
  dict_missing_values:
    type: dict
    required: false
    default: null
    description: "特征级缺失值列表"
    example: {"user_is_phone_verified": [-9999, -9998], "user_email_service": ["UNKNOWN"]}
  
  dict_min_bin_rate:
    type: dict
    required: false
    default: null
    description: "特征级最小占比"
  
  dict_min_bin_size:
    type: dict
    required: false
    default: null
    description: "特征级最小样本数"
  
  dict_min_missing_bad_cnt:
    type: dict
    required: false
    default: null
    description: "特征级缺失值坏样本阈值"


  woe_update:
    enabled:
      type: string
      required: false
      default: ""
      options: ["set_woe","update", "update_by_cutoff", ""]
      description: "启用哪种修改woe分箱方式"
      note: "启用后，将使用自定义分箱边界重新计算 WOE 值"
  
    config:
      # update
      boundaries:
        type: list
        required: true
        description: "新的分箱边界（必须包含 -inf 和 inf）"
        example: [-inf, -0.15, 0.05, 0.20, inf]
        note: |
          - 边界值必须严格递增
          - 第一个值必须是 -inf，最后一个值必须是 inf
          - 边界数量 = 分箱数 + 1
          - 示例：5 个分箱需要 6 个边界值

      # update_by_cutoff
      cutoff:
        type: float
        required: true
        description: "新增的分箱切点（会自动插入到合适的位置）"
        example: 0.15
        note: |
          - 切点值必须在特征值范围内
          - 切点会自动插入到现有边界之间
          - 原有分箱边界保持不变
          - 示例：原边界 [-inf, 0, 0.5, inf]，cutoff=0.15
                  新边界 [-inf, 0, 0.15, 0.5, inf]

      # set_woe
      modifications:
        type: list
        required: true
        description: "需要修改的分箱列表（支持批量修改）"
        example: |
            - bin_name: "01.(-0.15, 0.05]"
              woe_value: -0.214
              reason: "业务调整"
            - bin_name: "02.(0.05, 0.20]"
              woe_value: 0.156
              reason: "风险校准"
          ```
        item_schema:
          bin_name:
            type: string
            required: true
            description: "分箱名称（必须与编码器中的分箱名称完全一致）"
            note: "格式：'序号.(下界, 上界]'，如 '01.(-0.15, 0.05]'"
          
          woe_value:
            type: float
            required: true
            description: "新的 WOE 值"
            note: |
              - WOE 值通常在 [-3, 3] 范围内
              - 负值表示低风险，正值表示高风险
              - 建议参考相邻分箱的 WOE 值，保持单调性
            validation:
              - "woe_value 在合理范围内（建议 -5 到 5）"
          
          reason:
            type: string
            required: true
            description: "更改原因"

    missing_logic:
      type: string
      required: false
      default: "high_risk"
      options: ["high_risk", "low_risk", "neutral"]
      description: "缺失值处理策略"
  
  output:
    encoder_save_path:
      type: string
      required: true
      description: "更新后的编码器保存路径"
      example: "s3://.../woe/encoder/acard_ft_user_v1_5bin_v2.pkl"

    modification_log:
      type: string
      required: false
      description: "修改日志保存路径（记录所有修改历史）"
      example: "s3://.../woe/logs/acard_ft_user_v1_modifications.json"
```

### **2.3 资源配置**

```yaml
resources:
  cpu:
    type: string
    required: false
    default: BaseConfig.resources.cpu
    description: "默认使用全局变量"
  
  memory:
    type: string
    required: false
    default: BaseConfig.resources.memory
    description: "默认使用全局变量"
  
  image:
    type: string
    required: false
    default: BaseConfig.resources.image
    description: "默认使用全局变量"
```

### **2.4 输出路径**

```yaml
output:
  encoder_save_path:
    type: model
    value_type: string
    required: false
    default: "/{run_id}/{fp_model_woe_encoder}/{feature_name}_{method}_{n_bins}bin.pkl"
    description: "编码器保存路径（null=自动生成）"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/woe/encoder/acard_ft_user_v1_best_ks_5bin.pkl"
  
```

---

## 🔄 **Node 3: WOE Transform（WOE转换应用）**

> **功能**：使用已训练的WOE编码器对数据进行转换  
> **数据流**：原始特征数据 + WOE编码器 → WOE转换后的数据

### **3.1 输入路径**

```yaml
input:
  # ========== 数据源 ==========
  data_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    default: "根据 sample_type 与 model_level 自动拼接"
    # sub + training: {base_train_path}/{sample_type}/{feature_name}
    # sub + ooot: {base_train_path}/{sample_type}/grass_date={ooot_date}/submodel_{feature_name}_selected_features
    # merge + training: {fp_model_woe_merge_data}/{sample_type}_{feature_name}
    # merge + ooot: {fp_model_woe_merge_data}/ooot_features/grass_date={ooot_date}/{sample_type}_{feature_name}
    description: "输入数据路径"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/woe/data/features/training_features_acard_ft_user_v1"
  
  # ========== 编码器来源 ==========
  encoder_load_path:
    type: model
    value_type: string
    required: false
    default: "{fp_model_woe_encoder}/{feature_name}_{method}_{n_bins}bin.pkl"
    description: "WOE编码器路径，可手工指定 S3 路径"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/woe/encoder/acard_ft_user_v1_best_ks_5bin.pkl"
```

### **3.2 节点配置**

#### **3.2.1 数据配置**

```yaml
data_config:
  # ========== 必填参数 ==========
  # feature_name:
  #   type: string
  #   required: true
  #   description: "特征组名称，与 Fit 阶段保持一致"
  #   example: "acard_ft_user_v1"
  
  sample_type:
    type: string
    required: false
    default: "all"
    options: ["train", "test", "val", "all"]
    description: "样本类型"
  
  # ========== 可选参数 ==========
  # model_level:
  #   type: string
  #   required: false
  #   default: "从全局配置继承"
  #   options: ["sub", "mega"]
  #   description: "模型层级（通常从全局配置继承，节点可覆盖）"
  #   note: |
  #     - 默认使用全局配置的 model_level
  #     - 节点可以覆盖此值（不推荐，会导致路径不一致）
  #     - 影响输入/输出路径的生成规则
  
  # ooot_date:
  #   type: string
  #   required: false
  #   default: null
  #   description: "仅当 sample_type 为 ooot_features 时必填，用于定位分区"
  #   example: "20240924"
```

#### **3.2.2 参数配置**

```yaml
# algorithm_config: # 不开放给用户，仅后端使用
#   transform_method:
#     type: string
#     required: false
#     default: "woe"
#     options: ["woe", "bin"]
#     description: "转换方法（继承自encoder，通常不需要指定）"
  feature_report_enabled:
    type: boolean
    required: false
    default: false
    description: "是否自动执行Feature Report"
      
  dim:
    type: string
    required: true
    description: "稳定性分析维度"
    example: "activation_date"
  
  reports:
    type: string
    required: false
    default: "performance,trend,stability,mono"
    description: "逗号分隔的报告类型"
    options: ["performance", "trend", "stability", "mono"]


```

### **3.3 资源配置**

```yaml
resources:
  cpu:
    type: string
    required: false
    default: BaseConfig.resources.cpu
    description: "默认使用全局变量"
  
  memory:
    type: string
    required: false
    default: BaseConfig.resources.memory
    description: "默认使用全局变量"
  
  image:
    type: string
    required: false
    default: BaseConfig.resources.image
    description: "默认使用全局变量"
```

### **3.4 输出路径**

```yaml
output:
  data_save_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    default: 
    # sub: {fp_model_woe_transformed_data}/{sample_type}_{feature_name}_{n_bins}bin
    # merge: {fp_model_woe_merge_data}/{sample_type}_{feature_name}_{n_bins}bin
    # to 
    # sub: /{base_train_path}/{fp_model_woe_transformed_data}/{sample_type}_{n_bins}bin
    #merge: /{base_train_path}/{fp_model_woe_merge_data}/{sample_type}_{n_bins}bin

    description: "转换后保存路径（null=自动生成）"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/model_name/run_id/woe/data/features/training_features_5bin"

  feature_report_save_path:
    type: data
    value_type: string
    required: false
    data_format: csv
    default: "/{base_train_path}/{fp_model_woe_feature_report}/{sample_type}_report.csv"
    description: "报告输出路径（null=自动生成）"
```

---

## 🎯 **Node 4: Feature Selection（特征选择）**

> **功能**：基于多种统计指标进行特征筛选  
> **数据流**：合并后的WOE数据（train + test） → 特征选择报告（.csv）

### **4.1 输入路径**

```yaml
input:
  data_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    description: "输入数据路径"
    # default: "/{fp_model_woe_transformed_data}/{sample_type}_{feature_name}_{n_bins}bin"
    default: /{base_train_path}/{fp_model_woe_transformed_data}/{sample_type}_{n_bins}bin"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/woe/data/features/all_features_acard_ft_user_v1_5bin"
```

### **4.2 节点配置**

#### **4.2.1 数据配置**

```yaml
data_config:
  label:
    type: string
    required: false
    default: "BaseConfig.label"
    description: "标签列名,默认全局配置"
  
  sample_type:
    type: string
    required: false
    default: "train"
    options: ["train", "test", "val", "all"]
    description: "样本类型"
  
  exclude:
    type: list
    required: false
    default: "BaseConfig.exclude + NA cols"
    description: "剔除列列表；最终剔除列表 = BaseConfig.exclude + 用户传入的 exclude + 自动发现的空值列"
    example: ["userid", "activation_date"]
```

#### **4.2.2 参数配置**

```yaml
algorithm_config:
  # ========== 选择方法（必填）==========
  fs_methods:
    type: list
    required: true
    description: "特征选择方法列表"
    options: ["by_iv", "by_corr", "by_gini", "by_psi", "by_stability"]
    example: ["by_iv", "by_corr", "by_gini", "by_psi"]
  
  # ========== 阈值配置（可选，带默认值）==========
  iv_threshold:
    type: float
    required: false
    default: 0.02
    description: "IV 筛选阈值（小于该值的特征被剔除）"
  
  corr_threshold:
    type: float
    required: false
    default: 0.7
    description: "相关性筛选阈值（大于该值的特征被视为冗余）"
  
  psi_threshold:
    type: float
    required: false
    default: 0.1
    description: "PSI 筛选阈值（大于该值的特征被视为不稳定）"
  
  # ========== Stability Selection 参数（by_stability 方法专用）==========
  lambda_grid:
    type: list
    required: false
    default: "np.logspace(-3, -1, 10)"
    description: "L1 正则化系数网格（支持 JSON 字符串或列表），用于控制特征选择的稀疏性"
    example: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1]
  
  stability_threshold:
    type: float
    required: false
    default: 0.1
    description: "稳定性阈值，特征的最大稳定性分数需 >= 该值才会被选中"
  
  stability_n_resampling:
    type: int
    required: false
    default: 50
    description: "重采样次数，每次重采样都会训练模型并统计特征选择结果"
  
  stability_sample_fraction:
    type: float
    required: false
    default: 0.5
    description: "每次重采样的样本比例（0.0-1.0），用于子采样训练数据"
  
  stability_max_sample_rows:
    type: int
    required: false
    default: null
    description: "最大采样行数限制，用于大数据场景下的内存控制"
  
  random_state:
    type: int
    required: false
    default: 0
    description: "随机种子，用于保证结果可复现"
```

### **4.3 资源配置**

```yaml
resources:
  cpu:
    type: string
    required: false
    default: BaseConfig.resources.cpu
    description: "默认使用全局变量"
  
  memory:
    type: string
    required: false
    default: BaseConfig.resources.memory
    description: "默认使用全局变量"
  
  image:
    type: string
    required: false
    default: BaseConfig.resources.image
    description: "默认使用全局变量"
```

### **4.4 输出路径**

```yaml
output:
  # fp_fs_output_path:
  #   type: string
  #   required: true
  #   description: "结果输出目录或包括文件名"
  #   example: "s3://sg-risk-model-prod/test/hy/20251130/fs/fs_result.csv"
  #   note: "输出包含 selection_report_{model_name}.csv（汇总报告）和 feature_list_{model_name}_{method}.csv（各方法详细结果）"

  selection_report_path:
    type: data
    value_type: string
    required: true
    data_format: csv
    description: "输出文件名"
    example: "{base_train_path}/fs/fs_result.csv"
    note: "输出包含 selection_report_{model_name}.csv（汇总报告）"

  feature_list_path:
    type: data
    value_type: string
    required: true
    data_format: csv
    description: "结果输出目录或包括文件名"
    example:  "{base_train_path}/fs/feature_list.csv"
    note: "输出包含 feature_list_{model_name}_{method}.csv（各方法详细结果）"
```

---

## 🔬 **Node 5: LGBM Hyperparameter Tuning + Model Training（超参调优+模型训练）**

> **功能**：使用贝叶斯优化搜索最优超参数，并使用最优超参数训练最终模型  
> **数据流**：训练数据 + 特征选择结果 → 训练好的模型 + 最优超参数 + BO搜索历史 + 训练预测结果

### **5.1 输入路径**

```yaml
input:
  # ========== 训练数据 ==========
  data_path:
    type: data
    value_type: string
    required: true
    data_format: parquet
    description: "调参样本"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/woe/data/features/training_features_acard_ft_user_v1_5bin"
  
  # ========== 特征选择结果 ==========
  feature_selection_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    default: null
    description: "特征选择报告，用于剔除无效特征"
    example: "{base_train_path}/fs/fs_result.csv"
```

### **5.2 节点配置**

#### **5.2.1 数据配置**

```yaml
data_config:  
  # ========== 可选参数 ==========
  use_feature_selection:
    type: list
    required: false
    default: []
    description: "使用的特征选择方法"
    example: ["by_iv", "by_corr"]
  
  tune_exclude_cols:
    type: list
    required: false
    default: []
    description: "必须剔除的列（ID、标签等）"
    # example: ["userid", "sample_use", "activation_date"]
    example: ["userid", "sample_type", "activation_date"]

  
  auxilary_cols:
    type: list/string
    required: false
    default: []
    description: "需要保留在预测结果中的辅助列（支持列表或逗号分隔字符串）"
    example: ["userid", "activation_date", "label_dpd30_3term"]
  
  sample_weight_col:
    type: string
    required: false
    default: null
    description: "权重列名称，若不为空将同时对 train/valid 使用该列加权"
  
  sample_fraction:
    type: float
    required: false
    default: null
    description: "浮点数 (0.0-1.0)，启用随机采样以加速调试"
```

#### **5.2.2 参数配置**

```yaml
algorithm_config:
  # ========== 调优策略（可选，带默认值）==========
  n_trails:
    type: int
    required: false
    default: 10
    description: "超参搜索次数"
  
  metric_for_train_tune:
    type: string
    required: false
    default: "auc"
    options: ["auc", "ks", "gini"]
    description: "优化指标"
  
  train_val_split:
    type: float
    required: false
    default: 0.8
    description: "训练集/验证集划分比例（Tune内部会将train数据再次划分）"
  
  train_val_ks_diff_threshold:
    type: float
    required: false
    default: 0.005
    description: "训练集与验证集 KS 差异阈值（过拟合检测）"
  
  coeffcient_overfit_punishment:
    type: float
    required: false
    default: 10
    description: "KS 惩罚系数（过拟合惩罚）"
  
  # ========== 超参搜索空间（使用默认）==========
  init_hypers:
    type: dict
    required: false
    default: "默认 LightGBM 搜索空间"
    description: "搜索空间字典，支持三种配置格式（字典、字符串、tune.前缀）"
    example:
      objective: "binary"
      metric: ["binary_logloss", "auc"]
      tree_learner: "data"
      learning_rate:
        type: "uniform"
        lower: 0.01
        upper: 0.03
      max_depth:
        type: "randint"
        lower: 3
        upper: 6
      num_leaves:
        type: "randint"
        lower: 20
        upper: 100
      feature_fraction:
        type: "uniform"
        lower: 0.4
        upper: 0.8
      bagging_fraction:
        type: "uniform"
        lower: 0.4
        upper: 0.8
      bagging_freq:
        type: "randint"
        lower: 3
        upper: 6
      reg_alpha:
        type: "loguniform"
        lower: 0.1
        upper: 100
      reg_lambda:
        type: "loguniform"
        lower: 0.1
        upper: 100
      min_gain_to_split:
        type: "uniform"
        lower: 0
        upper: 0.2
      scale_pos_weight:
        type: "uniform"
        lower: 50
        upper: 150
      min_child_samples:
        type: "randint"
        lower: 600
        upper: 1000
      early_stopping_round:
        type: "randint"
        lower: 80
        upper: 120
  
  # ========== 训练配置（Train阶段）==========
  # hypers:
  #   type: dict
  #   required: false
  #   default: "从 best_hyper_path 读取"
  #   description: "直接传 dict 覆盖超参数（优先级：best_hyper_path > hypers）"
  #   note: "如果同时提供 best_hyper_path 和 hypers，优先使用 best_hyper_path"
```

### **5.3 资源配置**

```yaml
resources:
  num_workers:
    type: int
    required: false
    default: 15
    description: "Worker数量"
  
  cpu_per_worker:
    type: int
    required: false
    default: 2
    description: "每Worker的CPU数量"
  
  memory_per_worker:
    type: int
    required: false
    default: 2
    description: "每Worker的内存大小（GB）"
```

### **5.4 输出路径**

```yaml
output:  
  # ========== Tuning 输出 ==========
  bo_history_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/tuning/bo_history/{sub_model}/{tune_version}"
    default: "{base_train_path}/model/tuning/bo_history/"
    description: "BO搜索历史路径（null=自动生成）"
  
  feature_importance_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/tuning/feature_importance/{sub_model}/{tune_version}"
    default: "{base_train_path}/model/tuning/feature_importance/"
    description: "特征重要性路径（null=自动生成）"
  
  best_model_path:
    type: model
    value_type: string
    required: false
    # default: "{fp_base}/model/tuning/model/{sub_model}/{tune_version}/lgb.pkl"
    default: "{base_train_path}/model/tuning/model/lgb.pkl"
    description: "最优模型路径（null=自动生成）"
  
  tune_predict_result_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/tuning/predict_result/{sub_model}/{tune_version}"
    default: "{base_train_path}/model/tuning/predict_result/"
    description: "Tuning预测结果路径（null=自动生成）"
  
  tune_best_hypers_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/tuning/best_hypers/{sub_model}/{tune_version}"
    default: "{base_train_path}/model/tuning/best_hypers/"
    description: "最优超参数路径（null=自动生成）"
  
  tune_checkpoint_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/tuning/trial/{sub_model}/{tune_version}"
    default: "{base_train_path}/model/tuning/trial/"
    description: "Tuning Checkpoint路径（null=自动生成）"
  
  # ========== Training 输出 ==========
  trained_model_path:
    type: model
    value_type: string
    required: false
    # default: "{fp_base}/model/train/model/{sub_model}/{train_version}/lgb.pkl"
    default: "{base_train_path}/model/train/model/lgb.pkl"
    description: "训练模型保存路径（null=自动生成）"
  
  train_predict_result_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/train/predict_result/{sub_model}/{train_version}"
    default: "{base_train_path}/model/train/predict_result/"
    description: "训练预测结果路径（null=自动生成）"
  
  train_checkpoint_path:
    type: data
    value_type: string
    required: false
    data_format: parquet
    # default: "{fp_base}/model/train/checkpoint/{sub_model}/{train_version}"
    default: "{base_train_path}/model/train/checkpoint/"
    description: "训练Checkpoint路径（null=自动生成）"

```

---

## 🔮 **Node 6: Model Prediction（模型预测）**

> **功能**：使用训练好的模型进行预测  
> **数据流**：预测数据 + 训练好的模型 → 预测结果（含score）

### **6.1 输入路径**

```yaml
input:
  # ========== 预测数据 ==========
  data_path:
    type: data
    value_type: string
    required: true
    data_format: parquet
    description: "预测样本路径"
    # example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/woe/data/features/training_features_acard_ft_user_v1"
  
  # ========== 模型来源 ==========
  best_model_path:
    type: model
    value_type: string
    required: false
    description: "训练好的模型路径"
    # example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/model/train/model/user_and_order/lgb.pkl"
```

### **6.2 节点配置**

#### **6.2.1 数据配置**

```yaml
data_config:
  # ========== 必填参数 ==========
  sample_type: 
    type: string
      required: false
      default: "test"
      options: ["train", "test", "val", "all"]
      description: "数据筛选, 默认使用test，当数据为oot时，为all"
  
  # ========== 可选参数 ==========
  auxilary_cols:
    type: list/string
    required: false
    default: []
    description: "辅助列（保留在输出），支持两种格式：Python 列表或逗号分隔字符串"
    example: ["userid", "activation_date", "label_dpd30_3term"]


```

#### **6.2.2 参数配置**

```yaml
algorithm_config:
  batch_size:
    type: string
    required: false
    default: 1024
    description: "批次大小（auto=自动）"
  
  output_columns:
    type: list
    required: false
    default: ["score", "probability"]
    description: "输出列"
```

### **6.3 资源配置**

```yaml
resources:
  num_workers:
    type: int
    required: false
    default: 15
    description: "Worker数量"
  
  cpu_per_worker:
    type: int
    required: false
    default: 2
    description: "每Worker的CPU数量"
  
  memory_per_worker:
    type: int
    required: false
    default: 2
    description: "每Worker的内存大小（GB）"

  image: 

```

### **6.4 输出路径**

```yaml
output:
  predict_result_path:
    type: data
    value_type: string
    required: true
    data_format: parquet
    description: "预测结果路径"

    # example: "s3://sg-risk-model-prod/risk/id/spl_acard/{run_id}/model/predict/predict_result/user_and_order"
    example: "s3://sg-risk-model-prod/risk/id/spl_acard/{model_name}/{run_id}/model/predict/predict_result/"

```
