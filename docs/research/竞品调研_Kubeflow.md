# 竞品调研：Kubeflow Pipelines

**来源出处**：[Kubeflow 文档](https://www.kubeflow.org/docs/) / [Kubeflow Pipelines Overview](https://www.kubeflow.org/docs/components/pipelines/overview/)

## 1. 来源与概述

Kubeflow Pipelines (KFP) 是 Kubeflow 的**流水线编排组件**，用于在 Kubernetes 上构建和运行可移植、可扩展的 ML 工作流。用户通过 **Python SDK** 或 **YAML** 定义 **Component**（最小执行单元）与 **Pipeline**（DAG），编译为平台无关的 **IR YAML**，再提交到 KFP 兼容后端（开源 KFP 或 Google Cloud Vertex AI Pipelines）执行。Pipeline 由多个 Component 组成有向图，支持条件、并行、Artifact/Parameter 传递、Caching 与 exit handling。运行时的每次执行称为 **Run**；可归入 **Experiment** 分组管理，支持 **Recurring Run** 定时/触发执行。

**与本文档的关系**：与 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md)、[竞品调研_ZenML](./竞品调研_ZenML.md)、[竞品调研_DagsHub](./竞品调研_DagsHub.md)、[竞品调研_Valohai](./竞品调研_Valohai.md)、[竞品调研_Amazon_SageMaker](./竞品调研_Amazon_SageMaker.md) 同属架构层竞品调研，作为 **Canvas DAG 备选方案 H**。重点考察其 Pipeline/Component/Step 与 Run 的对应关系、Artifact 与参数承载、以及断点/恢复语义（检索到的 KFP 文档中**未**明确写出「从失败继续且改参数」的一等能力，本调研如实记录，不编造）。

## 2. 核心概念

- **Pipeline**：工作流的**逻辑定义**，声明一组 **Component** 的执行顺序、条件与数据流。包含：输入参数（functional parameters、pipeline_root、name/description 等）、Component tasks、控制逻辑（条件 if/elif/else、并行、exit handling）、以及运行时配置（环境变量、资源请求、重试、缓存）。Pipeline 通过 Python 中 `@pipeline` 装饰的函数定义，由编译器转为 **IR YAML**，不直接执行；提交 **Run** 时由后端将 Pipeline 转为在集群上启动的 Pod 等资源。
- **Component**：Pipeline 的**最小构建块**，类似「函数」：封装一段代码（多为 Python 函数）及其依赖（base image、Python 包、环境变量等）与 I/O 规范（**Artifact** 与 **Parameters**）。Component 之间不共享内存，通过 Artifact（大对象，如 Dataset、Model）和 Parameters（小值，如字符串、数字）交换数据。推荐用 `@dsl.component` 定义；也支持 YAML 定义（implementation + interface + metadata）。
- **Step**：某次 **Run** 中**某个 Component 的一次执行**。Step 与 Component 是实例化关系；同一 Component 在循环或条件分支中可对应多个 Step 实例。
- **Run**：Pipeline 的**一次执行**。通过 `create_run_from_pipeline_func` 或 `create_run_from_pipeline_package`（或 UI 上传 YAML）提交；每次提交产生一个 Run，后端按 DAG 调度各 Step（每个 Step 对应一个 Pod 执行 Component 代码）。
- **Experiment**：用于对 Run 分组的**工作区**；可将多组 Run 归入不同 Experiment 便于对比与管理。Experiment 可包含 **Recurring Run**（定时或触发执行的 Run）。
- **Pipeline Root**：对象存储根路径，用于存放 Run 的 metadata 与 Artifact；在 Pipeline 声明或 Run 提交时配置。

## 3. 节点设计（Component 与 Step）

