# 竞品调研：Valohai

**来源出处**：[Valohai 官方文档](https://docs.valohai.com/) / [Valohai](https://valohai.com)

## 1. 来源与概述

Valohai 是**模块化 MLOps 平台**，通过**配置（valohai.yaml）** 编排 ML 工作流，**无需侵入式 SDK 修改业务代码**。支持在多种基础设施上运行：AWS、Azure、GCP、Oracle、Snowflake、on-premises、Kubernetes、Slurm。可与现有栈并存：若已使用 MLflow、SageMaker、自定义脚本或 Kubeflow，可保留；Valohai 在其上增加编排、可复现性与计算效率。核心能力包括：Pipeline（DAG 化多步工作流）、数据版本与 lineage（datum:// 不可变链接）、Step 间自动 checkpoint、Execution Reuse（相同配置复用上一执行结果）、人工审批节点、Experiment Tracking 与可视化。

**与本文档的关系**：与 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md)、[竞品调研_ZenML](./竞品调研_ZenML.md)、[竞品调研_DagsHub](./竞品调研_DagsHub.md) 同属架构层竞品调研，作为 **Canvas DAG 备选方案 G**。重点考察其 YAML 驱动 Pipeline、每步独立 Execution 带来的自然 checkpoint、datum 版本化与「Reuse nodes」断点恢复、以及与人审/择优的匹配度。

## 2. 核心概念

- **Pipeline**：由 **Nodes**（Execution / Task / Deployment）与 **Edges**（Output→Input、Parameters→Parameters、Metadata→Parameters 等）组成的 DAG。将复杂流程拆成可版本化、可复用、可独立调配资源的步骤。
- **Node 类型**：**Execution**（标准 Valohai 执行，跑业务代码）、**Task**（同代码多组参数/数据的集合，适合超参搜索或多数据集 benchmark）、**Deployment**（在流程中创建模型端点）。
- **Execution**：单次「Step」运行，对应 valohai.yaml 中的 step 定义（image、command、inputs、outputs、parameters）。每个 Pipeline 步骤以独立 Execution 运行，形成**自然 checkpoint**：失败时只需从上一成功步重跑，无需重跑全链。
- **Reuse nodes**：修改了第 4 步代码时，可复用步骤 1–3 的结果，直接从第 4 步开始；支持 Pipeline 级 `reuse-executions: true`（自动复用）或界面/API 手动选择历史 Execution 作为某 node 的输入。
- **数据**：写入 `/valohai/outputs/` 的文件自动上传并获 **datum://** 不可变链接；输入可用 `datum://`、`dataset://`、`model://` 或 S3/Azure/GCS 等；所有文件版本化、lineage 可追溯。

## 3. 状态与恢复（Checkpoint / Reuse）

- **自动 checkpoint**：每个 Pipeline 步骤是独立 Execution，步骤间自然形成 checkpoint；某步失败后重新运行 Pipeline 时，可**从上一成功步继续**（依赖 Execution Reuse）。
- **Execution Reuse（缓存）**：当某步的 step name、Docker image、inputs（checksum）、parameters、source code（Git commit 或文件内容）**完全一致**时，Valohai 复用该步的已有执行结果，不重新计算。Pipeline 中可配置 `reuse-executions: true` 启用。
- **手动 Reuse**：可在界面或 API 中为某 node 指定「使用某次历史 Execution 的输出」，适合开发时跳过昂贵步骤或从「上周某次理想 run」继续。

## 4. 人工暂停与择优

- 文档明确支持 **Pause for human approval before expensive training steps** 及 **Add conditional logic to explore different paths based on results**，适合在昂贵训练前人工确认或择优。具体实现依赖 Pipeline 中的人审节点或条件分支。
- 可与「Select best model」「Compare results」等节点组合，实现多路 Tune 后自动/人工选优再进入下游。

## 5. 数据与 Time Travel

- **datum://**：每个 execution 产出的文件有唯一不可变链接，包含「何种代码与参数、哪次 execution、何时创建、文件内容」；作为下游 input 时保证可复现。
- **Lineage**：输入/输出、代码、参数均被追踪，形成完整审计链。按 execution/step 回溯历史产出即 Time Travel 的语义；通过 Valohai 界面或 API 按 run/execution 查询与加载。

## 6. 与现有 Ray / risk_model_on_ray 集成

- Valohai 不内置 Ray；需将现有脚本封装为 Valohai **step**（Docker image + command，inputs/outputs 在 valohai.yaml 声明），在 step 内调用 Ray 或 risk_model_on_ray。与方案 B（火山引擎 Task 封装）类似：编排与依赖在 YAML，计算逻辑在镜像/脚本内；路径与存储可由 Valohai 的 datum/dataset 或自管 S3 传递。文档称可与现有 MLflow/SageMaker 等并存，中间产物也可同时写 MLflow。

