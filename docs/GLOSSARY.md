# 平台术语表 (Glossary) — 唯一权威来源

本文件为离线模型训练平台的**唯一术语定义来源**。所有设计、架构、PRD 文档引用此表，不再各自定义。

---

## 核心领域实体


| 概念       | 英文                   | 定义                                                                          | 关系                                          |
| -------- | -------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| **模型**   | Model                | 逻辑模型实体（如「欺诈检测模型」），含元信息（名称、框架、类型、Owner、region），不绑定训练产物。                      | 1 Model → N ModelVersion                    |
| **模型版本** | ModelVersion         | Model 的一次重大迭代（架构变更、特征集重构等），以 v1 / v2 标签区分。                                  | 1 ModelVersion → N Build                    |
| **构建产物** | Build                | 一次 SUCCESS 的 Run 产出的模型快照，经用户 Review 后注册。引用 ModelArtifact 的 S3 路径，冻结指标与配置快照。 | 1 Build ← 1 Run；注册到 1 ModelVersion          |
| **模型实验** | Experiment (EXP)     | 绑定已注册 Model 的训练编排单元。保留当前/最新画布配置；画布入口在 Experiment 层级；一次执行为 Run。              | 1 Model → N Experiment；1 Experiment → N Run |
| **实验执行** | Run                  | Experiment 的一次实际执行，以 Run id 标识。创建时携带配置快照（RunConfig），中间产物与画布配置均绑定 Run id。    | 1 Run ← 1 Experiment；可产出 0..1 Build         |
| **模型产物** | ModelArtifact        | Run 执行 SUCCESS 后归档至 S3 的全部文件（模型文件 + 指标 + 日志 + 配置快照）。                        | 1 Artifact ↔ 1 Run                          |
| **探索会话** | ExplorationSession   | （Phase 2）通过 AI Prompt 批量生成多个 Experiment 的对比探索容器。                            | 1 ExplorationSession → N Experiment         |
| **实验模板** | Experiment Template  | 预设的实验流程模板，包含可复用的 DAG 与节点配置。                                                 | 1 Template → N Experiment                   |
| **实验物料** | Experiment Component | 画布节点实例，基于 Component Template。                                               | 1 Experiment → N Component                  |
| **物料模板** | Component Template   | 画布节点类型定义，描述步骤的配置 schema。                                                    | 1 Component Template → N Component          |


## 已弃用别名 (Deprecated Aliases)

以下为历史术语，仅在 `_FIGMA_SYNC_REVIEW.md` 中保留映射，**不应在新文档中使用**。


| 历史术语         | 当前术语       | 说明            |
| ------------ | ---------- | ------------- |
| TrainingTask | Experiment | Figma 设计稿遗留命名 |
| TaskInstance | Run        | Figma 设计稿遗留命名 |
| Pipeline     | Experiment | 早期架构命名        |
| PipelineRun  | Run        | 早期架构命名        |


## Experiment 状态（任务级）


| 状态       | 含义  | 说明                |
| -------- | --- | ----------------- |
| DRAFT    | 草稿  | 创建后初始状态，可编辑，不可调度  |
| ENABLED  | 已启用 | 可被调度触发（Cron / 手动） |
| DISABLED | 已禁用 | 暂停调度，保留配置         |


## Run 状态机（实验执行级）

唯一权威定义，其余文档引用本节。

```
[*] → QUEUING : Trigger Run 创建
QUEUING → RUNNING : 获取计算资源
RUNNING → CHECKING : isCheckPoint 节点成功完成
RUNNING → SUCCESS : 全部节点完成
RUNNING → FAILED : error
RUNNING → KILLED : 用户 kill
CHECKING → RUNNING : 用户 Continue
CHECKING → KILLED : 用户 Kill
QUEUING → KILLED : 用户取消排队
```


| 状态           | Tag 颜色       | 含义                                | 允许操作                             |
| ------------ | ------------ | --------------------------------- | -------------------------------- |
| **QUEUING**  | `tag-orange` | 排队等待资源（界面主展示；数据模型可含 WAITING 同位兼容） | Kill（取消排队）                       |
| **RUNNING**  | `tag-blue`   | 执行中                               | Kill → KILLED                    |
| **CHECKING** | `tag-yellow` | isCheckPoint 节点完成，等待人工 Review     | Continue → RUNNING；Kill → KILLED |
| **SUCCESS**  | `tag-green`  | 全部完成，产物已归档                        | Register Build                   |
| **FAILED**   | `tag-red`    | 执行失败                              | —                                |
| **KILLED**   | `tag-red`    | 用户终止                              | —                                |


### Run Action 可见性矩阵（操作权限）


| 操作                       | QUEUING | RUNNING | CHECKING | SUCCESS | FAILED | KILLED |
| ------------------------ | ------- | ------- | -------- | ------- | ------ | ------ |
| View（配置快照+DAG+节点执行）      | Yes     | Yes     | Yes      | Yes     | Yes    | Yes    |
| View Metrics / Artifacts | 置灰      | 置灰      | 置灰       | Yes     | 置灰     | 置灰     |
| View Log                 | 置灰      | 置灰      | Yes      | Yes     | Yes    | Yes    |
| Register Build           | 置灰      | 置灰      | 置灰       | Yes     | 置灰     | 置灰     |
| Continue                 | 置灰      | 置灰      | Yes      | 置灰      | 置灰     | 置灰     |
| Kill                     | Yes     | Yes     | Yes      | 置灰      | 置灰     | 置灰     |


## 调度与队列


| 概念                         | 定义                                                             |
| -------------------------- | -------------------------------------------------------------- |
| **优先级队列** (Priority Queue) | 跨 Experiment 全局 Run 排队：critical > important > normal，同优先级 FIFO |
| **串行锁** (Serial Lock)      | per-Experiment 并发控制，同一 Experiment 同时最多一个 RUNNING 的 Run         |
| **SavePoint**              | 节点产出作为恢复点持久化；新 Run 可复用（无变更部分走缓存）                               |
| **CheckPoint**             | 节点布尔属性（默认关），成功完成后 Run 进入 CHECKING 等待人工 Continue/Kill           |


## 系统边界


| 层                                                | 归属               |
| ------------------------------------------------ | ---------------- |
| Hive 表数据准备                                       | 上游（非本平台）         |
| Experiment 配置 → 调度 → Run 执行 → 评估 → 归档 → Build 注册 | **本平台**          |
| 模型部署 & 线上 Serving                                | 下游（本期不详设）        |
| 用户权限 (RBAC)                                      | 共用（统一权限，与特征平台一致） |
| 调度引擎 / 计算资源                                      | 共用（复用内部基础设施）     |


---

*最后更新: 2026-04-06*