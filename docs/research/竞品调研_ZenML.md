# 竞品调研：ZenML

**来源出处**：[ZenML 官方文档](https://docs.zenml.io/) / [ZenML GitHub](https://github.com/zenml-io/zenml)

## 1. 来源与概述

ZenML 是统一、可扩展的开源 MLOps 框架，面向从传统 ML 到 AI Agent 的整条管线，强调「一套框架覆盖从决策树到多 Agent 系统」。核心能力包括：用 **Step + Pipeline** 定义工作流、**Stack**（Orchestrator + Artifact Store + 可选 Deployer）抽象基础设施、**Artifact** 自动版本化与 lineage、**Step 级缓存** 加速迭代、**Pipeline Snapshot** 不可变快照（DAG+代码+配置）便于从 Dashboard/API/CLI 触发运行。支持本地与远程部署，可与 MLflow、Kubeflow、K8s、GCP Vertex、Sagemaker 等集成。

**与本文档的关系**：与 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md) 同属架构层竞品调研，作为 **Canvas DAG 备选方案 E**。重点考察其编排粒度、Artifact 与 Time Travel、断点/缓存与恢复、与 ML Pipeline（SavePoint/CheckPoint、多路 Tune、独立推理画布）的匹配度。

## 2. 核心概念

- **Step**：用 `@step` 装饰的函数，是 Pipeline 中的执行单元；输入输出有类型注解，由 Materializer 负责序列化/反序列化。
- **Pipeline**：用 `@pipeline` 装饰的函数，内部仅可调用 Step；Step 间依赖由数据流（上一步输出作为下一步输入）或 `after=[...]` 显式指定，形成 DAG。
- **Artifact**：Step 的输入输出在 Artifact Store 中自动存储、版本化并记录 lineage；支持多输出（Tuple + Annotated 命名）。
- **Model**：训练产出的模型及元数据在 ZenML 中为一等公民，与 Model Version 统一管理。
- **Stack**：Orchestrator（执行编排）、Artifact Store（存储）、可选 Deployer（HTTP 部署）；可切换本地/远程 Stack。
- **Pipeline Snapshot**：Pipeline 的不可变快照（DAG、代码、配置、镜像）；从 SDK/CLI/Dashboard/REST 触发运行（**运行 Snapshot 为 ZenML Pro 功能**）。Deployment 则提供长驻 HTTP 服务（OSS + Pro 均可用）。

## 3. 状态与缓存（断点恢复语义）

- **Step 缓存**：默认开启。根据 Step 的 code、inputs、parameters 等生成 cache key；相同 key 时复用已有 Step 输出，不重新执行。支持 Pipeline/Step 级 `enable_cache`、`CachePolicy`（如 `expires_after`、`include_step_code` 等）。
- **断点恢复**：无「从失败 Run 原地 Resume」的一等 API。实际做法是**重新运行同一 Pipeline**：已成功的 Step 因缓存被复用，仅未完成或失败的 Step 会重新执行，效果上等价于「从最近成功点恢复、只重跑失败及之后」。
- **执行模式**：`FAIL_FAST` / `STOP_ON_FAILURE` / `CONTINUE_ON_FAILURE` 控制某 Step 失败时是否继续执行其他分支（部分 Orchestrator 支持）。

## 4. Artifact 与 Time Travel

- **版本与 lineage**：每个 Artifact 在 Artifact Store 中版本化，lineage（谁产出、谁消费）由 ZenML 自动记录。
- **按 Run/Step 访问历史**：通过 Client API 可访问任意已完成 Run 的 Step 产出，例如 `client.get_pipeline_run(run_id).steps["step_name"].outputs["output_name"].load()`；也可按 Artifact 名称/版本加载：`client.get_artifact_version("artifact_name", "version")`。支持跨 Pipeline 使用历史 Artifact（如推理 Pipeline 加载某次训练 Run 的模型）。**与 Metaflow 的 Time Travel 语义接近**：可按 run/step 取历史 data。
- **Materializer**：自定义类型需实现 Materializer 以定义读写方式；内置支持常见类型（DataFrame、numpy、sklearn 等）。

## 5. 人工暂停与择优

