# Canvas DAG 技术选型与方案对比

本文档用于**区分七种 Canvas DAG 实现方案**，支持技术选型与对比判断。七种方案在「执行粒度」「结果保留策略」「断点恢复与 Time Travel」等方面差异显著，可根据业务重点（与现有调度统一、云原生 YAML、实验可复现与 Time Travel、代码化编排与内置恢复/人工暂停、统一 MLOps 与 Artifact 版本化、数据/实验/模型管理平台 + MLflow、YAML 配置驱动 + 每步 checkpoint + Reuse nodes）做取舍。**内部已定由 MLflow 管理模型离线实验中间产物 artifact**，选型时可与各方案衔接。详细竞品能力见 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md)、[竞品调研_ZenML](./竞品调研_ZenML.md)、[竞品调研_DagsHub](./竞品调研_DagsHub.md) 与 [竞品调研_Valohai](./竞品调研_Valohai.md)。

---

## 1. 目的与范围

- **目标**：为「模型训练画布」的 DAG 执行与状态管理选定或参考一种技术路线，使画布节点（Pipeline Meta、数据源、WOE Fit、Feature Selection、WOE Merge、Model Tune、Model Train、CheckPoint 择优、Model Inference、Calibrate）的编排、执行、恢复与回溯能力有清晰对应。
- **范围**：方案 A（常规大数据调度 + Node 粒度 + 仅最新结果）、方案 B（火山引擎式 Pipeline + Task DAG）、方案 C（Metaflow + Checkpoint/Time Travel）、方案 D（Prefect + Resume/cache + 人工暂停择优）、方案 E（ZenML + Step 缓存 + Artifact/Time Travel）、方案 F（DagsHub + 数据/实验/模型管理 + MLflow 集成）、方案 G（Valohai + YAML Pipeline + 每步 checkpoint + Reuse nodes）。不涉及具体实现代码或 risk_model_on_ray / MODEL_PIPELINE.md 的修改；画布节点与 Python Step 的映射以 [Task-Canvas-Config.md](../design/Task-Canvas-Config.md) 的 SOP 与 §2.4 DAG 为准。
- **与 MLflow 的衔接**：**内部 Team 已确定将模型离线实验的中间产物（artifact）用 MLflow 管理**。选型时与方案 A 结合时，画布节点产出可同时写入 S3 并登记至 MLflow，便于按 Run/节点追溯；若选方案 C/D/E，可评估与 MLflow 的并存或替代关系。详见 [系统架构说明 §4.2.3](../architecture/系统架构说明.md)。

---

## 2. 方案简述

### 2.1 方案 A：常规调度 + Node 粒度 + 仅最新结果

- **定位**：类似 Task-Instance 的大数据调度平台；DAG 有向无环，**画布 Node** 为执行单元；每个 Node **仅保留当前 Run 的最新结果**，不提供多版本 / 历史 Run 的按步回溯。
- **迭代方式**：若某节点（如 Feature Selection）有问题，用户**手动触发上游节点执行**，再**从该节点起序贯重跑**（如重跑 Feature Selection 再检查）；无「从历史某步 Time Travel 恢复」。
- **SavePoint/CheckPoint**：可在应用层定义为「可恢复点」或「择优暂停点」，但底层仍为「只记最新」；Revert 依赖上游重新执行产出新结果后再跑下游。
- **与 SOP 的关系**：SOP 各节点一一对应调度 Node；SavePoint/CheckPoint 仅作为业务语义，底层不保留多版本 Artifact。

### 2.2 方案 B：火山引擎式 Pipeline + Task DAG

- **定位**：参考 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)。用 **Pipeline**（YAML：PipelineTemplate）串起 **Task**；**taskTemplates** 定义可复用节点模板（镜像、入口、资源），**tasks** 描述 DAG（dependencies）。Task 内高自由度（脚本、镜像、分布式 Worker 等），Pipeline 只负责编排与依赖。
- **与 SOP 的关系**：画布节点可映射为 Volc 的 Task；WOE Fit、Feature Selection、Model Tune 等各为一个或多个 Task；DAG 在 Pipeline 层用 dependencies 表达。断点恢复、Run 版本管理需在 Task 或平台层自行设计；无内置 Time Travel / 多版本 Artifact 语义。

### 2.3 方案 C：Metaflow + Checkpoint/Time Travel

