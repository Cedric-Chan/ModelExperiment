# 标准 Experiment 画布步骤与节点设计（修订版）

依据 [MODEL_PIPELINE.md](../../MODEL_PIPELINE.md) 与 [分布式训练使用手册_v1.3.md](../../risk_model_on_ray/com/seamoney/risk/spl_acard/分布式训练使用手册_v1.3.md)，按单域、统一数据源节点、SavePoint/CheckPoint 明确边界修订。先不考虑多域情况。实现参考 risk_model_on_ray，RayUtil 方法及 ray_*.py 脚本与画布节点对应关系见 [Task-Canvas-Config.md](./Task-Canvas-Config.md)。**本版对齐 Data Science 调研 SOP**：支持多 SavePoint、多 CheckPoint；**改配置后执行**统一为**新 Run**（按最新 Experiment 配置），执行时由系统分析配置变更、无变更部分走缓存。**交互（Figma / [`model-experiment-web`](../prototype/model-experiment-web/README.md)）**：**Action → Trigger Run** 与 **Use Cache** 弹窗；当前导出默认 **from start** 全 DAG 校验。「从选中节点起执行」为设计意图（源码有未挂接组件）。SavePoint 仍用于按 Run 记录节点产出与溯源。

---

## Partner spec v2.0（2025）— 当前原型画布基准

合作方只读规范：[`docs/architecture/frontend_node_config_spec_latest.md`](../architecture/frontend_node_config_spec_latest.md)。**本里程碑下** [`model-experiment-web`](../prototype/model-experiment-web/) 画布采用 **6 个线性管道节点**（与规范节点总览一致）：

1. **data source**（规范：Data Source / Data Load）  
2. **WOE fit**  
3. **WOE Transform**  
4. **Feature selection**  
5. **Tune & Train**（规范：Hyperparameter Tuning + Model Training，合并为单节点）  
6. **inference**（画布 UI；合作方规范：Model Prediction）

**Pipeline / 实验级**：规范中的 `model_level`、`base_train_path`、`label_column`、全局排除列等仍在 **非画布** 区域配置；**ENV（全局变量表：Parameters / Description / Value）** 在画布顶栏入口配置，与「pipeline 级别、各节点共享」语义一致（详见规范「pipeline级别配置」与 ENV UI）。

**SavePoint / CheckPoint 边标签**：本 6 节点线性原型 **不展示** 旧版边侧 SavePoint 标签；多 SavePoint、多 CheckPoint 的完整语义见下文「Superseded / deferred」，后端落地时可再挂接。

### Superseded / deferred（相对下方「修订版」九节点叙述）

以下能力仍可作为产品与后端长期目标，**不与当前 6 节点原型互斥**，但 **不在本里程碑画布上展开**：合并式 **WOE All / WOE Selected**、**独立 Model Tune 与 Model Train**、**CheckPoint（择优）**、画布上的 **Calibrate**、多子路径并行 Tune+Train。若实现回归多节点拓扑，需同步更新本文与 `Task-Canvas-Config.md`。

---

## 一、Experiment 画布超简化流程与节点划分

**术语**：**Experiment** = Model Experiment（模型实验）；画布节点 = **Experiment Component**（实验物料，基于 **Component Template**）；**Run** = 一次有顺序的执行记录，绑定配置与产物，改配置后执行 = 新 Run。