- **无内置「Step 类型」枚举**：KFP 不提供类似 SageMaker 的固定 Step 类型（Processing、Training、Condition 等）；节点形态完全由用户定义的 **Component** 决定。每个 Component 可指定 base image、依赖、资源请求与 I/O。
- **Component 定义方式**：  
  - **Python**：`@dsl.component` 装饰的函数，可指定 `base_image`、`packages_to_install` 等；输入输出为函数参数/返回值，支持 `Output[Dataset]`、`Output[Model]` 等 Artifact 类型。  
  - **YAML**：implementation（如 container image + args）、inputs/outputs、metadata；可被 Python SDK 通过 `load_component_from_file` 加载后与 Python Component 混用。
- **依赖与顺序**：由 Pipeline 函数内的**数据流**决定——下游 Component 的输入引用上游 Component 的输出时，自动形成 DAG 边；无数据依赖的 Component 可并行执行。支持 **Control Flow**：条件（if/elif/else）、并行、exit handling。
- **配置承载**：Pipeline 级 **input parameters** 在定义时声明；**某次 Run** 的参数在**提交 Run 时**传入（如 `client.create_run_from_pipeline_func(..., parameters={...})`），即执行计划中的「某次运行的参数」承载在 **Run** 维度。

## 4. 产物与版本（Artifact / Parameter）

- **Artifact**：Component 产出的大对象（Dataset、Model、Markdown、HTML、metrics 等），由 KFP 在 **Pipeline Root** 下持久化；UI 可渲染部分 Artifact 类型。在 Component 间通过 Pipeline 的数据流传递。
- **Parameters**：小值（字符串、数字、列表、字典、布尔等），在 Component 间通过参数传递。
- **版本与追溯**：metadata 与 Artifact 存储在 Pipeline Root；通过 KFP UI 或 API 可按 **Run → Step** 查看历史 Run、各 Step 状态与产出。与 Metaflow 的「按 Run/Step 取历史 data」的 Time Travel 在语义上接近（通过 Run/Step 维度查询），具体 API 以 KFP 文档为准。

## 5. 状态与恢复（断点 / Resume）