- 官方文档未提供类似 Prefect 的 `pause_flow_run(wait_for_input=...)` 或 Metaflow 的「在指定 Step 暂停等待人工」的一等能力。
- **实现思路**：可将「择优」拆成独立 Pipeline 或 Step：上游多路 Tune 产出多组 Artifact，通过 Dashboard/API 或外部逻辑选定一组后，再触发下游 Pipeline 并传入所选 Artifact 版本/路径；或在一个 Pipeline 内用条件 Step + 外部存储/消息传递模拟「等待人工输入后继续」。

## 6. 与现有 Ray / risk_model_on_ray 集成

- 无内置 Ray 集成。在 `@step` 内调用现有 Ray 脚本或 risk_model_on_ray 即可，路径与存储由应用层管理（与方案 A、D 类似）。可配合 Stack 中的 Orchestrator（如 K8s）在 Step 内提交 Ray Job 或执行脚本。

## 7. 与方案 A / B / C / D 的对比

| 维度 | 方案 A | 方案 B | 方案 C（Metaflow） | 方案 D（Prefect） | 方案 E（ZenML） |
|------|--------|--------|--------------------|-------------------|-----------------|
| **执行粒度** | 画布 Node | Task（高自由度） | Step / Task | Task / Flow | Step / Pipeline |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate + tasks | 代码 FlowSpec + @step | 纯 Python @flow/@task | 纯 Python @pipeline/@step |
| **结果保留策略** | 每 Node 仅当前 Run 最新结果 | 需自建或依托 Task 产出存储 | 每 Run 每 Step Artifact 持久化、多版本 | Result + Artifact（key 多版本）；大对象自建 | 每 Run 每 Step Artifact 持久化、多版本 |
| **断点恢复 / 重跑** | 手动触发上游再序贯重跑 | 需在 Task/平台层自设计 | Resume 复用成功步，仅重跑失败及之后 | Resume + task cache | 无原生 Resume API；重跑 Pipeline + Step 缓存复用，效果等价 |
| **Time Travel** | 无 | 无内置 | 内置：Client API 按 Run/Step 取 data | 部分：Artifact key 版本，无按 run/step 一等 API | 内置：Client 按 run/step/artifact 名版本取 data |
| **与 Ray / risk_model_on_ray 集成** | 易对齐现有调度与 Run 模型 | 需将 Step 封装为 Task 镜像/脚本 | 需封装为 Step 或 artifact 传路径 | Task 内调 Ray/脚本，自管路径与存储 | Step 内调 Ray/脚本，自管路径与存储 |
| **学习与运维成本** | 低 | 中高（YAML、K8s/Argo） | 中（Python + @checkpoint） | 中低：Python + Server/Cloud 或自建 | 中：Python + Stack + Server；Snapshot 运行等为 Pro 能力 |

## 8. 基于 ZenML 实现内部模型探索 SOP 的要点

- **Pipeline Meta**：Pipeline 参数或首 Step 承载元信息、资源等。
- **数据源 → WOE Fit → Feature Selection → WOE Merge**：画布节点映射为 Step；SavePoint 即「Step 完成即持久化 Artifact、可被后续 Run 或他 Pipeline 使用」；CheckPoint（择优）需自建：如多路 Tune 各写 Artifact，再通过外部选择后触发下游 Pipeline 并传入所选 Artifact。
- **多路 Tune 合并择优**：可用多分支 Step（不同参数/配置）并行写多组 Artifact；择优节点用独立 Pipeline 或「选定 Artifact 版本再触发 Model Train/Inference」实现。
- **Model Inference 独立画布**：独立 Pipeline，入口参数或 Client 加载「某次 Run 的模型/Artifact 版本」，仅数据源 + 推理 Step 即可。
- **Pipeline Snapshot**：训练/推理 Pipeline 可打 Snapshot，便于从 Dashboard/API 按参数触发（运行 Snapshot 需 ZenML Pro）；Deployment 可用于在线推理服务（OSS 可用）。

## 9. 参考链接

- [ZenML Welcome / Core Concepts](https://docs.zenml.io/getting-started/core-concepts)
- [Steps & Pipelines](https://docs.zenml.io/concepts/steps_and_pipelines)
- [Artifacts](https://docs.zenml.io/concepts/artifacts)
- [Cache previous executions](https://docs.zenml.io/user-guides/starter-guide/cache-previous-executions)
- [Pipeline Snapshots](https://docs.zenml.io/concepts/snapshots)
- [Pipeline Deployments](https://docs.zenml.io/concepts/deployment)
- [ZenML GitHub](https://github.com/zenml-io/zenml)