画布 **DAG 仅含管道节点**（无独立的 Start / End 占位节点；与 [Feature WideTable 画布](https://github.com/Cedric-Chan/FeatureStore) 一致：**实验级元信息、资源队列与调度**在顶栏 **Edit Meta** / **Execute Config** 中配置，不占用画布节点）。

整体顺序（单域）：

```
数据源 → WOE All Feature（woe_fit→woe_transform→woe_merge 全部特征，再可选 all feature_report）
  → Feature Selection + Fine Feature Report → WOE Selected Feature（可选 woe_update→woe_transform→woe_merge 选中特征）
  → Model Tune → Model Train → [可选] CheckPoint（择优）→ Model Inference → [可选] Calibrate Fit + Transform
```

支持**多子路径**：用户可配置多组「Model Tune + Model Train」子路径（不同超参组合）。**CheckPoint（择优）** 节点包含 **Best Select（Model Summary）**：汇总多路 TUNE+Train 分支结果，用户择优后 Continue 至 Model Inference，再由 **Model Inference** 节点使用所选训练结果执行 model_predict。画布节点类型与配置要点（SOP 表）及完整 DAG 示例见 [Task-Canvas-Config.md §SOP 节点类型与配置要点、§2.4 DAG 实例 Demo](./Task-Canvas-Config.md)。

### 1.1 画布节点序列（LightGBM / XGBoost）

| 序号 | 节点名称 | 涵盖步骤 | SavePoint | CheckPoint | 说明 |
|-----|----------|----------|-----------|------------|------|
| 1 | **数据源 (DataSource)** | 读取数据 | — | — | 画布 DAG **首位管道节点**；Type 单选：Hive / S3；**categorical_col**（与 label、sample_use_col 并列）；需保证数据源表干净、无偏，且标识不经 WOE 的类别变量 |
| 2 | **WOE All Feature**（WOE Fit + All Feature Report） | woe_fit → woe_transform → woe_merge（全部特征）+ 可选 feature_report(全部特征) | **是** | — | 合并节点；对全部特征做 fit→transform→merge，再（可选）全部特征探查报告；产出 Encoder + WOE 数据 + 全量报告；**WOE 部分 Time Travel 实验 checkpoint**；SavePoint 存 Encoder + 报告路径 |
| 3 | **Feature Selection + Fine Feature Report** | feature_selection + feature_report(选中特征) | — | **是** | 合并节点；先 feature_selection 再 fine feature_report；产出 FS 报告 + 精选报告；本节点打 CheckPoint |
| 4 | **WOE Selected Feature**（WOE Update + WOE Merge） | woe_update(可选) → woe_transform → woe_merge（选中特征） | **是** | — | 针对选中特征：可选 woe_update 后 woe_transform + woe_merge；SavePoint 为后续 Model Tune & Train 存档点 |
| 5 | **Model Tune** | model_tune | — | — | 超参搜索；支持不同分支定义搜索策略 + 搜索参数空间；支持分支 DAG 并行 |
| 6 | **Model Train** | model_train | — | — | 选择最优分支 best_hyper_path 再 model_train()；合并多路 TUNE 分支 |
| 7 | **CheckPoint（择优）**（Best Select / Model Summary） | — | — | **可选** | **Best Select（Model Summary）**：汇总多分支 TUNE+Train 结果，用户择优选定后 Continue 进入 Model Inference |
| 8 | **Model Inference** | model_predict | — | — | 使用择优选定的训练结果执行 model_predict；需支持独立组成完整画布（如数据源 + 推理），用于策略回扫等场景 |
| 9 | **Calibrate** | calibrate_fit、calibrate_transform | — | — | **本期不实现 / Pending**；画布保留节点，默认关闭；配置页内分两个配置区 |

**实验级配置（非画布节点）**：**Edit Meta**（Experiment Name / Region / Owner / Description 等，修改不落 Run 版）、**Execute Config**（Resource Tier、Queue Priority、Schedule：**ONCE** 或 **Cron**、Pipeline 输入字段等；交互与 [Feature WideTable 画布 Execute Config](https://github.com/Cedric-Chan/FeatureStore) 顶栏入口与弹窗样式对齐）。

Benchmark 框架：数据源(Type=S3) → Mega Model → Calibrate(默认关)；元信息与执行配置仍在顶栏。

---

## 二、SavePoint 与 CheckPoint 设计（重点）

### 2.1 概念区分

| 属性 | 含义 | 行为 | 适用节点 |
|------|------|------|----------|
| **SavePoint** (`isSavePoint`) | 节点产出作为「恢复点」持久化 | 本节点执行完成后，将其输出（如 WOE Encoder、合并后数据）写入 S3 并记录到 Run 的 SavePoint 列表。用户选择 **Revert** 时，从**最近一个 SavePoint** 加载产出，从该 SavePoint 的**下一节点**按当前配置重新执行。**允许多个节点开启 SavePoint。** | **WOE All Feature**、**WOE Selected Feature** |
| **CheckPoint** (`isCheckPoint`) | 节点属性，**默认关闭**；用于产出存档等语义 | Run 状态为 **QUEUING / RUNNING / SUCCESS / FAILED / KILLED**（无 CHECKING；**WAITING** 与 **QUEUING** 可同义）。CheckPoint 节点完成后中间产物已写出，不改变 Run 状态为「暂停」；改配置后执行 = 新 Run id，按最新 Experiment 配置执行，无变更部分可走缓存。**允许多个节点开启 CheckPoint。** | **Feature Selection + Fine Feature Report**、**CheckPoint（择优）**（可选） |

### 2.2 状态与操作

- **Run 状态**：**QUEUING / RUNNING / SUCCESS / FAILED / KILLED**（无 CHECKING；**WAITING** 与 **QUEUING** 可同义）。SavePoint 产出可被后续新 Run 复用（如改配置后执行 = 新 Run，执行时无变更部分可走缓存）。

### 2.3 最近 SavePoint 语义

- 每个 Run 维护 **SavePoint 列表**（如 `savepoint_snapshots: [{ node_id, s3_path, completed_at }]`），按执行顺序追加。
- 从 SavePoint 重跑时：取该 Run 的 SavePoint 列表中最近一个，新 Run 可从该 SavePoint 产出加载（具体策略见实现）。
- 画布/后端需保证节点顺序一致，以便正确解析「最近 SavePoint」。

### 2.4 节点边界与复用

- **节点 3 之后**：WOE All Feature 产出（Encoder + WOE 数据 + 全量报告）持久化为 SavePoint 后，后续可多次从「节点 4」用不同配置重跑。
- **节点 4**：Feature Selection + Fine Feature Report 可配置 CheckPoint，完成后中间产物已写出，Run 状态继续为 RUNNING 直至 SUCCESS/FAILED/KILLED。
- **节点 5 之后**：WOE Selected Feature 产出持久化为 SavePoint（后续 Model Tune & Train 存档点），新 Run 可复用该 SavePoint 产出（无变更部分走缓存）。
- **约束**：画布内 **允许多个 SavePoint、多个 CheckPoint**（CheckPoint 为节点属性、默认关闭）。改配置后执行 = 新 Run，按最新 Experiment 配置，执行时无变更部分可走缓存；**Trigger Run** 弹窗内 **Use Cache** 表达缓存策略；不提供「自动从最近 SavePoint 重跑」。

**中间产物与 MLflow**：**内部已定由 MLflow 管理模型离线实验的中间产物（artifact）**。SavePoint/CheckPoint 节点产出的 Encoder、报告、FS 结果、模型等，在写入 S3 的同时应通过 MLflow 登记与版本化（如与 Run/节点对应为 MLflow Run 或 artifact 路径），便于按 Run/节点查询、对比与复现，并与 [系统架构说明 §4.2.3](../architecture/系统架构说明.md) 的存储约定一致。

### 2.5 与现有文档对齐

- [Training-Data-Pipeline.md §2.4](./Training-Data-Pipeline.md)：SavePoint/CheckPoint 描述与本设计一致（多 SavePoint、多 CheckPoint，改配置后执行 = 新 Run，从头执行+缓存（见系统架构说明与 Training-Data-Pipeline §2.4））。
- [系统架构说明.md §4.2.2](../architecture/系统架构说明.md)：Run 状态机若仍写 **WAITING**，与本文 **QUEUING** 视为同义，需随架构文档后续对齐。

---

## 三、顶栏：Edit Meta 与 Execute Config（非画布节点，不落 Run 版）

画布 **不**再使用「Experiment Meta / Start / End」类占位节点；与 Feature WideTable 一致，**实验级信息**在顶栏完成。

### 3.1 Edit Meta（笔形入口）

| 字段 | 展示/编辑 | 说明 |
|------|------------|------|
| Experiment Name | 只读回显 | 创建时确定，不可编辑 |
| Model | 只读 | 绑定 Model |
| Region | 仅查看 | 不可编辑，仅 View |
| Owner | 可编辑，多选 | 支持改选多个 Owner |
| Description | 回显可编辑 | 创建时带入，可修改 |

对 **Owner / Description** 等 Meta 的修改**不**写入 Run 配置快照，**直接更新 Experiment 实体**。

### 3.2 Execute Config（顶栏入口，与 WideTable 样式对齐）

| 字段 | 控件 | 选项 / 说明 |
|------|------|-------------|
| Resource Tier | 单选 | Low / Medium / High |
| Queue Priority | 单选 | Normal / Important / Critical |
| Scheduler | ONCE / Cron | Cron 模式下填写 cron 表达式（原型与 WideTable 一致可提供英文可读预览） |
| Pipeline Input Fields | 列表（可选） | 与原先 Start 节点一致的管道输入字段定义，现归 Execute Config |

`resource_tier`、`queue_priority`、调度与输入字段属**实验级或执行侧配置**，修改**不**生成新画布 Version；进入 Run 的策略以产品/后端约定为准。

### 3.3 不落版语义（延续）

- **Experiment 实体**字段：`name`、`region`、`owner`、`description`、`resource_tier`、`queue_priority` 等在列表与配置页展示；Meta/Execute 修改**不**写入「单次 Run 的配置快照」中属于**实验级**的部分（与此前「Experiment Meta 节点不落版」一致，仅承载位置从节点改为顶栏）。

其他节点（DataSource、WOE、Feature Selection、Training、Calibrate、Mega Model）为 **Experiment Component** 的配置明细，创建/保存 Run 时进入该 Run 的配置快照（按现有「Save DRAFT」/版本逻辑）。

---

## 四、数据源节点（统一 DataSource，Type 二选一）

**一个 DataSource 节点**，Type 单选：**Hive** | **S3**。用户必须按所选类型填写对应配置。**categorical_col** 由数据源统一配置，平台注入到 WOE 节点的 categorical_features，WOE 节点不再重复填写。

### 4.1 Type = Hive

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| hive_server | enum | 是 | 数据服务（如 reg_sg_hive / reg_us_hive） |
| table_schema | string | 是 | Hive Schema |
| table_name | string | 是 | Hive 表名 |
| partition_filter | string | 否 | 分区条件 |
| custom_filter | string | 否 | 自定义 WHERE |
| label | string | 是 | 目标列/标签列名 |
| sample_use_col | string | 否 | 默认 'sample_use' |
| **categorical_col** | list[string] 或 逗号分隔 | 否 | 不经 WOE 的类别变量，供后续 WOE/FS 使用 |

### 4.2 Type = S3

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sample_path | string | 是 | 数据路径（如子模型预测结果 Parquet 的 S3 路径） |
| label | string | 是 | 标签列名（用户指定） |
| sample_use_col | string | 否 | 样本划分列 |
| **categorical_col** | list[string] 或 逗号分隔 | 否 | 不经 WOE 的类别变量，供后续 WOE/FS 使用 |

S3 类型用于 Benchmark 或从已有 S3 数据继续下游；用户必须显式指定 label（及可选 sample_use_col、categorical_col）。

---

## 五、各节点配置区划分（单节点多 Area）

以下仅列配置区（Area）划分与关键配置项；参数命名在两文档中任取其一统一（如 `encoder_save_path`）。完整参数字段以 MODEL_PIPELINE.md 与使用手册为准。实验级配置见 §三（顶栏）。

### 5.1 节点：WOE All Feature（WOE Fit + All Feature Report）

- **节点属性**：`isSavePoint` **true**（**WOE Time Travel 实验 checkpoint**）；无 CheckPoint。
- **执行顺序**：先对全部特征 **woe_fit → woe_transform → woe_merge**，再（可选）All Feature Report。
- **配置合并**：与节点 5（WOE Selected Feature）可共用同一 WOE 配置块，本节点对应 scope = all；节点 5 对应 scope = selected 并需 `feature_selection_path`。详见 [Task-Canvas-Config.md §2.2.0](./Task-Canvas-Config.md)。
- **配置区 1**：WOE Fit（feature_name、data_path、encoder_save_path、label、n_bins、method、transform_method、min_bin_rate、min_bin_size、categorical_features、missing_values、missing_logic、exclude、sample_use_col 等；categorical_features 可由数据源 categorical_col 注入）。
- **配置区 2**：WOE Transform + Merge（对全部特征；参数见 MODEL_PIPELINE §3、§4）。
- **配置区 3**：All Feature Report（可选）（encoder_load_path、report_filepath、sample_type、pkey、dim、reports 等）。
- SavePoint 写入：Encoder 路径 + 全量报告路径 + 该节点产出元数据。

### 5.2 节点：Feature Selection + Fine Feature Report

- **节点属性**：`isCheckPoint` **true**；无 SavePoint。
- **执行顺序**：先 feature_selection，再 feature_report（选中特征）。
- **裁切语义**：Feature Selection **只产出选择报告**（如 selection_report_*.csv、各方法 feature_list_*.csv），不产出「仅含选中特征」的物理表。真正的裁切（只保留选中特征列）发生在 **Model Tune / Model Train** 读表时，根据 `feature_selection_path` 与 `use_feature_selection` 过滤列。详见 [Task-Canvas-Config.md §2.2.0](./Task-Canvas-Config.md)。
- **配置区 1**：Feature Selection（data_path、output_filepath、label、fs_methods、iv/corr/psi 阈值、exclude；by_stability 相关参数等）。
- **配置区 2**：Fine Feature Report（encoder_load_path、feature_selection_path、report_filepath、sample_type、pkey、dim、reports 等）。
- SavePoint 写入：FS 结果路径 + 精选特征报告路径 + 该节点产出元数据。

### 5.3 节点：WOE Selected Feature（WOE Update + WOE Merge）

- **节点属性**：`isSavePoint` **true**（后续 Model Tune & Train 实验的存档点）。
- **执行顺序**：针对**选中特征**，可选 woe_update 后 woe_transform、woe_merge。
- **等价语义**：「WOE Selected Feature」在语义上等价于对**裁切后的特征**（由选择报告定义）做 woe fit（节点 3 已完成）+ 可选 update + transform + merge；下游 Tune/Train 按同一报告只读这些列。与节点 3（WOE All Feature）可**共用同一 WOE 配置块**，本节点对应 scope = selected，需 `feature_selection_path`；节点 3 对应 scope = all。详见 [Task-Canvas-Config.md §2.2.0](./Task-Canvas-Config.md)。未配 woe_update 时，训练结果等价于下游直接使用节点 3 的 merge 表并按选择报告过滤列；节点 5 的 transform+merge 可保留用于 SavePoint/sample_path 统一，或按产品约定省略。
- **配置区 1**：WOE Update（可选开关；若开启：特征列表 + 每特征调参如 ws_list / cutoff / missing_logic，对应 risk_model_on_ray 的 woe_update / woe_update_by_adding_cutoff；本期可预留配置区，具体字段下期实现）。
- **配置区 2**：WOE Transform（data_path、encoder_load_path、data_save_path、sample_type、model_level、transform_method 等）。
- **配置区 3**：WOE Merge（data_path_dict、data_save_path、on、how、model_name；可选 num_partitions 等）。若未配置 woe_update，则直接使用节点 3 的 Encoder 对选中特征做 transform + merge。单域时 merge 可能退化为单路输出或占位。

### 5.4 节点：Model Tune

- **配置区**：sample_path、label、best_hypers_path、best_model_path、feature_selection_path、use_feature_selection、init_hypers、n_trials、metric_for_tune、num_workers、**search_space** dict、**搜索策略** grid/random/bayesian 等。支持不同分支定义搜索策略 + 搜索参数空间，各分支产出 best_hyper_path / best_model；**支持分支 DAG 并行**。

### 5.5 节点：Model Train

- **配置区**：sample_path、label、best_model_path、checkpoint_path、best_hyper_path、hypers、predict_result_path 等。选择最优一路分支的 best_hyper_path 再跑 model_train()，得到最终要发布的模型；**合并多路 TUNE 分支**。

### 5.6 节点：CheckPoint（择优）（Best Select / Model Summary）

- **节点属性**：`isCheckPoint` **可选**。**Best Select（Model Summary）**：汇总多路 TUNE+Train 分支模型结果并识别最优；多子路径（Model Tune + Model Train）执行完成后，用户择优选定后进入 Model Inference（流程语义，无独立 Continue 按钮；Run 无 CHECKING，按 QUEUING/RUNNING/SUCCESS/FAILED/KILLED 流转）。
- **配置**：无独立配置区；可选记录「择优结果」引用（如选中的子路径 ID 或 artifact 路径），供 Model Inference 节点读取。

### 5.7 节点：Model Inference

- **配置区**：sample_path、**model_path**（选用择优选定的训练结果，或本 Experiment 某次 Run / 某 Build 的产物）、predict_result_path、auxilary_cols 等。执行 model_predict，产出带 pred 列的 Parquet。
- **产品需求**：需支持此节点**独立组成完整画布**（如数据源 + Model Inference），用于策略回扫、批量预测等场景。

### 5.8 节点：Calibrate

- **本期不实现 / Pending**：画布保留节点，默认关闭，不做开发排期。
- **配置区 1**：Calibrate Fit（sample_path、label、feature_list、model_path、n_bins、n_degree、score_type；多阶段时 n_stages、breakpoints、label_term 等）。
- **配置区 2**：Calibrate Transform（sample_path、model_path、result_path、feature_list、auxilary_cols 等）。

---

## 六、Benchmark 画布

- **顶栏**：Edit Meta / Execute Config，同上 §三。
- **数据源**：Type 选 **S3**，用户指定 sample_path、label、categorical_col 等。
- **Mega Model**：model_bm / model_bm_v2 对应配置（sample_path、label、submodel_list、model_path、predict_result_path、sample_use_col、auxilary_cols 及 v2 特有项）。
- **Calibrate**：同上，默认关闭。

---

## 七、修订摘要（相对前版，SOP 对齐）

1. **单域**：先不考虑多域，WOE 相关仅一组配置。
2. **节点合并（SOP 对齐）**：节点 3 = **WOE All Feature**（对全部特征 fit → transform → merge + 可选 report）；Feature Selection 与 Fine Feature Report 合并为节点 4；节点 5 = **WOE Selected Feature**（对选中特征可选 woe_update → transform → merge）。
3. **SavePoint / CheckPoint 归属**：节点 3（WOE All Feature）、节点 5（WOE Selected Feature）可配置 SavePoint；节点 4（Feature Selection）、节点 8（择优）可配置 CheckPoint（节点属性、默认关）。改配置后执行 = **新 Run**（从头执行，无变更部分走缓存）；**CheckPoint（择优）** 含 **Best Select（Model Summary）**，多子路径训练后汇总分支结果、人工择优再进入 Model Inference。
4. **Model Tune / Model Train / Model Inference 拆分**：Model Tune（节点 6）、Model Train（节点 7）为独立节点，支持多子路径做训练参数组合；CheckPoint（择优）（节点 8）含 Best Select，汇总多分支结果后用户择优，再由 Model Inference（节点 9）使用选定结果执行 model_predict。
5. **数据源**：Hive 与 S3 均增加 **categorical_col**，平台注入到 WOE 的 categorical_features。
6. **Run**：需维护 SavePoint 列表（savepoint_snapshots），用于按 Run id 溯源节点产出；产物路径 `s3://…/{exp_id}/{run_id}/`；详见系统架构说明。
7. **实验级 Meta / Execute 在顶栏且实验级字段不落 Run 版**：同前版语义，画布无 Meta 占位节点。
8. **实现参考 risk_model_on_ray**：RayUtil 方法及 ray_*.py 与画布节点对应见 Task-Canvas-Config；节点 5 的 woe_update 对应 ray_woe_update.py、ray_woe_merge_v2.py 等。MODEL_PIPELINE.md 与 risk_model_on_ray 为外部参考，不写入。

同步到 PRD 时，可将本文档作为「Experiment 画布步骤与节点规范」附录或独立小节引用，并保持 Training-Data-Pipeline.md §2.4、系统架构说明中 SavePoint/CheckPoint 与本文一致。