## 7. 与方案 A / B / C / D / E / F 的对比

| 维度 | 方案 A | 方案 B | 方案 C（Metaflow） | 方案 D（Prefect） | 方案 E（ZenML） | 方案 F（DagsHub） | 方案 G（Valohai） |
|------|--------|--------|--------------------|-------------------|-----------------|-------------------|-------------------|
| **执行粒度** | 画布 Node | Task（高自由度） | Step / Task | Task / Flow | Step / Pipeline | 外部 DAG + 平台管理 | Pipeline Node（Execution/Task/Deployment） |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate + tasks | 代码 FlowSpec + @step | 纯 Python @flow/@task | 纯 Python @pipeline/@step | 无内置编排；Git/DVC/MLflow | **YAML valohai.yaml**；无侵入 SDK |
| **结果保留策略** | 每 Node 仅当前 Run 最新结果 | 需自建或依托 Task 产出存储 | 每 Run 每 Step Artifact 持久化、多版本 | Result + Artifact；大对象自建 | 每 Run 每 Step Artifact 持久化、多版本 | MLflow + DVC/Storage | **datum:// 版本化、lineage**；每 execution 产出可追溯 |
| **断点恢复 / 重跑** | 手动触发上游再序贯重跑 | 需在 Task/平台层自设计 | Resume 复用成功步，仅重跑失败及之后 | Resume + task cache | 重跑 Pipeline + Step 缓存复用 | 依赖外部编排 | **每步独立 Execution + Reuse nodes**：从上一成功步继续或复用历史 execution |
| **Time Travel** | 无 | 无内置 | 内置：Client 按 Run/Step 取 data | 部分：Artifact key 版本 | 内置：Client 按 run/step/artifact 取 data | MLflow 按 run/artifact；DVC 数据版本 | 按 execution/step 与 datum 查询历史产出；lineage 完整 |
| **与现有 Ray / risk_model_on_ray 集成** | 易对齐现有调度与 Run 模型 | 需将 Step 封装为 Task 镜像/脚本 | 需封装为 Metaflow Step 或 artifact 传路径 | Task 内调 Ray/脚本，自管路径与存储 | Step 内调 Ray/脚本，自管路径与存储 | 计算在自有环境；DagsHub/MLflow 登记 | 需将脚本封装为 Valohai step（镜像+command）；可与 MLflow 等并存 |
| **学习与运维成本** | 低 | 中高（YAML、K8s/Argo） | 中（Python + @checkpoint） | 中低：Python + Server/Cloud 或自建 | 中：Python + Stack + Server | 低：Git/DVC/MLflow；无计算侧运维 | 中：YAML + Valohai 平台；支持多云/K8s/Slurm |

## 8. 基于 Valohai 实现内部模型探索 SOP 的要点

- **Pipeline Meta → 数据源 → … → Model Inference**：画布节点映射为 valohai.yaml 中的 **step** 与 **pipeline nodes**；Edges 用 `[node.output.*, downstream.input.xxx]` 传递 datum。数据源、WOE Fit、Feature Selection、WOE Merge、Model Tune、Model Train、Model Inference 各为一步或多步；CheckPoint（择优）对应人审节点或条件分支。
- **SavePoint**：对应「某 step 完成后产出写 /valohai/outputs/，获 datum://」；Revert 或重跑时通过 **Reuse nodes** 复用该 step 的历史 execution，从下一节点继续。
- **CheckPoint（择优）**：使用 Pipeline 的 **Pause for human approval** 或条件节点；多路 Tune（Task 节点多组参数）完成后人审选优，再进入 Model Train / Model Inference。择优结果可通过参数或 datum 传入下游。
- **Model Inference 独立画布**：独立 Pipeline，输入为「某次 execution 的 model datum」+ 数据源，仅推理步骤即可。
- **与 MLflow**：Valohai 可与 MLflow 等并存；若内部已定 MLflow 管理中间产物，可在各 step 内同时写 MLflow，Valohai 负责编排与 datum 版本，MLflow 负责实验/artifact 查询与对比。

## 9. 参考链接

- [Valohai Introduction](https://docs.valohai.com/)
- [Pipelines](https://docs.valohai.com/pipelines/)
- [Data (versioning, datum, lineage)](https://docs.valohai.com/data/)
- [Execution Reuse and Caching (Reuse nodes)](https://docs.valohai.com/pipelines/reuse-nodes)
- [Executions](https://docs.valohai.com/executions)
- [Migrate your ML jobs](https://docs.valohai.com/migrate-your-ml-jobs/)
