# 离线模型训练平台

面向算法 / DS / 策略团队的离线模型训练管理平台，覆盖训练任务配置、调度执行、数据管道处理、模型评估、产物归档与模型注册全链路。

---

## 架构概览

```
                        ┌─────────────────────────────┐
                        │        Web 后台 (Ant Design)  │
                        │  模型管理页 │ 模型训练页 │ 配置页 │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │       后端服务层 (Backend)     │
                        │  Model Service │ Exp Service   │
                        │  Run Service │ Scheduler       │
                        └──────────────┬──────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │ 调度基础设施       │    │   Ray 集群       │    │   存储层          │
   │ Cron + 优先级队列  │───►│ 自动生成 Python │───►│ MetaDB / Hive    │
   │ + 串行锁          │    │ 脚本投递与执行    │    │ / S3             │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### 核心模块


| 模块                        | 说明                                  |
| ----------------------------- | -------------------------------------------- |
| **模型训练** (本期重点)     | 训练任务全生命周期管理：任务配置 → 调度执行 → Pipeline → 评估 → 归档 |
| **模型管理** (本期粗略设计) | 模型注册与版本管理：Model → ModelVersion → Build       |


### Ray 执行管道

平台基于纯表单收集配置，自动为您生成调用 `RayUtil` 的 Python 脚本，并后台包裹投递到内部 Ray 集群执行。


| 核心链路                      | 说明                                                               |
| ------------------------- | ---------------------------------------------------------------- |
| **画布配置与 AI 辅助**           | 用户通过 Experiment 画布配置，或通过 AI Prompt (ExplorationSession, Phase 2) 智能生成多组训练参数。 |
| **Python 脚本生成**           | 平台将 Experiment 配置转化为 `RayUtil` Python 脚本（特征预处理 WOE/切分/参数配置）。       |
| **Ray 分布式执行 (Run)**       | 封装后的脚本自动投递至 Ray 集群执行。借助内部 Ray Tune 承担 `n_trials` 的底层超参搜索。         |
| **Metrics 与日志收集**         | 训练日志实时在 Web UI 回显，指标计算与最优模型产物最终回传至 S3 并同步注册。                     |


---

## 领域模型

> 完整术语定义见 [GLOSSARY.md](docs/GLOSSARY.md)（唯一来源），以下仅为简明概览。

```
Model (逻辑模型实体)
├── ModelVersion v1 (重大迭代)
│   ├── Build #1  ←  Run #101 (SUCCESS)
│   └── Build #2  ←  Run #205 (SUCCESS)
└── ModelVersion v2
    └── Build #1  ←  Run #310 (SUCCESS)

Experiment (画布驱动的训练编排单元，绑定 Model)
├── Run #101 (SUCCESS) → ModelArtifact @ S3 → 注册为 Build
├── Run #102 (FAILED)  → 仅有日志 @ S3
└── Run #205 (SUCCESS) → ModelArtifact @ S3 → 注册为 Build

ExplorationSession (Phase 2：AI Prompt 多配置对比)
│  用户通过 AI Prompt 输入意图，平台自动推导解析出不同的搜索空间与框架
└── Experiment 1 (如 XGBoost 配置)
│       └── Run 1..N (由底层 Ray Tune 调度完成 N 次 Trial 搜索最优)
└── Experiment 2 (如 LightGBM 配置)
        └── Run 1..N
