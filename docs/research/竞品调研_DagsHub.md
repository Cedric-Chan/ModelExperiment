# 竞品调研：DagsHub

**来源出处**：[DagsHub 官方文档](https://dagshub.com/docs/) / [DagsHub](https://dagshub.com)

## 1. 来源与概述

DagsHub 是面向 AI/ML 全生命周期的**数据与实验管理平台**，覆盖从数据采集、数据集构建与标注、实验追踪（模型训练与 prompt 工程）到模型管理。基于开源工具与格式：**Git**、**DVC**、**MLflow**、**Label Studio** 等，与现有工具链兼容。平台**不提供计算资源**，依赖用户自有计算（本地、云或边缘）；可与用户存储与计算环境集成，也可使用 DagsHub Storage 托管数据。适合非结构化与多模态数据（文本、图像、音频、视频、文档等）。

**与本文档的关系**：与 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md)、[竞品调研_ZenML](./竞品调研_ZenML.md) 同属架构层竞品调研，作为 **Canvas DAG 备选方案 F**。DagsHub **不提供 DAG 编排与执行引擎**，而是提供数据版本、实验追踪、模型注册与协作；编排与执行由外部系统（如方案 A 画布 + Ray）承担。重点考察其与 **MLflow** 的集成（与内部「用 MLflow 管理离线实验中间产物」决策的契合度）、数据版本与实验复现能力。

## 2. 核心概念

- **Repository**：每个 DagsHub 仓库可关联 Git 代码、DVC 数据、MLflow 实验；创建仓库后自动提供 **MLflow Tracking Server**（如 `https://dagshub.com/<username>/<repo>.mlflow`），用于记录参数、指标与 artifact。
- **Experiment Tracking**：通过 **MLflow** 记录实验 run、参数、指标与 artifact；在 DagsHub 界面中可视化、对比与复现。支持 `dagshub.init()` 自动配置 MLflow tracking URI 与鉴权。
- **数据版本**：使用 **DVC** 或 DagsHub Data Engine 做数据集版本化与可复现；可与 MLflow 结合形成「代码 + 数据 + 实验」的完整审计链。
- **Model Registry & Deployment**：模型版本、状态与部署管理（文档中有部署到云等用例）。
- **无计算侧**：训练与推理在用户自己的环境执行；DagsHub 只做元数据、存储与协作层。

## 3. 与 MLflow 的集成

- 每个 DagsHub 仓库自带 **远程 MLflow Server**，无需自建。配置方式：`mlflow.set_tracking_uri('https://dagshub.com/<user>/<repo>.mlflow')`，鉴权可用环境变量 `MLFLOW_TRACKING_USERNAME` / `MLFLOW_TRACKING_PASSWORD` 或 `dagshub.init()` 自动处理。
- 实验 run 的 parameters、metrics、artifacts 写入 MLflow，在 DagsHub 的 Experiments 界面查看与对比。MLflow 会记录 Git commit 等信息，便于与代码、数据版本关联，实现可复现。

## 4. 与方案 A / B / C / D / E 的对比

| 维度 | 方案 A | 方案 B | 方案 C（Metaflow） | 方案 D（Prefect） | 方案 E（ZenML） | 方案 F（DagsHub） |
|------|--------|--------|--------------------|-------------------|-----------------|-------------------|
| **执行粒度** | 画布 Node | Task（高自由度） | Step / Task | Task / Flow | Step / Pipeline | 外部 DAG + 平台管理数据/实验/模型 |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate + tasks | 代码 FlowSpec + @step | 纯 Python @flow/@task | 纯 Python @pipeline/@step | 无内置编排；Git/DVC/MLflow 集成，编排由外部承担 |
| **结果保留策略** | 每 Node 仅当前 Run 最新结果 | 需自建或依托 Task 产出存储 | 每 Run 每 Step Artifact 持久化、多版本 | Result + Artifact（key 多版本）；大对象自建 | 每 Run 每 Step Artifact 持久化、多版本 | MLflow Artifact + DVC/Storage；每 repo 托管 MLflow |
| **断点恢复 / 重跑** | 手动触发上游再序贯重跑 | 需在 Task/平台层自设计 | Resume 复用成功步，仅重跑失败及之后 | Resume + task cache | 重跑 Pipeline + Step 缓存复用 | 依赖外部编排；MLflow 记录 run/artifact 便于复现 |
| **Time Travel** | 无 | 无内置 | 内置：Client 按 Run/Step 取 data | 部分：Artifact key 版本，无按 run/step 一等 API | 内置：Client 按 run/step/artifact 取 data | 通过 MLflow 按 run/artifact 查询；数据版本用 DVC |
| **与 Ray / risk_model_on_ray 集成** | 易对齐现有调度与 Run 模型 | 需将 Step 封装为 Task 镜像/脚本 | 需封装为 Step 或 artifact 传路径 | Task 内调 Ray/脚本，自管路径与存储 | Step 内调 Ray/脚本，自管路径与存储 | 计算在自有环境；DagsHub/MLflow 做实验与 artifact 登记，与方案 A 组合自然 |
| **学习与运维成本** | 低 | 中高（YAML、K8s/Argo） | 中（Python + @checkpoint） | 中低：Python + Server/Cloud 或自建 | 中：Python + Stack + Server | 低：Git/DVC/MLflow 生态；无计算侧运维 |

## 5. 基于 DagsHub + 方案 A 实现内部模型探索的要点

- **定位**：DagsHub 作为**数据与实验管理层**，与**方案 A（画布 + Ray）** 组合。画布与 Ray 负责 DAG 编排与执行；**中间产物与模型由 MLflow 管理**，与内部「用 MLflow 管理离线实验 artifact」决策一致。DagsHub 提供托管 MLflow Server、数据集版本（DVC）、实验对比与协作界面，无需自建 MLflow 服务。
- **Pipeline Meta → 数据源 → … → Model Inference**：各画布节点在执行时（如 risk_model_on_ray 脚本内）调用 MLflow 记录 run/artifact；tracking_uri 指向 DagsHub 提供的 MLflow 地址，则所有 run 与 artifact 集中在 DagsHub 仓库下，便于按 Run/节点查看与复现。
- **SavePoint/CheckPoint**：仍由画布与 Run 状态机实现；产物在写 S3 的同时（或统一）通过 MLflow log_artifact 登记，Revert/复现时可通过 MLflow 按 run_id 取回对应 artifact。
- **多路 Tune、择优、独立推理画布**：编排逻辑不变；择优结果与所选模型/artifact 可记录在 MLflow（如 tag 或 artifact 路径），Model Inference 从 MLflow 加载所选模型。

## 6. 参考链接

- [DagsHub 文档首页](https://dagshub.com/docs/)
- [DagsHub + MLflow 集成](https://dagshub.com/docs/integration_guide/mlflow_tracking/)
- [Track ML Experiments](https://dagshub.com/docs/use_cases/track_ml_experiments)
- [Experiment Tracking（Feature Guide）](https://dagshub.com/docs/feature_guide/experiment_tracking)
- [Reproduce Experiments](https://dagshub.com/docs/use_cases/reproduce_experiment_results)
