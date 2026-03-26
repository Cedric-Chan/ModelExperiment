# 模型训练平台 MVP：产品原型与 PRD

**文档状态**: Draft
**基于模板**: Product Manager Toolkit - Standard PRD Template
**作者**: AI Product Manager

**交互说明来源**：页面流转、控件文案与状态展示以 [Figma：Model Experiment](https://www.figma.com/design/C15E8rRER0qSqYsQZgdVif/Model-Experiment) 及同源导出 [`docs/prototype/model-experiment-web`](../prototype/model-experiment-web/README.md) 为准。下文 **Experiment / Run** 为领域实体；界面可见 **Exp Id / Exp Name / Model Experiments** 等与 [`Naming-And-Responsibilities.md`](./Naming-And-Responsibilities.md) 中的「界面 ↔ 领域」映射一致。矛盾追溯见 [`_FIGMA_SYNC_REVIEW.md`](./_FIGMA_SYNC_REVIEW.md)。

---

## 1. Executive Summary (执行摘要)

**Purpose**: 定义离线模型训练平台本期 MVP 迭代的产品需求文档（PRD）及页面结构约束。

- **问题陈述**: 现有的系统编排基于复杂的 6-Phase Spark 管道与 yaml 拖拽，对于普通业务人员或初阶算法工程师而言，构建、组合多任务寻优的门槛极高，执行环境异构导致稳定性不足。
- **解决方案**: 将底层执行统一包裹为 Ray Python 脚本，并对用户侧提供 **Experiment（EXP）画布**：Experiment 绑定已注册 Model，保留当前/最新画布配置；一次执行为 **Run**（界面展示 **Run ID**，数据模型同源 **TaskInstance**），中间产物与画布配置均绑定 Run id。列表与导航以 **Model Experiments** 为主入口；在配置页通过 **Action → Trigger Run** 创建新实例，弹窗内配置 **Use Cache**（关闭即等价全量重跑）、**Run Notes**，提交后实例进入排队态 **QUEUING**。
- **业务影响**: 降低训练环境配置时间；当前导出实现中 Trigger Run 默认按**全 DAG / from start** 校验与执行；执行时分析配置是否变更、无变更部分可走缓存，便于迭代与复现。
- **核心指标 (Success Metrics)**:
  - 任务配置提单耗时缩短比例 (Target: < 5 分钟)
  - 底层失败率 (Target: < 5%，依赖 Ray 稳定剥离)

---

## 2. 核心概念定义与辨析

本节统一定义平台核心领域概念，供产品、开发、业务各方对齐理解。概念定义以 [系统架构说明 §3、§10](../architecture/系统架构说明.md) 为基准，结合本 PRD 产品视角进行补充与修正。

### 2.1 概念定义表

| 概念 | 英文 | 定义 | 与其他概念的关系 |
|------|------|------|------------------|
| **模型** | Model | 逻辑模型实体，代表一个业务场景下的预测/分类任务（如「欺诈检测模型」「信用评分模型」），包含元信息：名称、任务类型（classification / regression）、框架偏好、Owner、所属业务团队。**Model 不绑定具体训练产物，仅作顶层逻辑归类与注册入口。** | 1 Model → N ModelVersion。Model 是模型注册与版本管理的顶层入口。 |
| **模型版本** | ModelVersion | Model 的一次**重大迭代**（如架构变更、特征集重构、数据源切换），以 `v1 / v2` 标签区分。同一 Model 下可并行存在多个 Version，便于 A/B 或灰度评估。Version Tag 通常作为 Model 名称后缀（如 `fraud_detection_model_v2`）。 | 1 ModelVersion → N Build。归属于一个 Model。 |
| **构建产物** | Build | 一次 SUCCESS 的 Run 产出的模型快照，经**用户主动 Review 后注册**。Build 不复制文件，而是**引用** ModelArtifact 的 S3 路径，并冻结指标快照与配置快照。注册后不可修改。 | 1 Build ← 1 Run（产出方）；注册到 1 ModelVersion 下。 |
| **实验** | Experiment (EXP) | **（P0 本期 MVP 核心）** 绑定已注册 Model 的训练编排单元；默认继承 Model 的 name 与 region（Experiment 与 Run 不覆盖 Model 元信息）。**设计稿中任务级状态为 `DRAFT` / `ENABLED` / `DISABLED`**（实现层映射同一 Experiment 实体），用于控制是否可调度、是否允许编辑等；**另保留画布配置版本历史 `history[]`** 与 **Run History** 交互。保留**当前/最新画布配置**；列表主表展示 **Exp Id、Exp Name**，展开行为 **Run** 子表。子表每行 **View** 进入 **Run View**（DAG + 节点执行态 + 只读配置）。新建执行实例的主路径为配置页 **Action → Trigger Run**（见 §4.1）。 | 1 Model → N Experiment；1 Experiment → N Run。 |
| **运行** | Run | Experiment 的一次实际执行，以 **Run id** 标识（与 **TaskInstance.id** 同源）；创建时携带**配置快照（Config Snapshot）**，**中间产物与画布配置均绑定 Run id**；实例可展示 **bindTask**（绑定的配置版本标签）。在配置详情页调整配置后再次执行 = 新 Run id + 按最新配置从头执行（是否 Kill 在途实例由策略决定）。**界面状态机**：`QUEUING`（或 `WAITING`，与 **QUEUING** 同位语）→ `RUNNING` → 若画布上 **`isCheckPoint` 节点成功执行完毕** → **`CHECKING`**（人工 Review，可 **Continue** 回到 `RUNNING` 继续下游，或 **Kill** → `KILLED`）→ 终态 `SUCCESS` / `FAILED` / `KILLED`。同一 Experiment 下只要存在任一 Run 为 `QUEUING` / `WAITING` / `RUNNING` / `CHECKING`，**禁止再 Trigger New Run**（列表 **New Run** 与画布 **Action → Trigger Run** 共用串行锁）。列表 Run 子表二级操作：**View**、**Continue**（仅 `CHECKING`）、**Kill**（`QUEUING` / `RUNNING` / `WAITING` / `CHECKING` 等进行中态）；画布 **Run View** 的 **Action** 含 **Continue** 与 **Kill**。**区分**：Pipeline ENV **`*_checkpoint_after_node`** 为执行器侧「节点后暂停/技术 checkpoint」语义；Run 级 **`CHECKING`** 绑定 **DAG `isCheckPoint`** 的人工卡点，二者勿混读。S3 路径：`s3://{bucket}/model-training/{exp_id}/{run_id}/`。 | 1 Run ← 1 Experiment；SUCCESS 时 1:1 产出 ModelArtifact；可被 0..1 个 Build 引用。 |
| **训练数据管道** | Training Data Pipeline | 从 Hive 读数据到模型产物归档至 S3 的端到端执行流水线；由平台根据 Run 配置画布自动生成的 Python `RayUtil` 脚本在 Ray 集群上执行。**每次 Run 默认全量路径执行**；执行时分析配置是否变更，无变更部分可直接使用缓存。**Trigger Run** 弹窗通过 **Use Cache** 开关表达是否优先复用缓存（关即全量重跑）。**当前 Web 原型**（对齐合作方 [frontend_node_config_spec_latest.md](../architecture/frontend_node_config_spec_latest.md)）为 **6 节点线性画布**；扩展版 SOP（**WOE All Feature**、**WOE Selected**、**CheckPoint（择优）** 等）见 [Task-Canvas-Config.md](./Task-Canvas-Config.md) 与 [Pipeline-Steps-and-Canvas-Nodes.md](./Pipeline-Steps-and-Canvas-Nodes.md) 的 deferred 说明。**实现参考** risk_model_on_ray；配置与脚本映射见 Task-Canvas-Config 与 [Training-Data-Pipeline.md](./Training-Data-Pipeline.md)。 | 每次 Run 执行一次完整流水线；产出 ModelArtifact。 |
| **模型产物** | ModelArtifact | Run 执行 SUCCESS 后统一归档至 S3 的全部文件集合。 | 1 Artifact ↔ 1 Run；Build 注册时引用 Artifact 的 S3 路径。 |

> **Trial 辨析**：文中涉及的"Trial"指 Ray Tune 在一次 Run 执行内部自动发起的超参搜索迭代（由 `n_trials` 控制），属于底层引擎行为，不对应平台的独立实体。用户通过 Experiment 画布配置设置 `n_trials` 值即可，无需关心单次 Trial 细节。

### 2.2 实体关系图

```mermaid
erDiagram
    Model ||--o{ ModelVersion : "1:N 版本迭代"
    ModelVersion ||--o{ Build : "1:N 构建注册"
    Build ||--|| Run : "1:1 产出来源"

    Model ||--o{ Experiment : "绑定"
    Experiment ||--o{ Run : "1:N 触发执行"
    Run ||--|| ModelArtifact : "1:1 产出归档"
```

### 2.3 概念层级关系

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

### 2.4 关键辨析

| 易混淆点 | 辨析说明 |
|----------|----------|
| **Build vs ModelArtifact** | ModelArtifact 是 Run 的原始产出（SUCCESS 后自动归档到 S3）；Build 是用户主动 Review 后将 Artifact **注册** 到 ModelVersion 下的动作结果。并非所有 Artifact 都会成为 Build——只有用户认为满意的才值得注册。 |
| **Experiment vs Run** | Experiment 是绑定 Model 的训练编排单元，保留当前/最新画布配置；Run 是一次执行（Run id 标识），配置快照与中间产物均绑定 Run id。画布入口在 Experiment 层级；新建 Run 的主交互为配置页 **Action → Trigger Run**。 |
| **Run vs Trial** | Run 是平台层面的一次**完整执行**（端到端）；Trial 是 Ray Tune 引擎层面的一次**超参组合尝试**。一个 Run 内部可包含 `n_trials` 次 Trial，Trial 对用户透明、不持久化为独立实体。 |
| **Model vs ModelVersion** | Model 是抽象的逻辑归类（如"欺诈检测"这件事），不随训练变化；ModelVersion 是对同一逻辑模型的一次**重大迭代升级**。日常迭代通常在同一 Version 下产生新 Build，仅当架构或特征集发生根本变更时才新建 Version。 |
| **Experiment 与 Run 状态** | **任务级**：`DRAFT` / `ENABLED` / `DISABLED`（设计稿 TrainingTask.status）。**运行级**：`QUEUING` / `WAITING` / `RUNNING` / **`CHECKING`** / `SUCCESS` / `FAILED` / `KILLED`。**CHECKING**：**`isCheckPoint` 节点成功完成后**进入，需 **Continue** 或 **Kill**（见 Run 行状态机）。 |
| **与 Figma 设计稿（Model Experiment）的对应** | **TrainingTask** ↔ **Experiment**，**TaskInstance** ↔ **Run**；列表列 **Exp Id / Exp Name**；配置顶栏 **Current Config**、**Run History** 下拉、**History Run** / **Run View** 只读模式；**Version History** 弹窗查看 `history[]`。**Manage（Enable / Disable / Delete）** 与 **Action（Trigger Run / Continue / Kill）** 为设计约定组件（详见 [`_FIGMA_SYNC_REVIEW.md`](./_FIGMA_SYNC_REVIEW.md) 与原型挂接情况）。 |
| **Framework：LightGBM/XGBoost vs benchmark** | **LightGBM / XGBoost** 对应训练画布：原型为 **6 管道节点**（data source → WOE fit → WOE Transform → Feature selection → Tune & Train → inference），**无 Start/End 占位节点**；实验级配置在顶栏 **Edit Meta / Execute Config**、**ENV**，与 [Feature WideTable](https://github.com/Cedric-Chan/FeatureStore) 一致。扩展 9 节点叙事见 Pipeline-Steps 文档。**benchmark** 画布为 S3 数据源、model_bm、校准等；元信息仍在顶栏。创建 Experiment 时 **Template** 为可选，下拉为当前用户可见的实验名称（Copy 时预填源实验名）；**Framework** 仍由 Model 等字段约束。 |

---

## 3. 页面信息架构图 (Information Architecture)

展示了本期 MVP 的 Web 层级结构与用户流转路径：

```mermaid
flowchart TD
    subgraph Web_Console [Web 后台控制台]
        Nav["侧栏 Aimos Model<br/>Pipelines / Experiments / Model Registry"]
    end

    subgraph Module_Experiment [Model Experiments 模块]
        ExpList["Model Experiments 列表<br/>Exp Id / Exp Name / Model+Version / Owner…"]
        ExpCanvas["画布配置页 DAG + 右侧配置面板"]
        ExpRunList["展开行：Run 子表<br/>View / Kill / More"]
        RunDetail["Run View：同页画布只读<br/>DAG 节点执行态 + 顶栏实例信息"]
    end

    subgraph Module_Model [模型产物模块 Model]
        ModelList["模型大盘"]
        ModelDetail["版本与 Build 注册详情页"]
    end

    Nav --> ExpList
    Nav --> ModelList

    ExpList -->|Edit 进入| ExpCanvas
    ExpList -->|展开子表| ExpRunList
    ExpRunList -->|View| RunDetail

    ExpCanvas -->|Action 触发 Trigger Run 弹窗<br/>Use Cache + Run Notes → 新 Run| ExpRunList
    RunDetail -->|手动 Register Build| ModelDetail
```

### 交互设计原则（全局，须遵守）

以下适用于 **Model Experiment** 相关 Web 与同源 [Figma：Model-Experiment](https://www.figma.com/design/C15E8rRER0qSqYsQZgdVif/Model-Experiment)；**实现（含 [`model-experiment-web`](../prototype/model-experiment-web/README.md) 与后续生产前端）须一致落实**。

1. **弹窗与 Esc 键**  
   **所有**面向用户的**模态弹窗**（居中/侧栏对话框、全屏遮罩表单、二次确认、配置编辑浮层等）在打开且处于可关闭语义下时，**必须**支持通过键盘 **Esc** 关闭，效果与点击遮罩或「Cancel / 关闭」一致（是否丢弃未保存内容遵循该弹窗自身的产品定义）。  
   - **例外**：仅当产品明确要求「不可一键退出」的阻断型弹窗（如强制阅读、合规确认）可不响应 Esc，且须在交互稿与本 PRD 中**单独标注**。

---

## 4. 核心功能场景与页面原型说明

### 4.1 核心页面：Experiment 画布配置页

**页面定位**：**画布配置入口在 Experiment（列表项 Edit）层级**。创建流：**Create Exp.** → 表单（模型、区域、框架等）→ 进入画布。画布为 **左侧 DAG + 右侧固定配置面板**（非抽屉）；节点面板 **Tag：Config / Last Run**，Last Run 展示对应 **Run ID** 与节点级上次执行信息。**新建 Run（TaskInstance）**：顶栏 **Action → Trigger Run** → 先做 **DAG 与配置校验**，通过后打开 **Trigger Run** 弹窗：**Use Cache**（开=优先复用未变更节点缓存，关=全量重跑）、**Run Notes**（可选）、**Run** 提交；新建实例状态为 **QUEUING**。源码中另有 **Run 下拉（From Current Step / From Start）** 组件，**当前导出未挂接**；画布底部提示选中**管道节点**作为起点，体现**从选中节点起执行**的设计意图，落地以 Figma/后续迭代为准。

**顶栏（与 Feature WideTable 画布对齐）**：**Edit Meta**（笔形）：Experiment / Model 只读、Owner、Description。**ENV**：实验级全局变量表（Parameters / Description / Value，行级增删）。**Execute Config**：Resource Tier、Queue Priority、Schedule（**ONCE / Cron**）、Pipeline Input Fields；入口样式与弹窗布局与 [Feature WideTable · Execute Config](https://github.com/Cedric-Chan/FeatureStore) 一致。

**画布节点粒度（仅管道节点，无 Start/End）**：首位管道节点为 **数据源**，随后为 **WOE All Feature**（对全部特征 woe_fit → woe_transform → woe_merge，再可选 All Feature Report；Time Travel 实验 checkpoint（WOE 部分），可配置 SavePoint）、**Feature Selection + Fine Feature Report**（特征选择 + 对选中特征的 Fine Feature Report；CheckPoint 属性可开启）、**WOE Selected Feature**（对选中特征可选 woe_update → woe_transform → woe_merge；可配置 SavePoint）、**Model Tune**、**Model Train**、**CheckPoint（择优）**（**Best Select / Model Summary**：汇总多路 TUNE+Train 分支结果并识别最优，**再进入 Model Inference 为流程语义**，非单独「Continue」按钮）、**Model Inference**、**Calibrate**（本期 Pending）。节点有 **CheckPoint** 属性（**默认关闭**），Run 无 CHECKING 状态，仅 **QUEUING / RUNNING / SUCCESS / FAILED / KILLED**。画布节点类型与配置规范见 [Task-Canvas-Config.md](./Task-Canvas-Config.md) 与 [Pipeline-Steps-and-Canvas-Nodes.md](./Pipeline-Steps-and-Canvas-Nodes.md)。

- **LightGBM / XGBoost**：画布含数据源（Hive）、**WOE All Feature**、Feature Selection + Fine Feature Report、**WOE Selected Feature**、Model Tune、Model Train、**CheckPoint（择优）（Best Select / Model Summary）**、Model Inference、Calibrate（默认关闭，本期 Pending）；实验级配置见顶栏。
- **benchmark**：画布含 S3 数据源、model_bm、校准节点；实验级配置见顶栏。
- **Model Inference 独立画布**：需支持「数据源 + Model Inference」组成**最小可执行画布**，用于策略回扫、批量预测等场景（产品需求）。

**产品级说明**：**特征选择与裁切**：Feature Selection 节点只产出选择报告（如 selection_report_*.csv），不产出裁切后的数据集；训练阶段（Model Tune / Model Train）读表时按报告过滤列，仅使用选中特征。**WOE 配置**：WOE All Feature 与 WOE Selected Feature 可共用同一套 WOE 参数配置（如 n_bins、method 等），通过 scope（all / selected）与 feature_selection_path 区分；详见 [Task-Canvas-Config.md](./Task-Canvas-Config.md) §2.2.0。未配置 woe_update 时，WOE Selected Feature 的 transform+merge 在训练结果上等价于下游仅使用选中特征训练；该节点仍可执行以保留 SavePoint/sample_path 语义，详见设计文档。建模实验 SOP 与画布节点配置的完整对照见 [Task-Canvas-Config.md](./Task-Canvas-Config.md) 中的建模实验 SOP 对照表。

**Edit Meta / Execute Config**：顶栏 **Edit Meta** 中对 Owner / Description 的修改直接更新 Experiment 实体；**Execute Config** 中 Resource / Queue / Schedule / Input Fields 为实验级或执行侧配置（不落 Run 版策略以后端为准）。Experiment 保留**当前/最新画布配置**，便于历史 Run 溯源与复现。Experiment 与 Run 不覆盖 Model 元信息；仅继承 Model 的 name 与 region。

**CheckPoint / SavePoint**：平台支持 SavePoint（节点产出持久化）；CheckPoint 为节点属性、默认关闭，可用于产出存档等，**Run 无 CHECKING 状态**，仅 **QUEUING / RUNNING / SUCCESS / FAILED / KILLED**。改配置后再次执行 = 新 Run id，按**最新 Experiment 配置**执行。**SavePoint 适用节点**：WOE All Feature、WOE Selected Feature；**CheckPoint 适用节点**：Feature Selection + Fine Feature Report、CheckPoint（择优）（可选）。

**Check（校验）**：**Trigger Run** 前执行 **runFrontendCheck**（必填、DAG 连通性等）；失败时在画布区展示 **Validation failed** 浮层。

**交互说明（User Flow）**：
- **创建**：列表 **Create Exp.** → 创建弹窗 → 进入画布；配置后可通过顶栏 **Action → Trigger Run** 新建实例（或通过列表侧逻辑触发，见原型挂接说明）。
- **编辑 / 复制**：列表 **Edit** 进入画布；**Copy** 走创建弹窗并可进入新任务画布。顶栏 **Edit**（笔形）打开 **Edit Meta**；**Execute Config** 打开执行配置弹窗（与 WideTable 样式一致）。
- **历史与只读**：**Run History** 下拉切换历史运行快照 → **History Run** 横幅 + 只读画布；从列表 **View** 进入 **Run View**（ live 实例，可 **Kill**）。

#### 4.1.1 原型实现说明（`docs/prototype/model-experiment-web`）

以下为与 Figma 对齐的 **React + Vite** 原型交互约定； legacy **MODEL_TRAINING.html** 若与本文冲突，以本仓库 **model-experiment-web** 为准。

**全局与品牌**：侧栏品牌 **Aimos Model**；主列表标题 **Model Experiments**。

**列表页**：筛选条、**Owned by me**、**Refresh**、**Create Exp.**；主表列 **Exp Id / Exp Name / Model（含 modelVersion 角标）/ Region / Owner / Biz Team / Description / Update Time / Actions（Edit / Copy / Alert / Delete）**。展开行展示 **Run** 子表：**Run ID、Run Status（含 QUEUING）、Notes、Trigger Time、View / Kill / More（Artifact、View Log）**。任务级 **DRAFT/ENABLED/DISABLED** 在数据模型中存在；**Manage（Enable/Disable）** 组件在源码中已定义，**当前表格行未挂接**，以 Figma 为准补齐。

**领域映射（设计稿 ↔ 产品）**：

| 界面 / 设计稿（Model Experiment） | 领域实体（本 PRD / 架构） |
|----------------------------------|---------------------------|
| TrainingTask、Exp Id / Exp Name | Experiment |
| TaskInstance、Run ID | Run |
| Task status：DRAFT / ENABLED / DISABLED | Experiment 任务级生命周期 |
| Instance status：QUEUING … | Run 排队与执行态 |
| history[]、Version History、Run History | 配置版本与运行快照溯源 |
| bindTask | Run 与配置版本标签的绑定展示 |
| Trigger Run / 列表 Trigger（意图） | 创建新 Run |
| Use Cache 开关 | 是否优先复用未变更节点缓存（关=全量） |

**配置页（画布）**：
- 布局：左侧 **点阵 DAG**（缩放、小地图、右键拖平移），右侧 **固定配置面板**（宽度约 384px，较早期 256px 增宽 50% 以降低信息密度）。
- 顶栏：Back、任务名、Region、**Current Config** / **Run View** / **History Run** 徽章；右侧 **Run History** 下拉 + **Execute Config** + **Action**（**Trigger Run**；Run View 下 **Kill** 可用）。
- **Trigger Run** 弹窗：**Use Cache**、**Run Notes**、**Run** 提交。
- 节点链与 §4.1 一致；DAG **无 Start/End**；**Execute Config** 含 **Schedule：ONCE / Cron**（Cron 时填写表达式）及 **Pipeline Input Fields**。

**弹窗**：**Artifact**（Mock 指标/参数）、**Version History**（左侧版本列表 + 右侧 JSON）、创建/编辑/复制实验表单。

**实现差异脚注**：列表行内 **Trigger**、`Manage` 下拉、独立 **Check** 按钮等若在源码中未挂接，以 Figma 为验收准绳；详见 [`_FIGMA_SYNC_REVIEW.md`](./_FIGMA_SYNC_REVIEW.md)。

### 4.2 核心创新：Experiment (AI Prompt 向导页)

**页面定位**：用于批量发起、启发式生成多个带有不同 Search Space 和基础设置的 Training Task。
**UI/UX 布局 (分为左右分屏布局)**：

#### 左侧面板：AI Prompt 构建区
- **标题**：“创建一个探索实验”
- **输入域 1 (基础必选项)**：选择基础的数据集 (Hive 表) 和 最终的目标列 (Target Label)。*(限制大模型胡乱猜测范围)*
- **输入域 2 (Prompt 对话框)**：
  - **Placeholder**: "例如：我想对收入预测这列做评估，麻烦帮我生成 3 个不同特性的树模型配置，并尝试更大范围的学习率空间（0.001 - 0.2）。"
  - **组件**：多行文本框 + 「Generate Tasks (✨)」按钮。

#### 右侧面板：AI 推荐的任务清单评审区 (Review Area)
- 当用户点击生成后，右侧会以卡片列表形式 (Card List) 展现 AI 推导出的 1 到 N 个 `Training Task` 草稿配置。
- **卡片内容说明**：
  - 每个卡片代表一个独立的、填好参数的 Training Task（包含自动选择的框架如 XGB、指定的 search space）。
  - 卡片支持「编辑 (Edit)」、「删除 (Remove)」、「锁定 (Lock)」三个动作。
  - 点击编辑可直接弹窗打开 `4.1` 中的完整表单进行核对修改。
- **底部操作**：
  - 「全部提交 (Submit All Tasks)」按钮。点击后，所有罗列在右侧的卡片会正式被转化为独立的 Training Task 派发给调度引擎，Experiment 记录生成。

### 4.3 核心页面：Experiment 详情对比大盘

**页面定位**：实验运行后的 Metrics 横向对比。
**页面组件**：
- **平行坐标图 (Parallel Coordinates Plot)**：用于一览不同 Trial 轮数下（例如 3 个 task x 30 trials = 90 条折线）不同超参到最终 AUC 目标的分布情况。
- **实验任务数据表格**：
  - 级联列表：Task 级别折叠，展开后为该任务下的 `Trial` 列表跑测详情（由 Ray 提供数据回来）。
  - 列包含：`Task Name`, `Framework`, `Search Space Summary`, `Best Metric`, `Status`, `Logs`。

### 4.4 Experiment 数据模型与生命周期

本节补充 Experiment 模块的数据模型、约束规则与端到端生命周期，作为 §4.2 / §4.3 UI 设计的底层支撑。**任务级状态**（DRAFT/ENABLED/DISABLED）与 **配置历史**（`history[]`）以设计稿为准；领域层仍可将 Experiment 视为「配置与 Run 集合」的聚合根。

#### 实体定义

| 字段 | 类型 | 说明 |
|------|------|------|
| experiment_id | string (PK) | 实验唯一标识 |
| name | string | 实验名称（用户自定义或由 AI 根据 Prompt 自动推荐） |
| description | text | 实验目的描述（可选，用户手动补充） |
| prompt_text | text | 用户输入的原始 AI Prompt 文本，完整留存用于溯源与复现 |
| hive_table | string | 锁定的数据源 Hive 表名（创建时指定，旗下所有 Task 共享） |
| partition_filter | string (nullable) | 锁定的分区条件（可选） |
| target_column | string | 锁定的目标列（创建时指定，旗下所有 Task 共享） |
| owner | string | 创建人 |
| create_time | datetime | 创建时间 |
| update_time | datetime | 更新时间 |

**关联外键**：TrainingTask 表新增可空字段 `experiment_id`（FK → Experiment）。独立创建的 Task 该字段为 `null`；由 Experiment 生成的 Task 该字段指向所属 Experiment。

#### 数据约束与业务规则

| 约束项 | 说明 |
|--------|------|
| **数据基线锁定** | Experiment 创建时锁定 `hive_table` + `partition_filter` + `target_column`，旗下所有 Task 共享同一数据基线，确保对比公平性。Task 表单中对应字段显示为**只读（Disabled）**。 |
| **Task 差异化维度** | 各 Task 之间允许差异的维度包括：引擎框架（XGBoost / LightGBM）、超参搜索空间（`search_space`）、特征选择算法组合、WOE 开关、`n_trials`、评价指标（`metric`）。 |
| **Experiment 内 Task 绑定** | 由 Experiment 生成的 Task 与该 Experiment 绑定，生命周期跟随 Experiment。不支持将 Experiment 内的 Task 拆出独立使用，也不支持将已有独立 Task 挂载到 Experiment 下。 |
| **Submit All 原子性** | 「Submit All」操作要求一次性将所有卡片对应的 TrainingTask 持久化并触发执行。不支持部分提交。 |
| **Build 注册入口** | Experiment 详情页的对比大盘中，用户可针对任意 SUCCESS 的 TaskInstance 直接发起 Register Build 操作，流程与独立 Task 的 Build 注册一致。 |

#### 完整生命周期（时序图）

```mermaid
sequenceDiagram
    participant User as 用户
    participant Web as Web UI
    participant AI as AI Service
    participant BE as 平台后端
    participant Ray as Ray 集群
    participant S3 as S3 存储

    rect rgb(240, 255, 240)
    Note over User,S3: Phase 1 — 创建实验与 AI 生成
    User->>Web: 选择 Hive 表 + 分区条件 + 目标列
    User->>Web: 输入 Prompt 描述实验意图
    Web->>AI: Prompt + Hive Schema + 目标列
    AI-->>Web: 返回 N 组 Task 配置 JSON
    Web-->>User: 展示 N 张 Task 卡片
    end

    rect rgb(255, 252, 240)
    Note over User,S3: Phase 2 — Review 与提交
    User->>Web: Review / Edit / Remove 卡片
    User->>Web: 点击 Submit All
    Web->>BE: 创建 Experiment 记录 + N 个 TrainingTask
    BE->>BE: 为每个 Task 生成 Python RayUtil 脚本
    BE->>Ray: 投递 N 个 TaskInstance（QUEUING）
    BE-->>Web: 创建 Run（QUEUING）
    end

    rect rgb(240, 248, 255)
    Note over User,S3: Phase 3 — 并行执行与产出
    Ray->>Ray: 并行执行 N 个 TaskInstance
    Note right of Ray: 每个 Instance 内部<br/>执行 n_trials 次 Trial
    Ray->>S3: 归档 ModelArtifact（model + metrics + logs）
    Ray-->>BE: 回报 Instance 状态（SUCCESS / FAILED）
    BE-->>Web: 更新 Instance 状态
    BE->>BE: 全部 Instance 终态
    end

    rect rgb(255, 240, 245)
    Note over User,S3: Phase 4 — 对比选优与注册
    User->>Web: 打开 Experiment 详情页
    Web-->>User: 平行坐标图 + 指标排序表
    User->>Web: 选定最优 Instance → Register Build
    Web->>BE: 注册 Build（选择 Model + Version，引用 Artifact S3 路径）
    BE-->>Web: Build 注册成功
    end
```

---

## 5. Technical Feasibility & MVP Scope 约束

- **Out of Scope (本期不实现)**:
  - Canvas 画布拖拽编排。
  - YAML 编辑器模式。
  - 复杂的底层容错重试配置与多物理机分布图监控。
- **AI 接口对接要求**:
  - Web UI 需要将 Prompt 连同 Schema 传入大模型 API，期望返回固定的 JSON List（格式遵循 TrainingTask Schema）。
  - 表单需要做好前置 Schema 校验，防止大模型幻觉填入不支持的框架或非法数据字段。

---

## 6. 用户操作说明与平台价值对比

本章以项目内 **Python 基线脚本** [samples/full_training_pipeline.py](../samples/full_training_pipeline.py) 为参照，说明「无平台时需手写的完整训练流程」与「有平台后通过画布/Experiment 操作」的差异，便于产品与研发对齐平台价值。

### 6.1 Python Pipeline 分模块流程图

以下流程图对应 `full_training_pipeline.py` 的 7 个 Step 模块，每个节点标注对应的 `ray_util.*()` 方法及关键参数，便于理解纯 Python 方式下需要编排的步骤。

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

**模块与 ray_util 对应关系**：

| 模块 | ray_util 方法 | 关键参数（需手写/配置） |
|------|----------------|-------------------------|
| Step 0 | 无（Config + RayUtil 构造） | fp_base, label, sample_use_col, 凭证 |
| Step 1 | woe_fit, woe_transform | 每域: data_path, encoder_save_path, n_bins, method, categorical_features, exclude |
| Step 2 | woe_merge_v2 | model_name, data_path_dict, on, how, data_save_path |
| Step 3 | feature_selection_v2 | fp_fs_input_path, fp_fs_methods, 各阈值, by_stability 参数 |
| Step 4 | model_tune | sample_path, feature_selection_path, n_trails, init_hypers, 各输出路径 |
| Step 5 | model_train | best_hyper_path, best_model_path, num_workers 等 |
| Step 6 | model_predict | sample_path, best_model_path, predict_result_path, auxilary_cols |

纯 Python 方式下约 **480 行代码**、**60+ 个需手动填写的参数**，且需自行规划 S3 路径与串行等待。画布节点与 Python Step 的对应关系（含合并节点：WOE All Feature = fit+transform+merge 全部特征，WOE Selected Feature = 选中特征 update+transform+merge）见 [Task-Canvas-Config.md](./Task-Canvas-Config.md) §2.1、§2.2。

### 6.2 Before (Python) vs After (平台表单) 上下映射对比

下图将「纯 Python 手工编排」与「平台表单配置」逐模块上下对齐，展示平台如何用**硬表单（用户必填）**、**软表单（可改默认）**和**自动填充**减少操作量。画布共 10 节点，与本节 Before/After 映射的对应关系见 [Task-Canvas-Config.md](./Task-Canvas-Config.md)。

```mermaid
flowchart TB
    subgraph Before [Before: 纯 Python]
        B0["Step0 手写 Config + RayUtil<br/>约 20 行, 凭证/路径/label"]
        B1["Step1 循环 N 域 woe_fit/transform<br/>约 80 行, 路径/encoder/参数"]
        B2["Step2 woe_merge_v2 路径字典<br/>约 30 行"]
        B3["Step3 feature_selection_v2<br/>约 25 行, 阈值/lambda_grid"]
        B4["Step4 model_tune init_hypers<br/>约 40 行, 搜索空间/路径"]
        B5["Step5 model_train best_hyper_path<br/>约 25 行"]
        B6["Step6 model_predict<br/>约 15 行"]
        B0 --> B1 --> B2 --> B3 --> B4 --> B5 --> B6
    end

    subgraph After [After: 平台表单]
        A1["数据源: Hive 表 + 分区 + 标签列<br/>硬表单"]
        A2["特征与预处理: 特征选择方法 + WOE 开关<br/>硬表单 + 软表单默认"]
        A3["训练与寻参: 框架 + n_trials + Search Space<br/>硬表单 + 软表单默认"]
        A4["调度与集群: 资源档位 + 优先级<br/>软表单默认"]
        A5["确认默认值后一键提交<br/>后台生成等价 Python 并投递"]
        A1 --> A2 --> A3 --> A4 --> A5
    end

    Before -.->|"映射"| After
```

**上下映射与表单类型**：

| Python 侧（Before） | 平台侧（After） | 表单类型说明 |
|---------------------|-----------------|--------------|
| Config 凭证、fp_base、label、sample_use_col | 数据源区块：Hive 表名、分区条件、**目标列**（必选） | **硬表单**：用户必填 |
| 各域 data_path、encoder 路径、PATHS 字典 | 平台按「任务 ID + 实例 ID」自动生成 S3 路径 | **自动**：无需填写 |
| woe_fit 的 n_bins、method、categorical_features、exclude | 特征与预处理：**特征选择算法**多选、**开启 WOE**、剔除列 | **硬表单** + **软表单默认**（如 5 bin、best_ks、IV 0.02） |
| feature_selection 的阈值、lambda_grid、n_resampling | 同上区块，FS 阈值与 by_stability 参数 | **软表单默认**（可改） |
| model_tune 的 init_hypers、n_trails、各输出路径 | 训练与寻参：**框架**、**n_trials**、**Search Space**、评价指标 | **硬表单** + **软表单默认**（如 metric=auc） |
| num_workers、cpu_per_worker、memory_per_worker | 调度与集群：资源档位 Low/Medium/High、优先级 | **软表单默认** |
| 串行执行 7 步、本地等待、手动查日志 | 提交后 QUEUING → RUNNING，Web 查看日志与 Metrics | **平台自动** |

**对比结论**：Python 约 **2–4 小时**（编写 + 调参 + 路径管理 + 串行等待）；平台 **&lt; 5 分钟** 填硬表单、确认软表单默认值、一键提交即可。

### 6.3 多模型多参数对比探索：三种模式流程图

**使用目的（白话）**：同一份数据集，想尝试「XGBoost + LightGBM」两种框架，每种再试「窄搜索空间」和「宽搜索空间」，共 4 组配置，跑完对比哪组效果最好。下面三种方式分别对应：无平台、有平台但只能一个个建 Task、有平台且用 Experiment 批量创建并统一对比。

---

**流程图 A — 纯 Python（无平台）**

手写 4 份脚本，分别提交 Ray，再手动收集指标并对比；步骤多、易出错、无统一视图。

```mermaid
flowchart TB
    subgraph modeA [模式 A: 纯 Python]
        A1["手写 config_1.py LGBM 窄搜索"]
        A2["提交 Ray 等待"]
        A3["手动下载 metrics_1.json"]
        A4["手写 config_2.py LGBM 宽搜索"]
        A5["提交 Ray 等待"]
        A6["手动下载 metrics_2.json"]
        A7["手写 config_3.py XGB 窄搜索"]
        A8["提交 Ray 等待"]
        A9["手动下载 metrics_3.json"]
        A10["手写 config_4.py XGB 宽搜索"]
        A11["提交 Ray 等待"]
        A12["手动下载 metrics_4.json"]
        A13["Excel 或 Notebook 对比 4 份指标"]
        A14["人工判断最优并 Register Build"]
        A1 --> A2 --> A3 --> A4 --> A5 --> A6 --> A7 --> A8 --> A9 --> A10 --> A11 --> A12 --> A13 --> A14
    end
```

*约 12+ 步，4 份独立脚本，路径/参数易不一致，对比靠人工整理。*

---

**流程图 B — 有平台，仅 Training Task（无 Experiment）**

每个配置单独创建一条 Training Task、填表单、提交；路径与 WOE/FS 由平台统一处理，但需重复填表 4 次，对比时仍需逐个点开 Instance 看指标。

```mermaid
flowchart TB
    subgraph modeB [模式 B: 平台仅 Training Task]
        direction TB
        B1["创建 Task1 LGBM 窄"]
        B2["填表单 提交"]
        B3["创建 Task2 LGBM 宽"]
        B4["填表单 提交"]
        B5["创建 Task3 XGB 窄"]
        B6["填表单 提交"]
        B7["创建 Task4 XGB 宽"]
        B8["填表单 提交"]
        B9["逐个打开 Instance 查看 Metrics"]
        B10["手动对比 4 个结果"]
        B11["选最优 Register Build"]
        B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7 --> B8 --> B9 --> B10 --> B11
    end
```

*约 8 步，4 次重复填表，路径与预处理自动；对比仍依赖人工。*

---

**流程图 C — 有平台 + Experiment（AI 批量创建 + 统一对比）**

选同一数据源与标签列，用一句 Prompt 描述意图，AI 生成 4 张 Task 卡片，用户 Review 后一键提交；执行后在 Experiment 详情页用平行坐标图与指标表统一对比，直接定位最优并 Register Build。

```mermaid
flowchart TB
    subgraph modeC [模式 C: 平台 + Experiment]
        direction TB
        C1["选择数据集与标签列"]
        C2["输入 Prompt: 对比 XGB 与 LGBM 各窄宽两套搜索空间"]
        C3["AI 生成 4 张 Task 卡片"]
        C4["用户 Review 或微调"]
        C5["一键 Submit All"]
        C6["4 个 Task 并行执行"]
        C7["Experiment 详情页: 平行坐标图 + 指标排序表"]
        C8["一眼定位最优"]
        C9["Register Build"]
        C1 --> C2 --> C3 --> C4 --> C5 --> C6 --> C7 --> C8 --> C9
    end
```

*约 4 步操作，一次输入、AI 填 4 张表单，统一对比面板，全流程 &lt; 10 分钟。*

---

**小结**：同一「多模型多参数对比」目标下，三种模式的步骤数约为 **A 12+ 步 / B 8 步 / C 4 步**；平台 + Experiment 在减少重复配置与统一结论输出上价值最大。