```

### State Machine（状态机）

> 唯一权威定义见 [GLOSSARY.md](docs/GLOSSARY.md)，以下为简版。

**Experiment**: `DRAFT` → `ENABLED` → `DISABLED`

**Run**: `QUEUING` → `RUNNING` → `CHECKING` (CheckPoint 人工 Review) → `SUCCESS` / `FAILED` / `KILLED`

---

## 项目结构

```
Model Training Pipeline/
├── README.md                                    # 项目说明（本文件）
├── .gitignore                                   # Git 忽略规则
├── MODEL_PIPELINE.md                            # 【内部参考，勿改】流程图与步骤定义
├── risk_model_on_ray/                           # 【内部参考，勿改】参考实现与分布式训练手册
└── docs/                                        # 文档目录
    ├── research/                                # 调研整理材料（可增删）
    │   ├── 竞品调研_*.md                          # 竞品调研
    │   ├── Canvas-DAG-技术选型与方案对比.md
    │   └── 方案B-G-Task与Run概念及配置承载对比.md
    ├── architecture/
    │   └── 系统架构说明.md                        # 本系统架构设计（可编辑）
    ├── design/                                  # PRD 与设计描述（可编辑）
    │   ├── Naming-And-Responsibilities.md
    │   ├── Pipeline-Steps-and-Canvas-Nodes.md
    │   ├── Task-Canvas-Config.md
    │   ├── Training-Data-Pipeline.md
    │   └── 产品原型与PRD.md
    └── prototype/                               # 前端交互示意（可编辑）
        ├── MODEL_TRAINING.html                  # 说明页：指向 GitHub Pages 线上原型
        └── model-experiment-web/                # React（Vite）交互原型源码
