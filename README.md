# Offline Model Training Platform / 离线模型训练平台

End-to-end offline model training management platform — covering training task configuration, scheduling & execution, data pipeline processing, model evaluation, artifact archival, and model registry.

面向算法 / DS / 策略团队的离线模型训练管理平台，覆盖训练任务配置、调度执行、数据管道处理、模型评估、产物归档与模型注册全链路。

---

## Architecture Overview / 架构概览

```
                        ┌─────────────────────────────┐
                        │        Web 后台 (Ant Design)  │
                        │  模型管理页 │ 模型训练页 │ 配置页 │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │       后端服务层 (Backend)     │
                        │  Model Service │ Task Service  │
                        │  Instance Service │ Scheduler  │
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

### Core Modules / 核心模块

| Module | Description |
|--------|-------------|
| **Model Training** (本期重点) | 训练任务全生命周期管理：任务配置 → 调度执行 → Pipeline → 评估 → 归档 |
| **Model Management** (本期粗略设计) | 模型注册与版本管理：Model → ModelVersion → Build |

### Ray Execution Pipeline

平台基于纯表单收集配置，自动为您生成调用 `RayUtil` 的 Python 脚本，并后台包裹投递到内部 Ray 集群执行。

| 核心链路 | 说明 |
|----------|-------------|
| **表单配置与 AI 辅助** | 用户通过表单独立配置或通过 AI Prompt (Experiment) 智能生成多组训练参数，无需手写 YAML 或操作画布。 |
| **Python 脚本生成** | 平台将表单配置转化为 `RayUtil` Python 脚本（特征预处理 WOE/切分/参数配置）。 |
| **Ray 分布式执行 (TaskInstance)** | 封装后的脚本自动投递至 Ray 集群执行。借助内部强大的 Ray Tune 承担 `n_trials` 的底层超参搜索。 |
| **Metrics 与日志收集** | 训练日志实时在 Web UI 回显，指标计算与最优模型产物最终回传至 S3 并同步注册。 |

---

## Domain Model / 领域模型

```
Model (逻辑模型实体)
├── ModelVersion v1 (重大迭代)
│   ├── Build #1  ←  TaskInstance #101 (SUCCESS)
│   └── Build #2  ←  TaskInstance #205 (SUCCESS)
└── ModelVersion v2
    └── Build #1  ←  TaskInstance #310 (SUCCESS)

Experiment (本期 MVP 重点：多配置探索与全局最优)
│  说明：用户通过 AI Prompt 输入意图，平台自动推导解析出不同的搜索空间与框架，生成填充好的多张 TrainingTask 表单供用户 Review
└── TrainingTask 1 (如 XGBoost 任务)
│       └── TaskInstance 1..N (由底层 Ray Tune 调度完成 N 次 Trial 搜索最优)
└── TrainingTask 2 (如 LightGBM 任务)
        └── TaskInstance 1..N

TrainingTask (表单驱动的可复用训练实体，直接生成执行 Python)
├── TaskInstance #101 (SUCCESS) → Artifact @ S3 → 注册为 Build
├── TaskInstance #102 (FAILED)  → 仅有日志 @ S3
└── TaskInstance #205 (SUCCESS) → Artifact @ S3 → 注册为 Build
```

### State Machines / 状态机

**Training Task**: `DRAFT` → `ONLINE` → `OFFLINE` → `DELETED`

**Task Instance**: `QUEUING` → `RUNNING` → `SUCCESS` / `FAILED` / `KILLED`

---

## Project Structure / 项目结构

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
        └── MODEL_TRAINING.html                  # 画布交互原型
```

---

## 文档与参考材料说明

| 分类 | 路径 | 是否可改 | 说明 |
|------|------|----------|------|
| **调研整理材料** | `docs/research/*.md` | 可增删改 | 竞品调研、技术选型与方案对比，供方案分析用，不驱动产品定稿。 |
| **内部参考（不可改动）** | 根目录 `MODEL_PIPELINE.md`、目录 `risk_model_on_ray/` | **不可改** | 流程图与步骤定义、参考实现代码与分布式训练手册，仅作阅读与对照，请勿修改。 |
| **PRD 与设计** | `docs/design/*.md`、`docs/architecture/系统架构说明.md` | 可改 | 产品需求、画布配置、数据管道、系统架构等设计文档。 |
| **前端交互示意** | `docs/prototype/*.html` | 可改 | 可交互原型（如 Experiment 画布 MODEL_TRAINING.html）。 |

---

## Documentation Index / 文档索引