- **定位**：参考 [竞品调研_Metaflow](./竞品调研_Metaflow.md)。代码即 DAG（FlowSpec + @step）；**Flow → Run → Step → Task → DataArtifact** 层级清晰；每步结束自动持久化 Artifact，通过 Client API 可访问**任意历史 Run 的任意已完成 Step** 的产出（Time Travel）。**Resume** 复用所有成功步、仅重跑失败步及之后；**@checkpoint** 支持步内周期持久化与跨 Run 续跑（load_policy：fresh / eager / None）。
- **与 SOP 的关系**：SOP 节点映射为 Metaflow 的 Step；SavePoint 对应「该 Step 完成即持久化、可被 Resume 或 Client API 使用」；CheckPoint（含择优）对应「人工/策略确认或选定某 Run/Step 的 artifact 再继续」。多路 Tune 可用 foreach 多分支；独立推理画布可对应独立 Flow 或从某 Run 的 artifact 启动 predict。详见竞品调研中的「基于 Metaflow 实现内部模型探索 SOP 的实践」章节。

### 2.4 方案 D：Prefect + Resume/cache + 人工暂停择优

- **定位**：参考 [竞品调研_Prefect](./竞品调研_Prefect.md)。纯 Python 编排（`@flow` / `@task`），无 DSL/YAML；支持 if/else、循环、动态 task、child flows、task mapping。**Resume** 从暂停或失败的 flow run 继续；**Task 级 cache**（`cache_key_fn` / `cache_policy` / `cache_expiration`）在开启 result persistence 后生效，等价于「从最近成功点恢复、仅重跑失败及之后」。**pause_flow_run(wait_for_input=...)** / **suspend_flow_run** 支持在择优节点暂停，Resume 时提交类型校验的输入（如 Pydantic/RunInput）。Artifact 支持 key 多版本与 lineage，但**无**「按 run_id + step 取历史 data」的一等 API；大对象需 Result 或外部存储 + 应用层版本与 lineage。与 Ray / risk_model_on_ray 集成方式与方案 A 类似：在 `@task` 内调用现有脚本，路径与存储自管。
- **与 SOP 的关系**：SavePoint/CheckPoint、多路 Tune 合并择优、Model Inference 独立画布均可支持；Time Travel 若需「按 Run/Step 访问历史 data」需自建存储与元数据及查询/加载接口。详见 [竞品调研_Prefect § 基于 Prefect 实现内部模型探索 SOP 的要点](./竞品调研_Prefect.md#8-基于-prefect-实现内部模型探索-sop-的要点)。

### 2.5 方案 E：ZenML + Step 缓存 + Artifact/Time Travel

- **定位**：参考 [竞品调研_ZenML](./竞品调研_ZenML.md)。纯 Python 编排（`@pipeline` / `@step`），Step 为执行单元，依赖由数据流或 `after` 形成 DAG。**Artifact** 自动版本化、lineage 完整，**Client API** 可按 run/step 或 artifact 名/版本加载历史产出（**Time Travel 与方案 C 类似**）。**Step 级缓存**（code/inputs/parameters）默认开启，重跑 Pipeline 时复用已成功 Step 输出，等价于「从最近成功点恢复、仅重跑失败及之后」；无原生「Resume 失败 Run」API。**Pipeline Snapshot** 为不可变快照（DAG+代码+配置），从 Dashboard/API/CLI 触发运行（运行 Snapshot 为 ZenML Pro 功能）；**Deployment** 提供长驻 HTTP 服务（OSS 可用）。人工暂停/择优无一等能力，需自建（如择优后触发下游 Pipeline 并传入所选 Artifact）。与 Ray / risk_model_on_ray 集成：在 `@step` 内调用现有脚本，路径与存储自管。
- **与 SOP 的关系**：SavePoint 对应 Step 产出持久化与复用；CheckPoint（择优）需用外部选择 + 触发下游或传 Artifact 版本实现。多路 Tune、独立推理画布可用多 Pipeline 或 Step 分支 + Client 加载历史 Artifact 实现。详见 [竞品调研_ZenML § 基于 ZenML 实现内部模型探索 SOP 的要点](./竞品调研_ZenML.md#8-基于-zenml-实现内部模型探索-sop-的要点)。

### 2.6 方案 F：DagsHub + 数据/实验/模型管理 + MLflow 集成

- **定位**：参考 [竞品调研_DagsHub](./竞品调研_DagsHub.md)。DagsHub 为**数据与实验管理平台**，基于 Git、DVC、**MLflow**、Label Studio 等开源格式；**不提供计算资源**，依赖用户自有计算（本地/云/边缘）。每 Repository 自动提供 MLflow Tracking Server（如 `https://dagshub.com/<user>/<repo>.mlflow`），用于实验与 artifact 登记；数据集版本化用 DVC/DagsHub Storage。编排与 DAG 执行由外部系统（如方案 A 画布 + Ray）承担，DagsHub 负责数据版本、实验追踪、模型注册与协作。
- **与 SOP 的关系**：可与**方案 A + MLflow** 组合：画布与 Ray 执行不变，中间产物与模型由 MLflow 管理，DagsHub 提供托管 MLflow + 数据集版本 + 协作界面；或作为「实验/模型管理 + 数据版本」的独立选型，与任意编排方案并存。SavePoint/CheckPoint、多路 Tune、独立推理画布仍由编排侧实现；Time Travel 依赖 MLflow 按 run/artifact 查询。详见 [竞品调研_DagsHub](./竞品调研_DagsHub.md)。

### 2.7 方案 G：Valohai + YAML Pipeline + 每步 checkpoint + Reuse nodes

- **定位**：参考 [竞品调研_Valohai](./竞品调研_Valohai.md)。**配置驱动**（valohai.yaml），无侵入式 SDK；Pipeline 由 **Nodes**（Execution / Task / Deployment）与 **Edges**（Output→Input、Parameters 等）组成 DAG。**每步为独立 Execution**，形成自然 checkpoint，失败时从上一成功步重跑；**Execution Reuse**（step 名、镜像、inputs、参数、代码一致时复用）与 **Reuse nodes**（手动指定历史 execution 作为某 node 输入）实现断点恢复与跳过已成功步。数据通过 **datum://** 不可变版本化，lineage 完整，可按 execution/step 查询历史产出（Time Travel）。支持 **Pause for human approval** 与条件分支，适合择优。可与 MLflow/SageMaker 等并存。与 Ray / risk_model_on_ray 集成：将脚本封装为 Valohai step（Docker + command），与方案 B 类似。
- **与 SOP 的关系**：SavePoint 对应「某 step 产出 datum，Reuse nodes 可复用」；CheckPoint（择优）对应人审节点或条件分支。多路 Tune 可用 Task 节点；独立推理画布为独立 Pipeline，输入为某次 execution 的 model datum。详见 [竞品调研_Valohai § 基于 Valohai 实现内部模型探索 SOP 的要点](./竞品调研_Valohai.md#8-基于-valohai-实现内部模型探索-sop-的要点)。

---

## 3. 对比表

| 维度 | 方案 A（常规调度 + 仅最新） | 方案 B（火山引擎式） | 方案 C（Metaflow） | 方案 D（Prefect） | 方案 E（ZenML） | 方案 F（DagsHub） | 方案 G（Valohai） |
|------|----------------------------|----------------------|--------------------|-------------------|-----------------|-------------------|-------------------|
| **执行粒度** | 画布 Node | Task（高自由度） | Step / Task | Task / Flow | Step / Pipeline | 外部 DAG + 平台管理数据/实验/模型 | Pipeline Node（Execution/Task/Deployment） |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate + taskTemplates / tasks | 代码 FlowSpec + @step，self.next | 纯 Python @flow/@task，无 YAML/DSL | 纯 Python @pipeline/@step | 无内置编排；与 Git/DVC/MLflow 集成，编排由外部承担 | **YAML valohai.yaml**；无侵入 SDK |
| **结果保留策略** | 每 Node 仅当前 Run 最新结果 | 需自建或依托 Task 产出存储 | 每 Run 每 Step 的 Artifact 持久化，多版本 | Result 持久化 + 可选 Artifact（key 多版本）；大对象需自建存储 | 每 Run 每 Step Artifact 持久化，多版本 | MLflow Artifact + DVC/Storage；每 repo 托管 MLflow Server | **datum:// 版本化、lineage**；每 execution 产出可追溯 |
| **断点恢复 / 重跑** | 手动触发上游再序贯重跑下游 | 需在 Task 或平台层自设计 | Resume 复用成功步，仅重跑失败步及之后 | Resume + task cache：从最近成功点恢复，仅重跑失败及之后 | 无原生 Resume API；重跑 Pipeline + Step 缓存复用，效果等价 | 依赖外部编排；MLflow 记录 run/artifact 便于复现 | **每步独立 Execution + Reuse nodes**：从上一成功步继续或复用历史 execution |
| **Time Travel** | 无 | 无内置 | 内置：Client API 访问任意 Run/Step/Task 的 data；@checkpoint 步内 + load_policy 跨 Run | 部分：Artifact 有 key 的版本/lineage，无按 run/step 取历史 data 的一等 API | 内置：Client 按 run/step/artifact 名版本取 data | 通过 MLflow 按 run/artifact 查询；数据版本用 DVC | 按 execution/step 与 datum 查询历史产出；lineage 完整 |
| **与现有 Ray / risk_model_on_ray 集成** | 易对齐现有调度与 Run 模型 | 需将现有 Step 封装为 Task 镜像/脚本 | 需将现有 Step 封装为 Metaflow Step 或子流程，或通过 artifact 传路径调用 Ray | 与 A 类似：Task 内调 Ray/脚本，自管路径与存储 | Step 内调 Ray/脚本，自管路径与存储 | 计算在自有环境；DagsHub/MLflow 做实验与 artifact 登记，与方案 A 组合自然 | 需将脚本封装为 Valohai step（镜像+command）；可与 MLflow 等并存 |
| **学习与运维成本** | 低（与现有调度一致） | 中高（YAML、K8s/Argo 概念） | 中（Python 为主，概念清晰；@checkpoint 为扩展） | 中低：Python 为主，需 Prefect Server/Cloud 或自建 | 中：Python + Stack + Server；Snapshot 运行等为 Pro 能力 | 低：Git/DVC/MLflow 生态；无计算侧运维，适合与 A+MLflow 并存 | 中：YAML + Valohai 平台；支持多云/K8s/Slurm |


---

## 4. 选型建议

- **若优先与现有调度体系统一、实现简单、不强求多版本与 Time Travel**：可选用**方案 A**；SavePoint/CheckPoint 作为业务语义，Revert 通过「重新执行上游 + 序贯重跑」实现。
- **若优先云原生、YAML 声明式、已有 K8s/Argo 能力**：可参考**方案 B**；画布节点映射为 Task，DAG 用 dependencies 表达；断点恢复与版本管理需在 Task 或平台层补充设计。
- **若优先实验可复现、从任意步恢复、多版本 Artifact 与 Time Travel**：可选用或借鉴**方案 C**；SOP 与 Metaflow Step 的对应关系及多路 Tune、择优、独立推理画布的实现思路见 [竞品调研_Metaflow § 基于 Metaflow 实现内部模型探索 SOP 的实践](./竞品调研_Metaflow.md#7-基于-metaflow-实现内部模型探索-sop-的实践)。
- **若优先代码化编排、内置断点恢复与人工暂停/择优、且可不强求 Time Travel 一等 API**：可考虑**方案 D（Prefect）**；SavePoint/CheckPoint、多路 Tune 择优、独立推理画布均可实现，详见 [竞品调研_Prefect](./竞品调研_Prefect.md)。
- **若优先统一 MLOps 框架、Artifact 版本化与 Time Travel、Step 缓存加速迭代、且可接受重跑 Pipeline 实现「恢复」语义**：可考虑**方案 E（ZenML）**；SavePoint/多版本 Artifact/按 run-step 取历史 data 均支持，择优需自建；Snapshot/Deployment 可支撑按需触发与在线推理。详见 [竞品调研_ZenML](./竞品调研_ZenML.md)。
- **若已有「方案 A 画布 + MLflow 管理中间产物」的决策、且希望实验/数据/模型管理有统一托管与协作界面**：可考虑**方案 F（DagsHub）** 作为数据与实验管理层；DagsHub 提供托管 MLflow、数据集版本（DVC）、模型注册与协作，编排与执行仍由现有画布 + Ray 承担。详见 [竞品调研_DagsHub](./竞品调研_DagsHub.md)。
- **若优先 YAML 配置驱动、无侵入业务代码、每步自然 checkpoint + Reuse nodes 断点恢复、datum 版本化与 lineage、且可接受将脚本封装为 step（镜像+command）**：可考虑**方案 G（Valohai）**；SavePoint/CheckPoint、人审择优、多路 Tune（Task 节点）、独立推理 Pipeline 均支持；可与 MLflow 等并存。详见 [竞品调研_Valohai](./竞品调研_Valohai.md)。

选型时建议结合团队技术栈、对「仅最新结果」与「多版本/Time Travel」的需求强度、**与 MLflow 管理中间产物的既定决策**、以及与现有 Ray/训练脚本的集成方式综合判断。六篇竞品调研文档提供更细的能力说明与 SOP 映射细节。

---

## 5. 引用

- [Task-Canvas-Config.md §2.4 DAG 实例 Demo](../design/Task-Canvas-Config.md#24-dag-实例-demo用户调研与产品手册)
- [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)
- [竞品调研_Metaflow](./竞品调研_Metaflow.md)
- [竞品调研_Prefect](./竞品调研_Prefect.md)
- [竞品调研_ZenML](./竞品调研_ZenML.md)
- [竞品调研_DagsHub](./竞品调研_DagsHub.md)
- [竞品调研_Valohai](./竞品调研_Valohai.md)