```

---

## 文档与参考材料说明


| 分类             | 路径                                               | 是否可改    | 说明                                                                                                                                         |
| -------------- | ------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **调研整理材料**     | `docs/research/*.md`                             | 可增删改    | 竞品调研、技术选型与方案对比，供方案分析用，不驱动产品定稿。                                                                                                             |
| **内部参考（不可改动）** | 根目录 `MODEL_PIPELINE.md`、目录 `risk_model_on_ray/`  | **不可改** | 流程图与步骤定义、参考实现代码与分布式训练手册，仅作阅读与对照，请勿修改。                                                                                                      |
| **PRD 与设计**    | `docs/design/*.md`、`docs/architecture/系统架构说明.md` | 可改      | 产品需求、画布配置、数据管道、系统架构等设计文档。                                                                                                                  |
| **前端交互示意**     | `docs/prototype/`                                | 可改      | `MODEL_TRAINING.html` 为说明页；**可交互原型**为 `model-experiment-web/`（React），公共演示见 [GitHub Pages](https://cedric-chan.github.io/ModelExperiment/)。 |


---

## 文档索引


| 文档                                                        | 范围                                                                        | 受众                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------ |
| [术语表 / GLOSSARY](docs/GLOSSARY.md)                              | **唯一术语定义来源**：实体命名、状态机、Action 矩阵、Deprecated Aliases                           | 全员                             |
| [系统架构说明](docs/architecture/系统架构说明.md)                           | 系统架构、领域模型、模块职责、状态机、产品交付示意图、上下游边界、预研清单 (§1–§17)                               | PM / 后端 / 前端 / 架构 |
| [Training Data Pipeline](docs/design/Training-Data-Pipeline.md) | Experiment 配置转化为 Python 脚本投递给 Ray 的详细设计与规范及日志采集过程 (§1–§7)                    | 后端 / ML 工程师          |
| [产品原型与 PRD](docs/design/产品原型与PRD.md)                            | 产品原型、IA、核心功能、MVP 范围；**§5 用户操作说明与平台价值对比**（Python 流程图、Before/After、多模型三种模式） | PM / 前端                  |
| [docs/README.md](docs/README.md)                                | docs 目录索引：调研 / 设计 / 原型 / 参考材料分类                                              | 全员                             |


**建议阅读顺序**：先读「GLOSSARY」统一术语 → 再读「系统架构说明」建立完整概念 → 再读「Training Data Pipeline」了解执行层细节；产品价值与操作对比见「产品原型与 PRD」§5。

---

## 设计边界

- **数据清洗由上游负责**：Hive 表已干净；Pipeline 仅做特征选择、可选 WOE、超参与停止条件（见 [Training-Data-Pipeline](docs/design/Training-Data-Pipeline.md) §1、§3.2）。
- **自动 Feature Selection（Phase 2）**：为本期 **P0 需求**（by_iv / by_corr / by_gini / by_psi / by_stability，见 Pipeline §3.2）。


| 边界     | 说明                                 |
| ------------ | ------------------------------------------- |
| **训练数据只读**   | 平台从 Hive 表读取训练数据，不对上游数据进行写入或修改              |
| **松耦合于特征平台** | 训练数据来源为任意有权限的 Hive 表（含特征平台 WideTable），不做强耦合 |
| **模型部署**     | 本期仅设计 Build 注册出口，具体部署流程待后续迭代                |
| **UI 风格**    | 与在线特征平台一致（Ant Design Pro / 主色 `#13c2c2`）    |


---

## 上下游边界


| 层级                                                 | 归属  | 备注           |
| ----------------------------------------------------- | ---------- | -------------- |
| Hive 表数据准备（WideTable / 其他管道）                          | 上游 (非本平台)  | 本平台只读消费        |
| Experiment 配置 → 调度 → Run 执行 → 评估 → 归档 → Build 注册      | **本平台**    | 核心职责           |
| 模型部署 & 线上 Serving                                     | 下游 (本期不详设) | 仅设计 Build 注册出口 |
| 用户权限 (RBAC)                                           | 共用         | 统一权限，与特征平台一致   |
| 调度引擎 / 计算资源                                           | 共用         | 复用内部基础设施       |


---

## 技术栈


| 层级                     | 技术                                              |
| ------------------------- | ------------------------------------------------------- |
| 前端                  | Ant Design Pro (React) / 主色 `#13c2c2`                   |
| 后端                   | RESTful API (Experiment / Run / Model Service)          |
| 数据处理与引擎 | Ray (Ray Data / Ray Train / XGBoost / LightGBM)         |
| 超参搜索     | Ray Tune (下沉于执行侧)                                       |
| 存储                   | Hive (训练数据), S3 (产物), MetaDB (元数据) |
| 调度                | 内部 Cron 引擎 + Priority Queue + Serial Lock     |
| 鉴权                      | 统一 RBAC（与特征平台共用）             |


---

## 核心概念速查

> 完整定义与 Deprecated Alias 映射见 [GLOSSARY.md](docs/GLOSSARY.md)。

| 概念            | 定义                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Model**          | 逻辑模型实体（如「欺诈检测模型」），含元信息，不绑定训练产物                                                                |
| **ModelVersion**   | Model 的一次重大迭代（如架构变更），以 v1/v2 标签区分                                                              |
| **Build**          | Run SUCCESS 后经 Review 注册的模型快照（模型文件 + 指标 + 配置快照），冻结归档                                           |
| **Experiment**     | 绑定 Model 的训练编排单元，保留画布配置；每次执行为一个 Run                                                            |
| **Run**            | Experiment 的一次实际执行，携带配置快照（RunConfig），中间产物与日志绑定 Run id                                           |
| **ExplorationSession** | （Phase 2）AI Prompt 多配置对比容器，1:N 生成多个 Experiment 供比较                                           |
| **Priority Queue** | 跨 Experiment 全局 Run 排队：critical > important > normal，同优先级 FIFO                                 |
| **Serial Lock**    | per-Experiment 并发控制，同一 Experiment 最多一个 RUNNING 的 Run                                            |


---

## 延期特性


| 特性                       | 优先级  | 备注                                                    |
| ----------------------------- | --------- | ------------------------------------------------------- |
| 自动 Feature Selection（Phase 2） | **P0 本期** | variance_threshold / correlation_filter，见 Pipeline §3.2 |
| **Experiment 画布配置与 Run 执行**   | **P0 本期** | 支撑全局最优化；画布编排 + Trigger Run + Build 注册                   |
| **ExplorationSession（AI Prompt 多配置对比）** | P1 (Phase 2) | 通过 AI Prompt 解析并自动生成多 Experiment 供比较          |
| 数据采样 (大表 N% 快速实验)             | P2        | —                                                       |
| 跨 Run / 跨 Experiment 对比       | P2        | 多 Run Metrics 并排对比                                      |
| 模型部署与 Serving                 | P1 (后续)   | 本期仅粗略设计 Build 出口                                        |


---

*项目版本: MVP | 最后更新: 2026-04-06*
