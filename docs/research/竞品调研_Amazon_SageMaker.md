# 竞品调研：Amazon SageMaker Pipelines

**来源出处**：[Amazon SageMaker 官方文档](https://docs.aws.amazon.com/sagemaker/) / [Pipelines 概述](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-overview.html)

## 1. 来源与概述

Amazon SageMaker Pipelines 是 AWS 提供的 **ML 工作流编排服务**，用于在 SageMaker 上构建、执行和管理端到端 ML 流水线。Pipeline 由一系列按 DAG 组织的 **Step** 组成，可通过拖拽式 UI（Pipeline Designer）、Pipelines SDK（Python）或 [Pipeline 定义 JSON Schema](https://aws-sagemaker-mlops.github.io/sagemaker-model-building-pipeline-definition-JSON-schema/) 定义。DAG 结构由 **Step 间的数据依赖** 决定：当某 Step 的产出（properties）作为另一 Step 的输入时，形成有向边；执行顺序由服务自动解析。支持 Step 缓存、选择性执行、条件分支、与 SageMaker Experiments / Model Registry 集成及 EventBridge 调度。

**与本文档的关系**：与 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md)、[竞品调研_ZenML](./竞品调研_ZenML.md)、[竞品调研_DagsHub](./竞品调研_DagsHub.md)、[竞品调研_Valohai](./竞品调研_Valohai.md)、[竞品调研_Kubeflow](./竞品调研_Kubeflow.md) 同属架构层竞品调研，作为 **Canvas DAG 备选方案 I**，且为**主要调研对象**。重点考察其 **Step（节点）设计**：类型、依赖、属性引用、参数、缓存与选择性执行，以及与 SavePoint/CheckPoint、多路 Tune、独立推理画布的匹配度。

## 2. 核心概念

- **Pipeline**：由 `name`、`parameters`、`steps` 组成。Pipeline 名称在同一 (account, region) 内唯一。所有在 Step 定义中使用的参数必须在 Pipeline 的 `parameters` 列表中先定义。Step 列表及其**数据依赖**自动决定 DAG 与执行顺序。
- **Pipeline execution**：Pipeline 的**一次执行**。通过 `pipeline.start(parameters=..., parallelism_config=..., selective_execution_config=...)` 触发；每次 start 产生一次新的 execution，可覆盖默认参数。支持 `ParallelismConfiguration` 限制并发 Step 数（可在 create/update/start 时指定，start 时优先）。
- **Step**：Pipeline 中的一个节点，有**类型**（如 Processing、Training、Condition）和 **properties**。`properties` 对应底层 SageMaker Job 类型的 Describe* API 响应（如 DescribeProcessingJob、DescribeTrainingJob），用于在运行时解析产出并传递给下游 Step。

## 3. 节点设计（Step 设计）

本节完整整理 SageMaker Pipelines 的节点（Step）设计，便于与画布节点、Task/Run 配置承载对比。

### 3.1 Step 类型

| 类型 | 用途 | 说明 |
|------|------|------|
| **Processing** | 数据预处理 / 评估脚本 | 运行 Processing Job，执行预处理脚本（如填充缺失值、归一化、划分 train/validation/test）；产出写 S3，经 ProcessingOutputConfig 引用。 |
| **Training** | 模型训练 | 创建 Training Job，配置 estimator、训练/验证数据输入；产出为模型 artifact（S3）。 |
| **Tuning** | 超参调优 | 创建 Hyperparameter Tuning Job，多组超参并行训练；产出为最优模型等。 |
| **AutoML** | 自动机器学习 | 自动特征工程、算法与超参选择。 |
| **Transform** | 批量推理 | 对指定数据集运行 Batch Transform Job，生成预测结果。 |
| **Condition** | 条件分支 | 根据条件（如评估指标阈值）选择后续分支；不满足时 pipeline 可停止或走另一路径。 |
| **RegisterModel** | 注册模型 | 将模型注册为版本化 Model Package，写入 SageMaker Model Registry。 |
| **CreateModel** | 创建模型实体 | 创建 SageMaker Model 资源，为部署或 Transform 做准备。 |
| **Deploy model (endpoint)** | 部署端点 | 将模型部署为实时推理 Endpoint。 |
| **Execute code** | 自定义代码 | 在 Pipeline 中运行用户上传的 Python 函数/脚本/Notebook；底层用 Training Job 执行；支持 **@step 装饰器** 将本地 ML 代码转为 Pipeline Step。 |
| **Callback** | 人工审批/回调 | 暂停等待外部回调（如人工审批）后继续。 |
| **Lambda** | 调用 Lambda 函数 | 在 DAG 中调用 AWS Lambda。 |
| **ClarifyCheck** | 公平性/可解释性检查 | 与 SageMaker Clarify 集成，做 baseline / 可解释性等检查。 |
| **QualityCheck** | 数据/模型质量检查 | 数据质量与模型质量检查步骤，支持 baseline、drift、lifecycle。 |
| **EMR** | 调用 EMR 作业 | 在 Pipeline 中提交 EMR 作业。 |
| **Notebook Job** | 运行 Notebook | 将 Notebook 作为 Pipeline 一步执行。 |
| **Fail** | 显式失败 | 主动标记为失败，用于分支或测试。 |

### 3.2 依赖：数据依赖与自定义依赖

- **数据依赖**：Pipeline 的 DAG 主要由**数据依赖**决定。当把**上游 Step 的 `properties`** 作为**下游 Step 的输入**（如 S3 路径、模型 URI）时，Pipelines 自动建立依赖：下游 Step 在上游 Step 成功完成后才会启动。引用格式为 **JsonPath**：  
  `<step_name>.properties.<property>.<property>`  
  例如引用 Processing Step 的 train 输出 S3 URI：  
  `step_process.properties.ProcessingOutputConfig.Outputs["train_data"].S3Output.S3Uri`  
  各 Step 类型可引用的 properties 与对应 Describe* API 一致，详见 [Data Dependency - Property Reference](https://sagemaker.readthedocs.io/en/stable/amazon_sagemaker_model_building_pipeline.html#data-dependency-property-reference)。

- **自定义依赖（DependsOn）**：当**没有数据传递**但需要**执行顺序**时，使用自定义依赖。例如 Step C 必须在 Step A、B 都完成后才运行，但不需要 A、B 的产出作为输入。实现方式：  
  - 在 Pipeline 定义 JSON 中：`"DependsOn": ["A", "B"]`；  
  - 在 Python SDK 中：`training_step.add_depends_on([processing_step_1, processing_step_2])`。  
  可同时存在**数据依赖**与**额外 DependsOn**（例如 Step C 的输入来自 Step A，同时显式依赖 Step B 完成）。若依赖形成环，Pipelines 会抛出校验异常。

### 3.3 参数

- **类型**：Pipeline 级参数支持 `ParameterString`、`ParameterInteger`、`ParameterFloat`、`ParameterBoolean`。定义示例：  
  `ParameterInteger(name="ProcessingInstanceCount", default_value=1)`。  
  参数在创建 Pipeline 时传入 `Pipeline(..., parameters=[...])`，在 Step 定义中引用。
- **覆盖**：启动某次 execution 时可通过 `pipeline.start(parameters={"ProcessingInstanceCount": 2, "ModelApprovalStatus": "Approved"})` 覆盖默认值。  
  所有在 Step 中使用的参数必须在 Pipeline 的 `parameters` 中先定义。

### 3.4 Step 产出与下游消费

- 各 Step 执行完成后，其 **properties** 对应底层 Job 的 Describe* 响应（如 `DescribeProcessingJob`、`DescribeTrainingJob`、`DescribeTransformJob`）。下游 Step 通过 `step_xxx.properties.xxx`（JsonPath）引用这些产出（如 S3 URI、ModelName）。
- 若需在 Step 间传递 **JSON 等结构化数据**（如评估指标、配置），可使用 **PropertyFile**：由某 Step 产出 JSON 文件，通过 PropertyFile 声明，下游 Condition 等 Step 可读取该文件内容做分支判断。详见 [Pass Data Between Steps](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-propertyfile.html)。

### 3.5 并行与资源控制

- **默认**：无依赖的 Step 会**并行**执行；依赖关系确定后，所有「当前可运行」的 Step 会同时跑。
- **ParallelismConfiguration**：通过 `MaxParallelExecutionSteps` 限制**单次 execution** 中最多同时运行的 Step 数。可在 `pipeline.create(..., parallelism_config=...)` 或 `pipeline.start(..., parallelism_config=...)` 中指定；**start 时的配置优先于 pipeline 定义中的配置**。

### 3.6 Step 缓存（Caching）

- **机制**：Step caching 为 **opt-in**（默认关闭）。开启后，Pipelines 按 **step 类型** 的默认 **cache key 属性**（如代码、输入、超参等）计算签名；若在**同一 Pipeline** 内、在 **timeout 时间范围内**存在**相同签名**的**成功**执行，则复用该 Step 的产出，不再重跑。详见 [Default cache key attributes by pipeline step type](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-default-keys.html)。
- **约束**：仅考虑**成功**的 run；不复用失败 run。缓存**仅在同一 Pipeline 内**有效，不能跨 Pipeline 复用。启用缓存时必须设置 **timeout**（超过该时间的旧 run 不再作为复用候选）。

### 3.7 选择性执行（Selective execution）

- **用途**：只重跑 Pipeline 的**部分 Step**（如修复某步后只跑该步及下游），或**改参数后只重跑部分 Step**，上游产出从**某次参考 execution** 复用，避免全量重跑。
- **配置**：使用 `SelectiveExecutionConfig`：  
  - `selected_steps`：本次要执行的 Step 名称列表；这些 Step 必须在 DAG 中**连通**。  
  - `source_pipeline_execution_arn`（可选）：作为参考的某次 pipeline execution ARN；未选中的 Step 将使用该次 execution 的产出。  
  - `reference_latest_execution`（可选）：若不提供 ARN，为 `True`（默认）时使用**最近一次** pipeline execution 作为参考；为 `False` 且无 ARN 时，只能选择**无上游依赖**的 Step 子集。  
  参考 execution 必须处于 `Success` 或 `Failed` 状态。
- **参数**：可使用 `pipeline.build_parameters_from_execution(pipeline_execution_arn=..., parameter_value_overrides={...})` 从参考 execution 继承参数并覆盖部分值，再传给 `pipeline.start(parameters=..., selective_execution_config=...)`。  
  未选中的 Step 不执行；**选中 Step 的下游**若未在 selected_steps 中，则**不会运行**。

## 4. 状态与恢复（断点与选择性重跑）

- **无「原地 Resume」**：SageMaker Pipelines 没有类似 Metaflow 的「从失败 Step 原地 resume、沿用同一 Run id」的一等 API。失败后通常需要**重新 start** 一次 execution（新 execution），或使用**选择性执行**只跑失败 Step 及下游。
- **选择性执行**：等价于「新 execution + 指定 Step 子集 + 参考 execution 补齐上游」。可实现：  
  - 某步失败后，修代码/配置后只重跑该步及下游；  
  - 改超参/实例类型等后只重跑 Training 及后续 Step，上游 Preprocessing 等复用参考 execution。  
  与「CheckPoint 后微调配置再继续」的语义一致：**新 Run（新 execution），复用上游，改参重跑下游**。

## 5. 版本与 Artifact

- Step 产出（模型、数据、评估结果等）存储在 **S3**；通过各 Step 的 **properties**（Describe* 响应）在 Pipeline 定义中引用（JsonPath）。  
- **无** Metaflow/ZenML 式的「按 Run/Step 取任意历史 artifact」的**统一 Time Travel API**；需通过 **execution ARN + step 名** 或 List/Describe Pipeline Execution API 查询历史 execution 与各 step 的产出元数据，再结合 S3 路径访问实际数据。  
- 与 **SageMaker Experiments** 集成可记录实验、参数与指标；与 **Model Registry** 集成可版本化管理模型。

## 6. 人工暂停与择优

- **Callback Step**：支持在 Pipeline 中插入「等待外部回调」的节点，用于人工审批或外部系统确认后继续，适合昂贵训练前的 CheckPoint（择优）场景。  
- **Condition Step**：可根据上游评估结果（如 MSE 阈值）选择是否注册模型、部署或失败，实现自动择优分支；复杂择优可结合 Callback + 人工选择后再触发下游 execution 或子 Pipeline。

## 7. 与现有 Ray / risk_model_on_ray 集成

- SageMaker Pipelines 不内置 Ray。可将现有 **risk_model_on_ray** 或 Ray 脚本封装为：  
  - **Processing Step**：用 ScriptProcessor 或自定义镜像跑预处理 / 特征工程；  
  - **Training Step**：用 Estimator 提交训练（训练脚本内可起 Ray 或调用 Ray job）；  
  - **Execute code / @step**：将本地 Python 函数转为 Step，在函数内调 Ray 或读写 S3。  
  路径与存储由 S3 与 Step 的 inputs/outputs 传递；与方案 B（火山引擎 Task 封装）类似，编排在 Pipeline 定义，计算逻辑在镜像/脚本内。

## 8. 与方案 A～H 的对比

| 维度 | 方案 A | 方案 B | 方案 C（Metaflow） | 方案 D（Prefect） | 方案 E（ZenML） | 方案 F（DagsHub） | 方案 G（Valohai） | 方案 H（Kubeflow） | 方案 I（SageMaker） |
|------|--------|--------|--------------------|-------------------|-----------------|-------------------|-------------------|--------------------|----------------------|
| **执行粒度** | 画布 Node | Task | Step / Task | Task / Flow | Step / Pipeline | 外部 DAG | Pipeline Node | Component / Step | **Step（按类型）** |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate | 代码 FlowSpec + @step | Python @flow/@task | Python @pipeline/@step | 无内置编排 | YAML valohai.yaml | Python/IR YAML + Component | **SDK/UI/JSON + 数据依赖 + DependsOn** |
| **结果保留策略** | 每 Node 当前 Run 最新 | 需自建存储 | 每 Run 每 Step Artifact | Result + Artifact | 每 Run 每 Step Artifact | MLflow + DVC | datum 版本化 | Pipeline Root + Artifact/Parameter | **S3 + properties 引用；按 execution/step 查** |
| **断点恢复/重跑** | 手动重跑上游再下游 | 需自设计 | Resume 复用成功步 | Resume + run_input | 重跑 + Step 缓存 | 外部编排 | Reuse nodes | 未明确 Resume 改参 | **选择性执行 = 新 execution + 复用上游** |
| **Time Travel** | 无 | 无内置 | Client Run/Step 取 data | 部分 Artifact 版本 | Client run/step/artifact | MLflow/DVC | execution/datum | Run/Step UI/API | **无统一 API；Describe/List + S3** |
| **与 Ray/risk_model_on_ray** | 易对齐 | 封装为 Task | 封装为 Step | Task 内调 Ray | Step 内调 Ray | 外部计算 | step 内脚本 | Component 内脚本 | **Processing/Training/Execute code 内封装** |
| **学习与运维成本** | 低 | 中高 | 中 | 中低 | 中 | 低 | 中 | 中高（K8s/KFP） | **中：AWS 生态、SDK/UI** |

## 9. 基于 SageMaker Pipelines 实现内部模型探索 SOP 的要点

- **Pipeline 结构**：Pipeline = name + parameters + steps；画布节点映射为各类 **Step**（Processing→WOE/特征、Training→模型训练、Condition→择优/质量门控、RegisterModel→注册、Transform→批量推理等）。数据依赖用 `step_xxx.properties.xxx` 串联；无数据传递的先后顺序用 `add_depends_on`。
- **SavePoint**：某 Step 完成后产出写入 S3，对应「SavePoint」；选择性执行时以该次 execution 为 reference，后续只跑下游 Step 即从「SavePoint 之后」继续。
- **CheckPoint（择优）**：用 **Condition Step** 根据评估结果分支；或 **Callback Step** 暂停等人审，通过后再继续；多路 Tune 可用多个 Training/Tuning Step 并行，再通过 Condition 或人工选优进入 RegisterModel / Deploy。
- **Model Inference 独立画布**：可建独立 Pipeline，输入为某次 execution 的模型（S3 或 Model Registry 版本），仅包含 Transform 或 Deploy 等 Step。
- **参数与配置**：Pipeline 级参数在 `start(parameters=...)` 覆盖；选择性执行可用 `build_parameters_from_execution` + `parameter_value_overrides` 实现「沿用上次大部分参数、只改少数」的改配置再跑。

## 10. 参考链接

- [Pipelines overview](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-overview.html)
- [Pipeline structure and execution](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-pipeline.html)
- [Pipelines steps](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-steps.html)
- [Add a step (step types)](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-steps-types.html)
- [Pipeline parameters](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-parameters.html)
- [Pass Data Between Steps (PropertyFile)](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-propertyfile.html)
- [Caching pipeline steps](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-caching.html)
- [Selective execution of pipeline steps](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-selective-ex.html)
- [Lift-and-shift Python code with the @step decorator](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-step-decorator.html)
- [Schedule Pipeline Runs (EventBridge)](https://docs.aws.amazon.com/sagemaker/latest/dg/pipeline-eventbridge.html)
- [SageMaker Pipelines - Python SDK](https://sagemaker.readthedocs.io/en/stable/amazon_sagemaker_model_building_pipeline.html)