| Document | Scope | Audience |
|----------|-------|----------|
| [系统架构说明](docs/architecture/系统架构说明.md) | 系统架构、领域模型、模块职责、状态机、产品交付示意图、上下游边界、预研清单 (§1–§17) | PM / Backend / Frontend / Arch |
| [Training Data Pipeline](docs/design/Training-Data-Pipeline.md) | 表单转化为 Python 脚本投递给 Ray 的详细设计与规范及日志采集过程 (§1–§7) | Backend / ML Engineer |
| [产品原型与 PRD](docs/design/产品原型与PRD.md) | 产品原型、IA、核心功能、MVP Scope；**§5 用户操作说明与平台价值对比**（Python 流程图、Before/After、多模型三种模式） | PM / Frontend |
| [docs/README.md](docs/README.md) | docs 目录索引：调研 / 设计 / 原型 / 参考材料分类 | 全员 |

**建议阅读顺序**：先读「系统架构说明」建立完整概念 → 再读「Training Data Pipeline」了解执行层细节；产品价值与操作对比见「产品原型与 PRD」§5。

---

## Design Boundaries / 设计边界

- **数据清洗由上游负责**：Hive 表已干净；Pipeline 仅做特征选择、可选 WOE、超参与停止条件（见 [Training-Data-Pipeline](docs/design/Training-Data-Pipeline.md) §1、§3.2）。
- **自动 Feature Selection（Phase 2）**：为本期 **P0 需求**（by_iv / by_corr / by_gini / by_psi / by_stability，见 Pipeline §3.2）。

| Boundary | Description |
|----------|-------------|
| **训练数据只读** | 平台从 Hive 表读取训练数据，不对上游数据进行写入或修改 |
| **松耦合于特征平台** | 训练数据来源为任意有权限的 Hive 表（含特征平台 WideTable），不做强耦合 |
| **模型部署** | 本期仅设计 Build 注册出口，具体部署流程待后续迭代 |
| **UI 风格** | 与在线特征平台一致（Ant Design Pro / 主色 `#13c2c2`） |

---

## System Boundary / 上下游边界

| Layer | Ownership | Note |
|-------|-----------|------|
| Hive 表数据准备（WideTable / 其他管道） | 上游 (非本平台) | 本平台只读消费 |
| Training Task 配置 → 调度 → Pipeline → 评估 → 归档 → Build 注册 | **本平台** | 核心职责 |
| 模型部署 & 线上 Serving | 下游 (本期不详设) | 仅设计 Build 注册出口 |
| 用户权限 (RBAC) | 共用 | 统一权限，与特征平台一致 |
| 调度引擎 / 计算资源 | 共用 | 复用内部基础设施 |

---

## Tech Stack / 技术栈

| Layer | Technology |
|-------|------------|
| Frontend | Ant Design Pro (React) / 主色 `#13c2c2` |
| Backend | RESTful API (Task / Instance / Model Service) |
| Data Processing & Engines | Ray (Ray Data / Ray Train / XGBoost / LightGBM) |
| Hyperparameter Search | Ray Tune (下沉于执行侧) |
| Storage | Hive (training data), S3 (artifacts), MetaDB (metadata) |
| Scheduling | Internal Cron engine + Priority Queue + Serial Lock |
| Auth | Unified RBAC (shared with Feature Platform) |

---

## Key Concepts / 核心概念速查

| Concept | Definition |
|---------|------------|
| **Experiment** | （本期 MVP）高于 Task 的归属与对比容器，采用 AI Prompt 对话自动生成、解析搜索空间并填充多 Task 表单。在给定数据集与预测目标下对比选优，支撑寻找更大的全局最优化。 |
| **Model** | 逻辑模型实体（如「欺诈检测模型」），含元信息 |
| **ModelVersion** | Model 的一次重大迭代（如架构变更），以 v1/v2 标签区分 |
| **Build** | 训练实例产出的、经 Review 注册的模型产物（模型文件 + 指标 + 配置快照） |
| **TrainingTask** | 基于纯表单填写的可复用训练配置实体（底层会自动生成并使用 RayUtil 包裹 Python 执行） |
| **TaskInstance** | Task 的一次实际执行记录，依托底层 Ray Tune 跑完整个搜索到产出最佳结果的全流程 |
| **Priority Queue** | 跨 Task 全局排队：critical > important > normal，同优先级 FIFO |
| **Serial Lock** | per-Task 并发控制，同一 Task 最多一个 RUNNING 实例 |

---

## Backlog / 延期特性

| Feature | Priority | Note |
|---------|----------|------|
| 自动 Feature Selection（Phase 2） | **P0 本期** | variance_threshold / correlation_filter，见 Pipeline §3.2 |
| **Experiment（多配置对比与选优）** | **P0 本期** | 支撑全局最优化；通过 AI Prompt 解析并自动填充表单。 |
| 数据采样 (大表 N% 快速实验) | P2 | — |
| 跨实例/跨模型实验对比 | P2 | 多 Instance Metrics 并排对比 |
| 模型部署与 Serving | P1 (后续) | 本期仅粗略设计 Build 出口 |

---

*Project Version: MVP | Last Updated: 2026-02-26*