- **Caching**：KFP 支持**按 task（Step）缓存**：当某 Step 的输入与配置与历史某次执行一致时，可复用该 Step 的产出，不重新执行。详见 [Caching](https://www.kubeflow.org/docs/components/pipelines/user-guides/core-functions/caching/)。
- **Resume 与改参数**：在检索到的 [Kubeflow Pipelines 官方文档](https://www.kubeflow.org/docs/components/pipelines/overview/)（Overview、Concepts 下的 Pipeline、Component、Step、Experiment、Output Artifact、IR YAML）中，**未**找到与 Metaflow「Resume 从失败步继续」或 Prefect「对当前 flow run 提交 run_input 再继续」**等效**的、明确的「从失败 Step 继续且允许修改参数」的一等能力描述。本调研如实记录为**不明确**：若实际产品支持类似能力，需以最新 KFP 文档或源码为准，此处不编造。

## 6. 与现有 Ray / risk_model_on_ray 集成

- KFP 不内置 Ray。可将现有脚本或 risk_model_on_ray 封装为 **Component**：在 Component 的 Python 函数或容器内调用 Ray、读写 S3/对象存储；输入输出通过 Artifact/Parameter 与 Pipeline Root 传递。与方案 B（火山引擎 Task 封装）、方案 G（Valohai step）类似：编排与 DAG 在 KFP，计算逻辑在镜像/脚本内。

## 7. 与方案 A～I 的对比

| 维度 | 方案 A | 方案 B | 方案 C（Metaflow） | 方案 D（Prefect） | 方案 E（ZenML） | 方案 F（DagsHub） | 方案 G（Valohai） | 方案 H（Kubeflow） | 方案 I（SageMaker） |
|------|--------|--------|--------------------|-------------------|-----------------|-------------------|-------------------|--------------------|----------------------|
| **执行粒度** | 画布 Node | Task | Step / Task | Task / Flow | Step / Pipeline | 外部 DAG | Pipeline Node | **Component / Step** | Step（按类型） |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate | 代码 FlowSpec + @step | Python @flow/@task | Python @pipeline/@step | 无内置编排 | YAML valohai.yaml | **Python/IR YAML + Component** | SDK/UI/JSON + 数据依赖 |
| **结果保留策略** | 每 Node 当前 Run 最新 | 需自建存储 | 每 Run 每 Step Artifact | Result + Artifact | 每 Run 每 Step Artifact | MLflow + DVC | datum 版本化 | **Pipeline Root + Artifact/Parameter** | S3 + properties |
| **断点恢复/重跑** | 手动重跑上游再下游 | 需自设计 | Resume 复用成功步 | Resume + run_input | 重跑 + Step 缓存 | 外部编排 | Reuse nodes | **未明确 Resume 改参** | 选择性执行 |
| **Time Travel** | 无 | 无内置 | Client Run/Step 取 data | 部分 Artifact 版本 | Client run/step/artifact | MLflow/DVC | execution/datum | **Run/Step UI/API 可查** | Describe/List + S3 |
| **与 Ray/risk_model_on_ray** | 易对齐 | 封装为 Task | 封装为 Step | Task 内调 Ray | Step 内调 Ray | 外部计算 | step 内脚本 | **Component 内脚本/镜像** | Processing/Training/Execute code |
| **学习与运维成本** | 低 | 中高 | 中 | 中低 | 中 | 低 | 中 | **中高（K8s/KFP）** | 中（AWS/SDK） |

## 8. 基于 Kubeflow Pipelines 实现内部模型探索 SOP 的要点

- **Pipeline 结构**：画布节点映射为 **Component**（数据源、WOE Fit、Feature Selection、WOE Merge、Model Tune、Model Train、Model Inference 等）；依赖由 Component 间输入输出连接形成；条件分支用 KFP 的 if/elif/else；人工择优需自建（如条件 Component + 外部存储或人工触发下游 Pipeline）。
- **SavePoint**：某 Component 完成后产出写入 Artifact（Pipeline Root）；后续 Run 或 Recurring Run 可通过 Caching 复用该 Step，等价于从 SavePoint 之后继续。
- **CheckPoint（择优）**：无内置「Pause for human approval」；可用条件 Component 根据上游评估结果分支，或由外部系统在某个 Artifact 就绪后触发另一 Pipeline（如 Model Inference）并传入所选模型 Artifact。
- **Model Inference 独立画布**：独立 Pipeline，输入为某次 Run 的模型 Artifact（或从 Pipeline Root 加载的历史 Artifact），仅包含推理相关 Component。
- **参数**：Pipeline 参数在**提交 Run 时**传入，即执行计划中的「某次运行配置」在 **Run** 维度。

## 9. 参考链接

- [Kubeflow Pipelines Overview](https://www.kubeflow.org/docs/components/pipelines/overview/)
- [Concepts](https://www.kubeflow.org/docs/components/pipelines/concepts/)（Pipeline、Component、Graph、Experiment、Run and Recurring Run、Step、Output Artifact、IR YAML、ML Metadata）
- [Pipeline (concept)](https://www.kubeflow.org/docs/components/pipelines/concepts/pipeline/)
- [Component (concept)](https://www.kubeflow.org/docs/components/pipelines/concepts/component/)
- [Step (concept)](https://www.kubeflow.org/docs/components/pipelines/concepts/step/)
- [Experiment (concept)](https://www.kubeflow.org/docs/components/pipelines/concepts/experiment/)
- [Output Artifact](https://www.kubeflow.org/docs/components/pipelines/concepts/output-artifact/)
- [Caching](https://www.kubeflow.org/docs/components/pipelines/user-guides/core-functions/caching/)
- [Control Flow](https://www.kubeflow.org/docs/components/pipelines/user-guides/core-functions/control-flow/)
- [KFP Python SDK](https://kubeflow-pipelines.readthedocs.io/)
