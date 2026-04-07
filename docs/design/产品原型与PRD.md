# 模型训练平台 MVP — 分层产品需求文档（PRD）

**文档状态**: v2 — 对齐 GitPages 原型
**设计框架**: Garrett 五层模型（Strategy → Scope → Structure → Skeleton → Surface）
**交互验收基准**: `[docs/prototype/model-experiment-web](../prototype/model-experiment-web/README.md)` 仓库实现（[GitPages](https://cedric-chan.github.io/ModelExperiment/)）；[Figma: Model Experiment](https://www.figma.com/design/C15E8rRER0qSqYsQZgdVif/Model-Experiment) 为设计迁移原本与风格参考
**术语权威来源**: `[docs/GLOSSARY.md](../GLOSSARY.md)`；界面 ↔ 领域映射见 `[Naming-And-Responsibilities.md](./Naming-And-Responsibilities.md)`；矛盾追溯见 `[_FIGMA_SYNC_REVIEW.md](./_FIGMA_SYNC_REVIEW.md)`

---

## Impact Triage

**需求摘要**: 构建离线模型训练平台 MVP，将 Spark+YAML 编排替换为 Ray 统一执行 + Web 画布配置，覆盖 Experiment 管理、Run 执行、Build 注册全流程。
**生命周期阶段**: Zero-to-One
**产品类型**: 功能型（平台类）产品 — 工作流驱动（实验配置、执行、产物管理）

**设计层级影响**:

- 起源层: **战略层 Strategy**（新平台，需定义用户角色、North Star、核心价值主张）
- 写入集: Strategy → Scope → Structure → Skeleton → Surface（全层，Zero-to-One 要求）
- 稳定层: 无（首次构建）

**技术层级影响**: Data（领域实体全新设计）、Business Logic（状态机、权限、调度）、API（全新 endpoint）、Application（Web Console）、Observability（事件追踪）

---

## Layer 1 — 战略层 Strategy

### 问题陈述

现有系统基于**6-Phase Spark 管道 + YAML 拖拽**编排模型训练。核心问题：


| 问题          | 影响                                                         | 数据/证据                                        |
| ----------- | ---------------------------------------------------------- | -------------------------------------------- |
| **配置门槛极高**  | 纯 Python 方式约 480 行代码、60+ 个需手动填写的参数（路径、阈值、超参），初阶算法工程师无法独立完成 | 详见[附录 A: Before/After 对比](#附录-a-用户操作对比与平台价值) |
| **执行环境异构**  | Spark 与本地混合执行，稳定性不足，排错成本高                                  | —                                            |
| **无统一对比能力** | 多模型/多参数对比依赖手动收集指标 + Excel/Notebook 整理，步骤约 12+，易出错          | —                                            |
| **知识锁在代码中** | 历史训练配置与效果数据分散在各个 Python 脚本和 S3 路径中，无法被平台沉淀和复用              | —                                            |


### North Star 指标

**North Star = 周活跃 Experiment 数 × Run 成功率**

分解树：

```
North Star: 周活跃 Experiment 数 × Run 成功率
  ├── Acquisition: 新注册 Model 数 / 周
  ├── Activation: 首次 Trigger Run 的 Experiment 数 / 周
  ├── Efficiency: 实验配置耗时（Target: < 5 分钟 vs 现状 2-4 小时）
  └── Quality: Run SUCCESS 率（Target: > 95%，依赖 Ray 稳定剥离）
```

### 目标用户


| 角色                     | Job-to-be-Done | 当前痛点                                     | 平台期望                             |
| ---------------------- | -------------- | ---------------------------------------- | -------------------------------- |
| **初阶算法工程师**            | 按业务需求完成模型训练和评估 | 不熟悉 Python Pipeline 的 60+ 参数和路径规划，依赖老手指导 | 通过画布表单配置，确认默认值后一键提交              |
| **资深算法工程师**            | 多模型多参数对比寻优     | 需手写 4+ 份配置脚本、手动收集指标对比                    | Experiment 画布 + Run History 统一对比 |
| **Team Owner / Admin** | 管理团队模型资产和训练资源  | 无统一模型注册和版本管理；计算资源分配不透明                   | Model Registry + 资源配额 + 审计日志     |


---

## Layer 2 — 范围层 Scope

### In Scope（MVP）


| 编号   | 能力                                  | 说明                                                                                                                                                                                                         |
| ---- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | **Experiment 画布配置**                 | 左侧 DAG + 右侧固定配置面板；6 个 Experiment Component 线性排列（Data Source → WOE fit → WOE Transform → Feature selection → LGBM tune & train → Model prediction）；节点配置规范见 [Task-Canvas-Config.md](./Task-Canvas-Config.md) |
| S-02 | **Run 生命周期管理**                      | Trigger Run（Use Cache + Run Notes）→ 状态机 QUEUING → RUNNING → CHECKING → SUCCESS / FAILED / KILLED；Ray 集群执行                                                                                                  |
| S-03 | **CheckPoint 人工卡点**                 | DAG 节点 `isCheckPoint` 属性；触发后 Run 进入 CHECKING，用户可 Continue 或 Kill                                                                                                                                           |
| S-04 | **SavePoint 中间产物缓存**                | WOE fit / WOE Transform 节点支持 SavePoint，配合 Use Cache 开关实现增量执行                                                                                                                                               |
| S-05 | **配置版本与 Run 历史**                    | Experiment 保留当前/最新画布配置；每次 Run 携带 Config Snapshot；支持 History Run 只读查看和 Rollback Config                                                                                                                      |
| S-06 | **Model / ModelVersion / Build 注册** | Run SUCCESS → ModelArtifact 归档 S3 → 用户主动 Review → 注册 Build 到 ModelVersion                                                                                                                                  |
| S-07 | **Experiment 列表管理**                 | 列表筛选（Name / Model / Owner）、Create / Edit / Copy / Alert / Delete；展开行 Run 子表                                                                                                                                |
| S-08 | **节点级执行结果查看**                       | Last Run Tab 展示节点执行信息、Artifact Info、Ray Log；WOE fit / WOE Transform / Feature selection 节点各有专属结果报告弹窗                                                                                                       |
| S-09 | **实验告警配置**                          | 每个 Experiment 可配置 Alert 规则（RUN_SUCCESS / RUN_FAILED / RUN_OVER_THRESHOLD），含接收人、告警组、紧急电话                                                                                                                    |
| S-10 | **AI Prompt 探索实验**（P1）              | AI 生成多组 Experiment 配置 → 用户 Review → 批量提交 → 统一对比面板（详见 Scope AI/LLM Justification）                                                                                                                           |


### Out of Scope（及原因）


| 排除项            | 原因                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas 画布拖拽编排  | MVP 使用固定线性 DAG；拖拽编排复杂度高，待 MVP 验证核心价值后再考虑                                                                                                    |
| YAML 编辑器模式     | 与画布表单互斥，增加认知负担；用户调研显示初阶工程师偏好表单                                                                                                              |
| 复杂容错重试配置       | MVP 仅支持全量重跑 + Use Cache；细粒度重试策略依赖后端成熟度                                                                                                      |
| 多物理机分布图监控      | Ray Dashboard 已提供基础监控；平台层不重复建设                                                                                                              |
| 9+ 节点扩展画布（SOP） | 含 WOE Selected Feature、CheckPoint（择优）、Calibrate 等；本期 Deferred，详见 [Pipeline-Steps-and-Canvas-Nodes.md](./Pipeline-Steps-and-Canvas-Nodes.md) |
| 训练过程中实时调参      | 需 Ray Tune 深度集成，复杂度高，后续迭代                                                                                                                   |


### 非功能性需求


| 需求             | 指标                                  |
| -------------- | ----------------------------------- |
| 画布配置页加载        | P95 ≤ 2s（含 DAG 渲染和节点配置面板）           |
| Trigger Run 响应 | 前端校验 + 后端创建 Run ≤ 3s                |
| Run 列表刷新       | P95 ≤ 500ms（含状态轮询）                  |
| Run 状态同步延迟     | Ray 回报 → Web 展示 ≤ 10s               |
| 并发 Run 支持      | 单 Experiment 允许多 Run 并行（MVP 不实现串行锁） |
| S3 Artifact 归档 | Run SUCCESS 后 ≤ 60s 完成归档            |


### 数据模型

#### 核心实体定义


| 概念       | 英文                   | 定义                                                                                                                                | 关系                                          |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **模型**   | Model                | 逻辑模型实体，代表一个业务场景下的预测/分类任务（如"欺诈检测模型"）。包含元信息：名称、任务类型（classification / regression）、框架偏好、Owner、所属 biz_team。**不绑定具体训练产物，仅作顶层逻辑归类与注册入口** | 1 Model → N ModelVersion                    |
| **模型版本** | ModelVersion         | Model 的一次重大迭代（架构变更、特征集重构、数据源切换），以 `v1 / v2` 标签区分。同一 Model 下可并行存在多个 Version                                                        | 1 ModelVersion → N Build                    |
| **构建产物** | Build                | SUCCESS Run 产出的模型快照，经用户主动 Review 后注册。引用 ModelArtifact 的 S3 路径，冻结指标快照与配置快照。注册后不可修改                                                 | 1 Build ← 1 Run                             |
| **模型实验** | Experiment (EXP)     | **MVP 核心**。绑定已注册 Model 的训练编排单元，保留当前/最新画布配置。任务级状态 DRAFT / ENABLED / DISABLED                                                       | 1 Model → N Experiment；1 Experiment → N Run |
| **实验执行** | Run                  | Experiment 的一次实际执行，以 Run ID 标识。创建时携带 Config Snapshot，中间产物与画布配置均绑定 Run ID                                                          | 1 Run → 1 ModelArtifact；0..1 Build 引用       |
| **模型产物** | ModelArtifact        | Run SUCCESS 后归档至 S3 的全部文件集合。S3 路径：`s3://{bucket}/model-training/{exp_id}/{run_id}/`                                               | 1 Artifact ↔ 1 Run                          |
| **实验物料** | Experiment Component | 画布节点实例，基于 Component Template（物料模板）。每个 Component 有 Config Tab（参数表单）和 Last Run Tab（执行结果）                                            | 1 Experiment → N Component                  |
| **物料模板** | Component Template   | 画布节点类型定义，描述步骤的配置 schema。MVP 提供 6 种模板                                                                                              | 1 Template → N Component                    |
| **探索会话** | ExplorationSession   | （P1）通过 AI Prompt 批量生成多个 Experiment 的对比探索容器                                                                                        | 1 Session → N Experiment                    |
| **实验模板** | Experiment Template  | 预设的实验流程模板，包含可复用的 DAG 与节点配置                                                                                                        | 1 Template → N Experiment                   |


> **Trial 辨析**：Ray Tune 在一次 Run 内部自动发起的超参搜索迭代（由 `n_trials` 控制），属引擎行为，不对应平台独立实体。

#### 实体关系图

```mermaid
erDiagram
    Model ||--o{ ModelVersion : "1:N 版本迭代"
    ModelVersion ||--o{ Build : "1:N 构建注册"
    Build ||--|| Run : "1:1 产出来源"
    Model ||--o{ Experiment : "绑定"
    Experiment ||--o{ Run : "1:N 触发执行"
    Run ||--|| ModelArtifact : "1:1 产出归档"
    Experiment ||--o{ ExperimentComponent : "1:N 画布节点"
    ComponentTemplate ||--o{ ExperimentComponent : "1:N 实例化"
```



#### 实体层级关系

```
Model（逻辑模型，顶层注册入口）
├── ModelVersion v1（重大迭代：架构 / 特征集 / 数据源变更）
│   ├── Build #1 ← Run #101 (SUCCESS) → ModelArtifact @ S3
│   └── Build #2 ← Run #205 (SUCCESS) → ModelArtifact @ S3
└── ModelVersion v2
    └── Build #1 ← Run #310 (SUCCESS) → ModelArtifact @ S3

Model → Experiment（绑定已注册 Model，继承 name / region）
├── Experiment A（XGBoost 画布）
│   ├── Run #101 (SUCCESS) → ModelArtifact
│   ├── Run #102 (RUNNING)
│   └── Run #103 (FAILED)
└── Experiment B（LightGBM 画布）
    └── Run #201 (SUCCESS) → ModelArtifact → 注册为 Build
```

#### 关键辨析


| 易混淆点                          | 辨析                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Build vs ModelArtifact**    | ModelArtifact 是 Run 原始产出（SUCCESS 后自动归档 S3）；Build 是用户主动 Review 后注册到 ModelVersion 下的动作结果。非所有 Artifact 都会成为 Build |
| **Experiment vs Run**         | Experiment 是编排单元（保留画布配置）；Run 是一次执行（Config Snapshot + 产物均绑定 Run ID）                                             |
| **Run vs Trial**              | Run 是平台层面的完整执行；Trial 是 Ray Tune 引擎层面的超参组合尝试。一个 Run 内含 `n_trials` 次 Trial，对用户透明                                 |
| **Model vs ModelVersion**     | Model 是抽象逻辑归类（不随训练变化）；ModelVersion 是重大迭代升级。日常迭代在同一 Version 下产生新 Build                                          |
| **CHECKING vs CheckPoint 节点** | Run 级 CHECKING 是 `isCheckPoint` 节点成功完成后的人工卡点状态；CheckPoint（择优）是 DAG 内"汇总多路分支结果并择优"的流程语义节点。二者并存但含义不同             |


#### Run 状态机

```mermaid
stateDiagram-v2
    [*] --> QUEUING: Trigger Run
    QUEUING --> RUNNING: 调度器分配资源
    RUNNING --> CHECKING: isCheckPoint 节点完成
    RUNNING --> SUCCESS: 全部节点完成
    RUNNING --> FAILED: 节点执行失败
    CHECKING --> RUNNING: 用户 Continue
    CHECKING --> KILLED: 用户 Kill
    QUEUING --> KILLED: 用户 Kill
    RUNNING --> KILLED: 用户 Kill
```



> 界面排队态以 `QUEUING` 为主展示；数据模型中 `WAITING` 与 `QUEUING` 同位兼容。

### API 变更（MVP 新建）


| 方法     | 路径                                  | 说明                                   |
| ------ | ----------------------------------- | ------------------------------------ |
| POST   | `/api/v1/experiments`               | 创建 Experiment（绑定 Model）              |
| GET    | `/api/v1/experiments`               | 列表查询（支持 Name / Model / Owner 筛选）     |
| PUT    | `/api/v1/experiments/{id}`          | 更新画布配置 / 元信息                         |
| DELETE | `/api/v1/experiments/{id}`          | 删除 Experiment                        |
| POST   | `/api/v1/experiments/{id}/runs`     | Trigger Run（含 Use Cache + Run Notes） |
| GET    | `/api/v1/experiments/{id}/runs`     | Run 列表（含状态）                          |
| POST   | `/api/v1/runs/{id}/continue`        | CHECKING 状态下 Continue                |
| POST   | `/api/v1/runs/{id}/kill`            | Kill 运行中 Run                         |
| GET    | `/api/v1/runs/{id}/config-snapshot` | 获取 Run 的配置快照                         |
| POST   | `/api/v1/experiments/{id}/rollback` | Rollback Config（用指定 Run 的快照覆盖当前配置）   |
| GET    | `/api/v1/experiments/{id}/alerts`   | 获取实验告警配置                             |
| PUT    | `/api/v1/experiments/{id}/alerts`   | 更新实验告警配置                             |
| POST   | `/api/v1/builds`                    | 注册 Build（引用 Run 的 ModelArtifact）     |
| GET    | `/api/v1/models`                    | Model 列表                             |
| GET    | `/api/v1/models/{id}/versions`      | ModelVersion 列表                      |


完整 API 规范见 `[docs/api/openapi.yaml](../api/openapi.yaml)`。

### AI / LLM Justification — ExplorationSession AI Prompt 探索实验（S-10）

> S-10 为 P1 优先级（MVP 后首期迭代）。以下论证需在实施前完成验证。

**1. 使用了什么 AI 能力？**


| 能力                       | 用途                                                           | 占比  |
| ------------------------ | ------------------------------------------------------------ | --- |
| **Content Generation**   | 根据用户 Prompt + Hive Schema + 目标列，生成 N 组结构化 Experiment 配置 JSON | 70% |
| **Reasoning / Decision** | 综合数据源特征、框架特性和超参搜索空间约束，推导合理的参数组合                              | 30% |


**2. 为什么需要动态判断？**

用户 Prompt 的意图空间极大——"对比 XGB 与 LGBM 各窄宽两套搜索空间"和"帮我生成 3 个不同特性的树模型配置并尝试更大范围的学习率空间（0.001 - 0.2）"是完全不同的配置生成需求。Hive 表的 Schema（列数、类型分布）和目标列的语义也影响合理的参数范围。这个组合空间无法用有限的模板穷举。

**3. 为什么 AI 优于替代方案？**


| 替代方案           | 评估   | 不足                                                      |
| -------------- | ---- | ------------------------------------------------------- |
| **固定模板库**      | 成本最低 | 仅覆盖预定义场景（如"分类 + LightGBM"），无法响应用户自由描述的意图（如"尝试更大范围的学习率"） |
| **参数化模板 + 表单** | 中等成本 | 用户仍需逐个填写 4+ 份表单，无法从一句话生成多组配置                            |


AI 的精确加成点：将**一句自然语言意图**转化为**多组结构化 Experiment 配置**，同时确保参数组合的合理性（不生成非法框架或越界参数）。

**4. 失败模式**


| 失败场景                                  | 处理                                       |
| ------------------------------------- | ---------------------------------------- |
| 生成的 JSON 不符合 Experiment Config Schema | 前端 Schema 校验拦截，不合法的卡片不展示                 |
| 参数组合不合理（如 learning_rate = 10）         | 前端表单校验 + 用户 Review 卡片（human-in-the-loop） |
| LLM 幻觉填入不支持的框架                        | 框架枚举白名单校验                                |
| LLM 服务不可用                             | 降级为手动创建 Experiment（主流程不阻塞）               |


**错误成本评估**：低。生成的是 Experiment **草稿配置**，需用户 Review + 编辑后才提交执行。错误推荐仅增加 Review 时间，不导致资源浪费。

**5. 成本与延迟边界**


| 指标        | 上限                                               | 理由                       |
| --------- | ------------------------------------------------ | ------------------------ |
| 单次生成延迟    | P95 ≤ 15s                                        | 用户可接受"生成中"等待；超过 15s 体验劣化 |
| 单次生成成本    | ≤ $0.10                                          | 日均 ~50 次生成 → 月成本 ≤ $150  |
| LLM Token | ≤ 8K input（Schema + Prompt）+ 4K output（N 组 JSON） | 控制成本                     |


---

## Layer 3 — 结构层 Structure

### User Stories


| 编号    | Story                                                                                        | 优先级 |
| ----- | -------------------------------------------------------------------------------------------- | --- |
| US-01 | 作为**初阶算法工程师**，我希望通过画布表单配置训练参数并一键提交，以便不需要手写 Python 脚本                                         | P0  |
| US-02 | 作为**算法工程师**，我希望 Trigger Run 时可选择 Use Cache，以便仅重跑配置变更的节点，节省时间                                 | P0  |
| US-03 | 作为**算法工程师**，我希望在 Run History 中查看历史配置快照并一键回滚，以便复现过去的训练结果                                      | P0  |
| US-04 | 作为**算法工程师**，我希望在 isCheckPoint 节点完成后暂停 Run 并 Review 中间结果，以便决定是否继续                             | P0  |
| US-05 | 作为**算法工程师**，我希望将 SUCCESS Run 的 Artifact 注册为 Build，以便纳入模型版本管理                                 | P0  |
| US-06 | 作为**资深算法工程师**，我希望通过 Experiment 列表管理多个训练配置变体并对比 Run 结果                                        | P0  |
| US-07 | 作为**算法工程师**，我希望在 Last Run Tab 查看 WOE Binning 结果、Feature Report 和 Selection Report，以便评估中间步骤质量 | P0  |
| US-08 | 作为**算法工程师**，我希望为 Experiment 配置运行告警规则，以便在 Run 成功/失败/超阈值时及时收到通知                                | P0  |
| US-09 | 作为**资深算法工程师**，我希望用一句 Prompt 生成多组 Experiment 配置并统一对比，以便快速探索最优参数                               | P1  |
| US-10 | 作为 **Team Owner**，我希望查看团队下所有 Model 和 Experiment 的执行状态，以便掌握资源使用情况                             | P0  |


### 页面结构

```
Web Console（侧栏 Aimos Model）
├── Experiments 模块（注：原型侧栏当前标签为 "Pipelines"，属遗留 bug，正式版应改为 "Experiments"）
│   ├── Experiment 列表页 — 主入口，展示 Exp ID / Name / Model+Version / Owner 等
│   │   ├── 展开行: Run 子表（Run ID / Status / Notes / Trigger Time / Start / Finish / Duration / Actions）
│   │   └── 操作: Create Exp. / Edit / Copy / Alert / Delete
│   ├── 画布配置页 — Experiment 的 DAG 配置与执行入口
│   │   ├── 左侧: 点阵 DAG（缩放、小地图 Overview）
│   │   ├── 右侧: 固定配置面板（384px）— Config / Last Run 双 Tab
│   │   ├── 顶栏: Back / Experiment Name / Region / Current Config 徽章
│   │   │   ├── Edit (pencil) / Run History / ENV / Settings / Action
│   │   │   └── Action → Trigger Run / Continue / Kill
│   │   ├── History Run 模式（只读 + Rollback Config + Back to Config）
│   │   └── Run View 模式（只读 + Continue / Kill + Rollback Config）
│   └── Ray Log 全屏视图 — Back / 标题 / Log ID / 日志内容
├── Model Registry 模块
│   ├── 模型大盘 — Model 列表与概览
│   └── 版本详情页 — ModelVersion + Build 注册记录
├── AI Prompt 探索实验页 — P1，批量生成 Experiment 配置（US-09）
│   ├── 左侧: AI Prompt 构建区（数据源选择 + Prompt 输入）
│   └── 右侧: Experiment 卡片 Review 区（Edit / Remove / Lock / Submit All）
└── Experiment 对比大盘 — P1，平行坐标图 + 指标排序表
```

**页面角色与流转**:


| 页面            | 主要角色    | 核心功能                      | 入口                        | 出口                                         |
| ------------- | ------- | ------------------------- | ------------------------- | ------------------------------------------ |
| Experiment 列表 | 所有角色    | 查看/筛选/管理 Experiment 与 Run | 侧栏导航                      | Edit → 画布；View → Run View                  |
| 画布配置页         | 算法工程师   | 配置 DAG 节点参数、Trigger Run   | 列表 Edit / Create          | Trigger Run → Run 子表；Back → 列表             |
| Run View      | 算法工程师   | 查看运行中/历史 Run 的 DAG 状态     | 列表 View / Run History 下拉  | Continue/Kill → 回到列表；Register Build → 版本详情 |
| Ray Log 视图    | 算法工程师   | 查看节点执行日志                  | Last Run Tab → Ray Log 链接 | Back → 画布                                  |
| AI Prompt 页   | 资深算法工程师 | 批量生成 Experiment 配置        | 列表入口（P1）                  | Submit All → 多个 Run 创建                     |
| 对比大盘          | 资深算法工程师 | 横向对比多 Run 指标              | Experiment 详情（P1）         | Register Build → 版本详情                      |


---

## Layer 4 — 框架层 Skeleton

### 交互设计原则（全局约束）

1. **弹窗 Esc 关闭**: 所有模态弹窗必须支持 Esc 键关闭（效果同点击遮罩或 Cancel）。例外：仅阻断型弹窗（强制阅读、合规确认）可不响应 Esc，须在本文档单独标注。
2. **验收基准**: 以 `model-experiment-web` 仓库实现（[GitPages](https://cedric-chan.github.io/ModelExperiment/)）为准；Figma 为设计风格参考，逻辑以最新实现为准。

### Experiment 列表页


| 编号    | 功能需求                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | **列表工具栏** — 页面顶部 — 标题 "Experiments list (Showing N of N)" + "Owned by me" Toggle + "Refresh" 按钮 + "Create Exp." Primary 按钮 → Create Exp. 点击打开创建弹窗                                                                                                                                                                                                                                                                                            |
| FR-02 | **筛选条** — 工具栏下方 — 标题 "Filters"；Experiment Name / Model / Owner 三字段（Placeholder: "Search experiment name…" / "Search model name…" / "Search owner…"）+ Reset 按钮 → 宽屏（≥ lg）横向紧凑排布，窄屏纵向堆叠；有任一筛选值时显示 Reset                                                                                                                                                                                                                                        |
| FR-03 | **主表** — Data table with inline row actions — 列: Exp ID / Exp Name（含 "N runs" 副标题）/ Model（含 Version 角标 + Region 徽章）/ Owner（头像）/ Biz Team / Description（hover tooltip）/ Update Time / Actions（Edit / Copy / Alert / Delete）→ 行可展开为 Run 子表；Delete 按钮仅 Owner/Admin 可用                                                                                                                                                                           |
| FR-04 | **Run 子表** — 展开行内嵌 Data table — 列: **Run ID** / **Run Status**（含 CHECKING 状态徽章）/ **Notes** / **Trigger Time** / **Start Time** / **Finish Time** / **Duration** / **Actions** → View（所有状态）/ Continue（仅 CHECKING）/ Kill（PopConfirm "Kill this run instance?" — 进行中态）/ More 下拉（Artifact / View Log）。空态: "No runs found for this experiment."                                                                                                   |
| FR-05 | **分页** — 表格底部 — 显示 "{start}–{end} of {total} experiments"；Per page 下拉: 5 / 10 / 20 / 50；上一页/下一页按钮 + 页码                                                                                                                                                                                                                                                                                                                                       |
| FR-06 | **创建弹窗** — Modal（Esc 可关闭）— 标题 "Create Model Experiment" — Create Exp. 触发 → 表单: Experiment Name / Model @ Version（级联选择，搜索 "Search model…"，hover 展示 versions，支持 "latest" 标签）/ Model Level（sub / mega，编辑态只读）/ Template（可选下拉，当前用户可见实验名）/ Owner（多选搜索）/ Biz Team / Description → 提交 "To Canvas" 进入画布配置页                                                                                                                                            |
| FR-07 | **编辑弹窗** — 同 FR-06 布局但标题为 "Edit Model Experiment" → Model / Model Level 只读 → 提交 "Save Changes"                                                                                                                                                                                                                                                                                                                                               |
| FR-08 | **复制弹窗** — 同 FR-06 布局但标题为 "Copy Model Experiment"，预填源实验数据 → 提交 "Create Copy" → 进入新实验画布                                                                                                                                                                                                                                                                                                                                                       |
| FR-09 | **Alert 弹窗** — Modal（Esc 可关闭）— 标题 "Alert List"，副标题 "Exp {id}" — 行 Alert 按钮触发 → 告警事件表: Alert Event / Event Definition / Event Type / Config / Active Toggle；事件类型: RUN_SUCCESS / RUN_FAILED / RUN_OVER_THRESHOLD；RUN_OVER_THRESHOLD 行在 Edit 模式下展示 Rolling Window / Threshold / Alert Interval（tooltip 说明）→ 底部: Alert Receiver（邮箱）/ Alert Group（下拉: ML / Risk / Ops 等）/ Urgent Call（Toggle）/ Alert to DoD Group（Toggle）→ Edit / Save 模式切换；Close |


### 画布配置页


| 编号    | 功能需求                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-10 | **DAG 画布** — 页面左侧（全高）— 点阵 DAG，支持缩放 + 小地图 Overview + 右键拖平移 → 6 个 Experiment Component 线性排列（无 Start/End 占位），节点间连线表示数据流。底部控件: 缩放 −/%/+ / Fit to screen。底部提示: "Right-drag to pan · Scroll to zoom · Click a pipeline node to set run start"                                                                                                                                                                                                                                                                                                                                    |
| FR-11 | **配置面板** — 页面右侧固定面板（宽度 384px）— 点击 DAG 节点触发 → 面板 header 展示节点图标 + label + sublabel；双 Tab: **Config** / **Last Run**。空态（未选中节点）: "Click a pipeline node…"。详见 [§ 节点配置面板](#节点配置面板config-tab) 和 [§ Last Run Tab](#last-run-tab)                                                                                                                                                                                                                                                                                                                                                   |
| FR-12 | **顶栏导航（Current Config 模式）** — 页面顶部 sticky — 左侧: Back 按钮 / Experiment Name / Region 徽章 / **Edit** 笔形图标（触发 Edit Experiment Meta 弹窗）→ 中部: **Current Config** 徽章 → 右侧: **Run History** 下拉 / **ENV** 按钮 / **Settings** 按钮 / **Action** 下拉（Trigger Run / Continue / Kill）                                                                                                                                                                                                                                                                                                        |
| FR-13 | **Trigger Run 流程** — Action 下拉 → "Trigger Run"（副文案 "Execute full pipeline from start"）→ 先执行 `runFrontendCheck` 校验 → 校验失败: 画布区展示 **CheckResultPanel**（"Validation failed" + 校验项列表: DataSource exists / LGBM tune & train exists / Model Prediction exists / All nodes connected / No cyclic dependencies）→ 校验通过后执行 `validateRunPath`（BayesOpt trial count / locked nodes）→ 路径校验失败: **RunErrorNotification** 覆盖在对应 DAG 节点上 → 全部通过: 打开 **Trigger Run** Modal → **Use Cache** Switch（副标签 "Recommended"）+ **Run Notes** 文本框 + "Run" Submit 按钮 → 提交后新 Run 以 QUEUING 状态出现在 Run 子表 |
| FR-14 | **Edit Experiment Meta** — 顶栏 Edit 笔形图标触发 → Modal 标题 "Edit Experiment Meta"，副文案 "Experiment & Model are read-only" → 只读字段: Experiment Name / Model / Model Level → 可编辑: Owner（多选）/ Description → Cancel / Save → Save 更新 Experiment 实体                                                                                                                                                                                                                                                                                                                                     |
| FR-15 | **Pipeline ENV** — 顶栏 ENV 按钮触发 → Modal 标题 "Pipeline ENV" → 三列表格: Parameter / Description / Value；支持行级增删（Add row）→ Cancel / Save                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| FR-16 | **Settings** — 顶栏 Settings 按钮触发 → Modal 标题 "Settings"，副文案 "Defaults · Queue Priority · Scheduler" → 字段: **default_cpu**（数值 + tooltip）/ **default_memory**（数值 + tooltip）/ **default_image**（文本 + tooltip）/ **Queue Priority**（下拉: Normal / Important / Critical）/ **Scheduler**（Radio: ONCE / Cron；ONCE 时显示 "Manual trigger only — no automatic schedule"；Cron 时展示 Cron Expression 输入框 + 英文预览）→ Cancel / Save；Run View / History Run 模式下 Settings 为只读                                                                                                                       |
| FR-17 | **Run History 下拉** — 顶栏 Run History 按钮触发（仅 Current Config 模式）→ 下拉面板: header "Run History" + "{n} runs total" → 表格: Run ID + Version 标签（含 "Latest" 徽章）/ Status 徽章（SUCCESS / FAILED / PARTIAL / RUNNING）/ Start / End → 底部: "Click a run to view its pipeline execution — read-only" → 选择某 Run 切换到 History Run 或 Run View 模式                                                                                                                                                                                                                                                 |
| FR-18 | **History Run 模式** — 选择历史 Run → 顶栏切换为 **History Run** 徽章 + Run ID + Pipeline Status → 横幅显示 Run 元数据 + 状态图例（Success / Running / Failed / Cache Skipped / Pending）+ **READ-ONLY** 标签 → DAG + 配置面板变为只读 → 顶栏显示 **Rollback Config** + **Back to Config** 按钮                                                                                                                                                                                                                                                                                                                      |
| FR-19 | **Rollback Config** — History Run 或 Run View 模式下点击 "Rollback Config" → PopConfirm 确认 → 用该 Run 的 Canvas Snapshot（DAG 拓扑 + nodePatches + propOverrides + Pipeline ENV）覆盖当前 Current Config → 退出只读模式                                                                                                                                                                                                                                                                                                                                                                           |
| FR-20 | **Run View 模式** — 列表 View 或 Run History 选择运行中实例 → 顶栏切换为 **Run View** 徽章 + Run ID + Instance Status → 横幅显示 Run 元数据 + 状态图例 + **READ-ONLY** 标签 → DAG 节点显示执行状态（成功/失败/运行中/缓存跳过/排队）→ Run 为 CHECKING 时 Action 含 Continue；运行中态含 Kill                                                                                                                                                                                                                                                                                                                                               |
| FR-21 | **节点路径级联绑定（Cascade Binding）** — 节点 Config Tab 中的输入路径字段支持两种模式: **(a) 上游节点输出端口绑定**（自动从 DAG 上游节点的 output path 级联）**(b) 固定路径（FixedValue）**（用户手动输入 S3/Hive 路径）。适用于: WOE fit / WOE Transform / Feature selection / LGBM tune & train / Model prediction 的 data_path、encoder_path 等输入字段                                                                                                                                                                                                                                                                                           |


### 节点配置面板（Config Tab）

每个 Experiment Component 的 Config Tab 展示节点特有的参数表单。以下为 6 种 Component Template 的关键字段摘要（完整字段定义见 [Task-Canvas-Config.md](./Task-Canvas-Config.md)）。

#### Data Source


| 字段                                   | 类型                                  | 说明                        |
| ------------------------------------ | ----------------------------------- | ------------------------- |
| source_type                          | Select: Hive / S3                   | 数据源类型                     |
| table_scheme                         | String                              | Hive 库名                   |
| table_name                           | String                              | Hive 表名                   |
| custom_filter                        | String                              | 自定义分区过滤条件                 |
| s3_path                              | String                              | S3 路径（source_type = S3 时） |
| sample_type                          | Radio: use_existing / auto_generate | 样本拆分方式                    |
| train_ratio / test_ratio / val_ratio | Number                              | 样本比例（auto_generate 时）     |
| seed                                 | Number                              | 随机种子                      |
| label_col                            | String                              | 目标列                       |
| categorical_columns                  | String[]                            | 类别型特征列                    |
| data_format                          | Select: parquet                     | 输出格式                      |
| loaded_data_path                     | String (auto)                       | 输出路径（自动生成）                |


#### WOE fit


| 字段                                                                                                  | 类型                         | 说明                             |
| --------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------ |
| data_path                                                                                           | Cascade / Fixed            | 输入数据路径（级联上游 Data Source 或固定值）  |
| woe_fit_sample_scope                                                                                | Select                     | 样本范围                           |
| woe_fit_label_column                                                                                | String                     | 标签列                            |
| n_bins                                                                                              | Number (5/10/15)           | 分箱数                            |
| woe_fit_method                                                                                      | Select: best_ks / quantile | 分箱方法                           |
| min_bin_rate                                                                                        | Number                     | 最小分箱占比                         |
| min_bin_size                                                                                        | Number                     | 最小分箱样本数                        |
| min_missing_bad_cnt                                                                                 | Number                     | 最小缺失坏样本数                       |
| woe_fit_categorical_features                                                                        | String[]                   | 类别型特征                          |
| woe_fit_exclude_columns                                                                             | String[]                   | 排除列                            |
| woe_fit_woe_missing_values                                                                          | String                     | 缺失值处理                          |
| woe_fit_woe_missing_logic                                                                           | Select                     | 缺失值逻辑                          |
| dict_nbins / dict_missing_values / dict_min_bin_rate / dict_min_bin_size / dict_min_missing_bad_cnt | JSON                       | 按特征覆盖参数（Per-feature overrides） |
| **woe_update**                                                                                      | Table + Modal              | WOE 更新规则表（见 FR-22）             |
| encoder_save_path                                                                                   | String (auto)              | Encoder 输出路径                   |
| checkpoint_after_node                                                                               | Boolean                    | 节点后暂停                          |


#### WOE Transform


| 字段                         | 类型              | 说明                                            |
| -------------------------- | --------------- | --------------------------------------------- |
| data_path                  | Cascade / Fixed | 输入数据路径                                        |
| encoder_path               | Cascade / Fixed | Encoder 路径（级联 WOE fit 输出）                     |
| woe_transform_sample_scope | Select          | 样本范围                                          |
| feature_report             | Boolean         | 是否生成 Feature Report                           |
| stability_dim              | Select          | 稳定性维度                                         |
| woe_transform_report_tabs  | Multi-select    | 报告子页签（performance / trend / stability / mono） |
| checkpoint_after_node      | Boolean         | 节点后暂停                                         |
| data_save_path             | String (auto)   | 输出数据路径                                        |


#### Feature selection


| 字段                    | 类型                                               | 说明     |
| --------------------- | ------------------------------------------------ | ------ |
| data_path             | Cascade / Fixed                                  | 输入数据路径 |
| fs_methods            | Multi-select: by_iv / by_corr / by_gini / by_psi | 特征选择方法 |
| iv_threshold          | Number                                           | IV 阈值  |
| corr_threshold        | Number                                           | 相关性阈值  |
| psi_threshold         | Number                                           | PSI 阈值 |
| exclude_cols          | String[]                                         | 排除列    |
| checkpoint_after_node | Boolean                                          | 节点后暂停  |


#### LGBM tune & train


| 字段                                               | 类型                   | 说明       |
| ------------------------------------------------ | -------------------- | -------- |
| data_path                                        | Cascade / Fixed      | 输入数据路径   |
| tune_train_exclude_cols                          | String[]             | 排除列      |
| tune_train_auxilary_cols                         | String[]             | 辅助列      |
| n_trials                                         | Number               | HPO 迭代次数 |
| cv_folds                                         | Number               | 交叉验证折数   |
| metric                                           | Select: auc / ks / … | 评价指标     |
| timeout                                          | Number               | 超时（秒）    |
| search_type                                      | Select               | 搜索策略     |
| bo_history_output                                | String (auto)        | 调参历史输出路径 |
| checkpoint_after_node                            | Boolean              | 节点后暂停    |
| num_workers / cpu_per_worker / memory_per_worker | Number               | 资源配置（高级） |


#### Model prediction


| 字段                                               | 类型              | 说明                       |
| ------------------------------------------------ | --------------- | ------------------------ |
| data_path                                        | Cascade / Fixed | 输入数据路径                   |
| model_path                                       | Cascade / Fixed | 模型路径（级联 tune & train 输出） |
| model_prediction_auxilary_cols                   | String[]        | 辅助列                      |
| predict_result_path                              | String (auto)   | 预测结果输出路径                 |
| num_workers / cpu_per_worker / memory_per_worker | Number          | 资源配置（高级）                 |


### Last Run Tab

Last Run Tab 在所有节点上共享统一的信息结构，部分节点额外提供专属结果报告入口。


| 编号    | 功能需求                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-22 | **通用 Last Run 信息** — 面板切换到 Last Run Tab 后展示: **Run ID**（monospace）/ **Status** 徽章 / **Finished Time** / **Duration** → **Artifact Info** 区域: 节点类型相关的 key-value 行（如 WOE fit: Features in / Bins created / Avg IV / Encoder path；tune & train: Best AUC / Hypers path 等）→ 折叠区 **Ray Log**: 三个链接 "Ray driver log" / "Ray worker #0" / "Task stderr"（各含 monospace logId），点击进入 Ray Log 全屏视图。无 Run 数据时显示 "No run data available" |
| FR-23 | **WOE Binning Result 弹窗**（WOE fit 节点专属）— Last Run Tab 顶部 CTA "View WOE Binning"（副文案 "Browse all feature bin results →"）→ Modal 标题 **"WOE Binning Result"** → 特征列表: Feature Name / Type / Binning Method / IV / Bins → 支持搜索 + CSV 下载（文件名 `woe_binning_result.csv`）→ 点击特征行 drill-down 进入 **"Feature Binning Detail"** 视图: Bin 表格含 WOE 列                                                                                      |
| FR-24 | **Feature Report 弹窗**（WOE Transform 节点专属）— Last Run Tab CTA "View feature report" → Modal 标题 **"Feature report (last run)"** → 四个子页签: **performance** / **trend** / **stability** / **mono** → 各页签展示分页数据表格；受 ENV 中 `feature_report` 和 `woe_transform_report_tabs` 控制                                                                                                                                                       |
| FR-25 | **Selection Report 弹窗**（Feature selection 节点专属）— Last Run Tab CTA "View selection report" → Modal 标题 **"Selection report (last run)"** → 顶部: 选择方法 + 各方法阈值横幅 → **"Final selected only"** Checkbox → 分页表格: 特征列表 + 各方法 Pass/Fail chips                                                                                                                                                                                        |
| FR-26 | **WOE Update 编辑弹窗**（WOE fit Config Tab 内）— WOE fit 配置面板中 woe_update 表格行 "Add" / "Edit" 触发 → 行内 Portal 标题 **"Set WOE update"** 或 **"Edit WOE update"** → 字段: Feature（select）/ Method（set_woe / update / update_by_cutoff）/ JSON 或 Cutoff 输入 → 前端校验 → Cancel / Save                                                                                                                                                          |
| FR-27 | **Ray Log 全屏视图** — Last Run Tab Ray Log 链接点击触发 → 全屏视图: 顶部 **Back** 按钮 / 动态标题 / monospace **Log ID** → 主体: 日志正文（monospace）                                                                                                                                                                                                                                                                                                  |


### AI Prompt 探索实验页（P1）


| 编号    | 功能需求                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-28 | **左侧 Prompt 构建区** — 页面左侧 50% — 标题 "创建一个探索实验" → 输入域 1: Hive 表下拉 + 目标列下拉（必选）→ 输入域 2: 多行文本框（Placeholder: "例如：我想对收入预测这列做评估..."）+ "Generate Tasks ✨" 按钮 → 点击触发 LLM 生成                                                 |
| FR-29 | **右侧 Review 区** — 页面右侧 50% — Card List 展示 N 张 Experiment 配置卡片 → 每卡片含框架 / Search Space 摘要 / 关键参数 → 卡片操作: Edit（弹窗打开完整表单）/ Remove / Lock → 底部 "Submit All" 按钮 → 提交后创建 ExplorationSession + N 个 Experiment + N 个 Run |


### Experiment 对比大盘（P1）


| 编号    | 功能需求                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-30 | **平行坐标图** — 页面顶部 — 展示不同 Experiment × Trial 的超参到 AUC 等目标指标分布 → 支持拖拽筛选轴范围                                                                                                    |
| FR-31 | **指标排序表** — 图下方 — 级联列表: Experiment 级折叠，展开为 Trial 详情 → 列: Experiment Name / Framework / Search Space Summary / Best Metric / Status / Logs → 行操作: Register Build（仅 SUCCESS） |


### 弹窗清单


| 弹窗                          | 触发                                                 | Esc 关闭 | 备注                                    |
| --------------------------- | -------------------------------------------------- | ------ | ------------------------------------- |
| Create Model Experiment     | 列表 Create Exp.                                     | 是      |                                       |
| Edit Model Experiment       | 列表 Copy → 编辑时                                      | 是      | 列表 Edit 直接进入画布，不经过此弹窗                 |
| Copy Model Experiment       | 列表 Copy                                            | 是      |                                       |
| Alert List                  | 列表行 Alert                                          | 是      | Edit/Save 模式                          |
| Trigger Run                 | Action → Trigger Run（校验全通过后）                       | 是      |                                       |
| Edit Experiment Meta        | 画布顶栏 Edit 笔形图标                                     | 是      |                                       |
| Pipeline ENV                | 画布顶栏 ENV                                           | 是      |                                       |
| Settings                    | 画布顶栏 Settings                                      | 是      |                                       |
| Model Artifacts             | Run 子表 More → Artifact                             | 是      | Tabs: parameters / metrics            |
| WOE Binning Result          | WOE fit Last Run → View WOE Binning                | 是      | 含 drill-down Feature Binning Detail   |
| Feature report (last run)   | WOE Transform Last Run → View feature report       | 是      | 四 sub-tabs                            |
| Selection report (last run) | Feature selection Last Run → View selection report | 是      | Final selected only checkbox          |
| Set / Edit WOE update       | WOE fit Config → woe_update 表 Add / Edit           | 是      | 行内 Portal                             |
| CheckResultPanel            | Trigger Run 校验后                                    | 是      | Validation failed / All checks passed |
| Delete 确认                   | 列表 Delete                                          | 是      | PopConfirm                            |
| Kill 确认                     | Run 子表 / 画布 Kill                                   | 是      | PopConfirm "Kill this run instance?"  |
| Rollback Config 确认          | History Run / Run View 顶栏                          | 是      | PopConfirm                            |


**已定义但未接入原型的功能（Deferred）**:


| 功能                                     | 代码状态            | 说明                                              |
| -------------------------------------- | --------------- | ----------------------------------------------- |
| Version History 弹窗                     | 组件已定义，无 UI 触发路径 | 左侧版本列表 + 右侧 JSON                                |
| Manage 下拉（Enable / Disable）            | 组件已定义，列表行未挂接    | 对应 Experiment 的 DRAFT / ENABLED / DISABLED 状态流转 |
| Run 下拉（From Current Step / From Start） | 组件已定义，画布未挂接     | 从选中节点起执行的设计意图                                   |
| Save & Publish Update                  | 组件已定义，无 UI 触发路径 | —                                               |


---

## Layer 5 — 表现层 Surface

### 技术栈

**Frontend**: Vite + React + TypeScript + Tailwind CSS + 自定义组件库
**图表**: 平行坐标图使用 ECharts 或 Plotly（P1 对比大盘）
**DAG 渲染**: React Flow（点阵背景 + 缩放 + 小地图 Overview）

### DAG 节点定义


| 节点 ID | 界面标签                  | 界面副标签                          | Component Template  |
| ----- | --------------------- | ------------------------------ | ------------------- |
| n1    | **Data Source**       | Hive · Partition · Label       | `data_source`       |
| n2    | **WOE fit**           | Encoder training · Bins        | `woe_fit`           |
| n3    | **WOE Transform**     | Apply encoder · WOE features   | `woe_transform`     |
| n4    | **Feature selection** | IV · Corr · Selection report   | `feature_selection` |
| n5    | **LGBM tune & train** | LightGBM · HPO · Train         | `tune_train`        |
| n6    | **Model prediction**  | Batch scoring · predict_result | `infer`             |


### 设计语言

复用 Tailwind CSS 自定义主题。以下为 Model Experiment 模块的专属视觉约定：


| 元素                                         | 处理                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Current Config 徽章**                      | 绿色 Tag，标示当前处于可编辑配置模式                                                                                                            |
| **History Run 徽章**                         | 黄色 Tag，标示只读历史模式（含 Run ID + Pipeline Status）                                                                                     |
| **Run View 徽章**                            | 蓝色 Tag，标示 Run 实例查看模式（含 Run ID + Instance Status）                                                                                |
| **Run 状态色**（对齐 [GLOSSARY](../GLOSSARY.md)） | QUEUING = `tag-orange`；RUNNING = `tag-blue`；CHECKING = `tag-yellow`；SUCCESS = `tag-green`；FAILED = `tag-red`；KILLED = `tag-red` |
| **DAG 节点状态**                               | 未执行 = 默认边框；运行中 = 蓝色脉冲边框；成功 = 绿色实心边框；失败 = 红色实心边框；缓存跳过 = 灰色虚线边框；校验错误 = 红色虚线边框 + 错误 overlay                                        |
| **配置面板宽度**                                 | 384px（较早期 256px 增宽 50%，降低信息密度）                                                                                                  |
| **isCheckPoint 节点标识**                      | 节点右上角 ⏸ 图标                                                                                                                      |
| **SavePoint 节点标识**                         | 节点右上角 💾 图标                                                                                                                     |
| **Run View / History Run 横幅**              | 包含 Run 元数据 + 状态图例（Success / Running / Failed / Cache Skipped / Pending）+ READ-ONLY 标签                                           |


### 交互原则

- **Loading**: 画布加载用 Skeleton；Run 状态轮询用 Spinner
- **Error**: 校验失败用 CheckResultPanel 浮层 + 节点级 RunErrorNotification overlay；API 错误用 Toast
- **Empty State**: 空列表 "No model experiments found" + "Try adjusting your filters…" + Create Exp. CTA；未选中节点 "Click a pipeline node…"；无 Run 数据 "No run data available"
- **Toast**: Experiment 创建/更新成功、列表刷新、Run Kill/Continue 结果、模块未接入等

---

## 成功指标


| 指标               | 基线                 | 目标                         | 度量方式                                           |
| ---------------- | ------------------ | -------------------------- | ---------------------------------------------- |
| 实验配置耗时           | ~2-4 小时（Python 手写） | < 5 分钟                     | `experiment_run_triggered` 事件中 config_duration |
| Run SUCCESS 率    | 未知（需先采集）           | > 95%                      | `run_completed` 事件 status 分布                   |
| 周活跃 Experiment 数 | 0（新平台）             | ≥ 20（上线 3 个月后）             | 周内至少有 1 次 Trigger Run 的 Experiment 数           |
| Build 注册转化率      | —                  | ≥ 30%（SUCCESS Run → Build） | `build_registered` / `run_completed(SUCCESS)`  |


---

## 事件追踪


| 事件                         | 触发条件                                               | 属性                                                           | 回答的问题                   |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | ----------------------- |
| `experiment_created`       | 创建 Experiment                                      | exp_id, model_id, framework, template_used, created_by       | 创建活跃度、模板使用率             |
| `experiment_run_triggered` | Trigger Run 提交                                     | exp_id, run_id, use_cache, has_notes, config_duration_ms     | 缓存使用率、配置耗时              |
| `run_status_changed`       | Run 状态变更                                           | run_id, from_status, to_status, duration_ms                  | 状态流转分布、执行耗时             |
| `run_checkpoint_action`    | CHECKING 状态下 Continue/Kill                         | run_id, action, checkpoint_node_id                           | CheckPoint 使用频率、通过率     |
| `config_rollback`          | Rollback Config 确认                                 | exp_id, source_run_id                                        | 配置回滚频率                  |
| `build_registered`         | 注册 Build                                           | build_id, run_id, model_version_id, registered_by            | Build 转化率、版本分布          |
| `alert_config_changed`     | 更新 Alert 配置                                        | exp_id, events_enabled, receiver_count                       | 告警使用率                   |
| `node_report_viewed`       | 打开 WOE Binning / Feature Report / Selection Report | exp_id, run_id, node_type, report_type                       | 报告查看频率、哪些节点产出最常被 Review |
| `ai_prompt_generated`      | AI Prompt 生成完成（P1）                                 | session_id, prompt_length, experiments_generated, latency_ms | AI 生成频率                 |
| `ai_experiment_reviewed`   | AI 卡片 Edit/Remove/Lock（P1）                         | exp_id, action, field_changed                                | 用户对 AI 推荐的修改率           |


---

## 完整生命周期（时序图）

```mermaid
sequenceDiagram
    participant User as 用户
    participant Web as Web UI
    participant BE as 平台后端
    participant Ray as Ray 集群
    participant S3 as S3 存储

    rect rgb(240, 255, 240)
    Note over User,S3: Phase 1 — 创建 Experiment 与配置
    User->>Web: Create Exp.（选择 Model + 填写元信息）
    Web->>BE: POST /experiments
    BE-->>Web: 创建成功 → 进入画布
    User->>Web: 配置 DAG 节点参数（Config Tab）
    User->>Web: Settings 配置资源/队列/调度
    User->>Web: Action → Trigger Run（Use Cache + Notes）
    Web->>Web: runFrontendCheck + validateRunPath 校验
    Web->>BE: POST /experiments/{id}/runs
    BE->>Ray: 投递 Run（QUEUING）
    BE-->>Web: Run 创建成功
    end

    rect rgb(240, 248, 255)
    Note over User,S3: Phase 2 — 执行与 CheckPoint
    Ray->>Ray: 执行 Experiment Component 节点
    Ray-->>BE: 状态更新 RUNNING
    Ray->>Ray: isCheckPoint 节点完成
    Ray-->>BE: 状态更新 CHECKING
    BE-->>Web: 展示 CHECKING 状态
    User->>Web: Last Run Tab → View WOE Binning / Feature Report
    User->>Web: Review 中间结果 → Continue
    Web->>BE: POST /runs/{id}/continue
    BE->>Ray: 继续执行
    Ray->>S3: 归档 ModelArtifact
    Ray-->>BE: 状态更新 SUCCESS
    end

    rect rgb(255, 240, 245)
    Note over User,S3: Phase 3 — 产物注册
    User->>Web: 查看 SUCCESS Run → Register Build
    Web->>BE: POST /builds
    BE-->>Web: Build 注册成功
    end
```



---

## 附录 A: 用户操作对比与平台价值

### Python Pipeline 分模块流程图

以下对应 `full_training_pipeline.py` 的 7 个 Step 模块：

```mermaid
flowchart LR
    subgraph step0 [Step_0_Init]
        Init["init_ray_util()<br/>Config + RayUtil cluster"]
    end
    subgraph step1 [Step_1_WOE]
        WOEFit["woe_fit() x N 域<br/>n_bins, method, encoder_save_path"]
        WOETrans["woe_transform()<br/>training_features + test_features"]
        WOEFit --> WOETrans
    end
    subgraph step2 [Step_2_Merge]
        Merge["woe_merge_v2()<br/>data_path_dict, on, how"]
    end
    subgraph step3 [Step_3_FS]
        FS["feature_selection_v2()<br/>by_iv/corr/gini/psi/stability"]
    end
    subgraph step4 [Step_4_Tune]
        Tune["model_tune()<br/>n_trials, init_hypers, best_hypers_path"]
    end
    subgraph step5 [Step_5_Train]
        Train["model_train()<br/>best_hyper_path, best_model_path"]
    end
    subgraph step6 [Step_6_Predict]
        Predict["model_predict()<br/>sample_path, predict_result_path"]
    end
    Init --> WOEFit
    WOETrans --> Merge
    Merge --> FS
    FS --> Tune
    Tune --> Train
    Train --> Predict
```



**模块与 ray_util 对应关系**:


| 模块     | ray_util 方法            | 关键参数（需手写）                                                  |
| ------ | ---------------------- | ---------------------------------------------------------- |
| Step 0 | Config + RayUtil 构造    | fp_base, label, sample_use_col, 凭证                         |
| Step 1 | woe_fit, woe_transform | 每域: data_path, encoder_save_path, n_bins, method           |
| Step 2 | woe_merge_v2           | model_name, data_path_dict, on, how                        |
| Step 3 | feature_selection_v2   | fp_fs_input_path, fp_fs_methods, 各阈值                       |
| Step 4 | model_tune             | sample_path, feature_selection_path, n_trials, init_hypers |
| Step 5 | model_train            | best_hyper_path, best_model_path, num_workers              |
| Step 6 | model_predict          | sample_path, best_model_path, predict_result_path          |


### Before (Python) vs After (平台表单) 对比


| Python 侧（Before）            | 平台侧（After）                                             | 表单类型            |
| --------------------------- | ------------------------------------------------------ | --------------- |
| Config 凭证、fp_base、label     | 数据源: Hive 表 + 分区 + 目标列                                 | **硬表单**         |
| 各域 data_path、encoder 路径     | 平台按 Exp ID + Run ID 自动生成 S3 路径                         | **自动**          |
| woe_fit 参数（n_bins、method 等） | 特征与预处理: WOE 开关 + 默认参数                                  | **硬表单 + 软表单默认** |
| feature_selection 阈值        | FS 阈值 + stability 参数                                   | **软表单默认**       |
| model_tune 超参搜索空间           | 框架 + n_trials + Search Space                           | **硬表单 + 软表单默认** |
| num_workers、cpu、memory      | Settings: default_cpu / default_memory / default_image | **软表单默认**       |
| 串行执行 7 步、手动查日志              | 提交后 QUEUING → RUNNING，Web 查看                           | **平台自动**        |


**结论**: Python 约 **2-4 小时**（编写 + 调参 + 路径管理 + 串行等待）；平台 **< 5 分钟**。

### 多模型多参数对比：三种模式


| 模式                                         | 步骤数    | 描述                                                     |
| ------------------------------------------ | ------ | ------------------------------------------------------ |
| A. 纯 Python                                | ~12+ 步 | 手写 4 份脚本 → 分别提交 Ray → 手动收集指标 → Excel 对比                |
| B. 平台仅 Experiment（无 ExplorationSession）    | ~8 步   | 4 次重复填表 → 逐个查看指标 → 手动对比                                |
| C. 平台 + ExplorationSession（AI 批量创建 + 统一对比） | ~4 步   | 一句 Prompt → AI 生成 4 张卡片 → Review → Submit All → 统一对比面板 |


