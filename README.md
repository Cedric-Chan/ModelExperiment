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
   │ 调度基础设施       │    │ Training Data    │    │   存储层          │
   │ Cron + 优先级队列  │───►│ Pipeline         │───►│ MetaDB / Hive    │
   │ + 串行锁          │    │ 6 Phase 数据管道  │    │ / S3             │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Core Modules / 核心模块

| Module | Description |
|--------|-------------|
| **Model Training** (本期重点) | 训练任务全生命周期管理：任务配置 → 调度执行 → Pipeline → 评估 → 归档 |
| **Model Management** (本期粗略设计) | 模型注册与版本管理：Model → ModelVersion → Build |

### Training Data Pipeline (6 Phases)

```
Phase 1         Phase 2          Phase 3           Phase 4          Phase 5          Phase 6
数据获取    →    数据预处理    →    Train/Val 切分  →  模型训练      →   模型评估     →   产物归档
(Spark/Hive)    (Spark)          (Spark)           (训练引擎)       (训练引擎)       (→ S3)
```

| Phase | Environment | Responsibility |
|-------|-------------|----------------|
| Phase 1: Data Acquisition | Spark | Read from Hive tables with partition/custom filters |
| Phase 2: Preprocessing | Spark | Missing values, encoding, normalization, feature selection |
| Phase 3: Train/Val Split | Spark | 5 split strategies (random, time-based, column-based, etc.) |
| Phase 4: Model Training | Engine | XGBoost / LightGBM / CatBoost / sklearn / PyTorch / TF |
| Phase 5: Evaluation | Engine | Metrics computation (AUC, F1, RMSE, Feature Importance, etc.) |
| Phase 6: Archival | Engine → S3 | Model artifacts + metrics + logs + config snapshot → S3 |

---

## Domain Model / 领域模型

```
Model (逻辑模型实体)
├── ModelVersion v1 (重大迭代)
│   ├── Build #1  ←  TaskInstance #101 (SUCCESS)
│   └── Build #2  ←  TaskInstance #205 (SUCCESS)
└── ModelVersion v2
    └── Build #1  ←  TaskInstance #310 (SUCCESS)

TrainingTask (可复用训练配置)
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
└── docs/                                        # 文档目录
    ├── architecture/
    │   └── 系统架构说明.md                        # 系统架构 + 领域模型 + 模块职责
    │                                             # + 状态机 + 产品交付 + 预研清单
    └── design/
        └── Training-Data-Pipeline.md             # Pipeline 6 Phase 详细设计
                                                  # 输入/输出/异常处理/资源映射
```

---

## Documentation Index / 文档索引

| Document | Scope | Audience |
|----------|-------|----------|
| [系统架构说明](docs/architecture/系统架构说明.md) | 系统架构、领域模型、模块职责、状态机、产品交付示意图、上下游边界、预研清单 (§1–§17) | PM / Backend / Frontend / Arch |
| [Training Data Pipeline](docs/design/Training-Data-Pipeline.md) | Pipeline 全 6 Phase 详细设计：输入/输出/引擎适配/异常处理/资源映射 (§1–§7) | Backend / ML Engineer |
| 产品原型图.md *(待输出)* | 模型管理页、模型训练页、任务配置详情页的交互规格 | PM / Frontend |

**建议阅读顺序**：先读「系统架构说明」建立完整概念 → 再读「Training Data Pipeline」了解执行层细节。

---

## Design Boundaries / 设计边界

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
| Data Processing | Apache Spark (SparkSQL / Spark ML Pipeline) |
| Training Engines | XGBoost, LightGBM, CatBoost, sklearn, PyTorch, TensorFlow |
| Hyperparameter Search | Grid / Random / Bayesian (Optuna) |
| Storage | Hive (training data), S3 (artifacts), MetaDB (metadata) |
| Scheduling | Internal Cron engine + Priority Queue + Serial Lock |
| Auth | Unified RBAC (shared with Feature Platform) |

---

## Key Concepts / 核心概念速查

| Concept | Definition |
|---------|------------|
| **Model** | 逻辑模型实体（如「欺诈检测模型」），含元信息 |
| **ModelVersion** | Model 的一次重大迭代（如架构变更），以 v1/v2 标签区分 |
| **Build** | 训练实例产出的、经 Review 注册的模型产物（模型文件 + 指标 + 配置快照） |
| **TrainingTask** | 可复用的训练配置实体（数据源 / 预处理 / 切分 / 超参 / 目标 / 调度） |
| **TaskInstance** | Task 的一次实际执行记录，对应一次完整 Pipeline 运行 |
| **Priority Queue** | 跨 Task 全局排队：critical > important > normal，同优先级 FIFO |
| **Serial Lock** | per-Task 并发控制，同一 Task 最多一个 RUNNING 实例 |

---

## Backlog / 延期特性

| Feature | Priority | Note |
|---------|----------|------|
| 数据采样 (大表 N% 快速实验) | P2 | — |
| 跨实例/跨模型实验对比 | P2 | 多 Instance Metrics 并排对比 |
| 模型部署与 Serving | P1 (后续) | 本期仅粗略设计 Build 出口 |

---

*Project Version: MVP | Last Updated: 2026-02-26*
