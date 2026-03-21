# Figma / 原型 与旧版 `docs/design` 矛盾清单与处置结论

**事实来源**：[Figma Model Experiment](https://www.figma.com/design/C15E8rRER0qSqYsQZgdVif/Model-Experiment) 及与其对齐的导出实现 [`docs/prototype/model-experiment-web`](../prototype/model-experiment-web/README.md)。  
**处置原则**（按任务约定）：交互层以设计稿/原型为准；下列条目均已 **采纳设计稿** 并反向写入 `docs/design`，本文留作审计追溯。

---

### ID-01 — 列表是否展示 Task / Experiment 状态

| 项 | 内容 |
|----|------|
| **设计稿/原型** | 数据模型含 `TrainingTask.status`: `DRAFT` \| `ENABLED` \| `DISABLED`（[`data.ts`](../prototype/model-experiment-web/src/app/components/data.ts)）。列表主表 thead **当前无独立 Status 列**，状态通过业务规则与后续 Manage/Enable 等能力体现；与旧 PRD「列表无 Status」部分重叠。 |
| **旧文档** | `产品原型与PRD.md` §4.1.1：Experiment 无状态、列表不展示 Status。 |
| **结论** | 采纳设计稿：**任务级**存在三态；文档与领域表对照中明确 **ENABLED/DRAFT/DISABLED** 为任务（映射 Experiment）生命周期状态。列表是否单独开列随实现迭代，不以旧 PRD 否定数据态。 |

### ID-02 — 新建执行实例的路径与命名

| 项 | 内容 |
|----|------|
| **设计稿/原型** | 配置页 **Action → Trigger Run**：先 DAG/`from_start` 校验，再打开 **Trigger Run** 弹窗（**Use Cache**、**Run Notes**、**Run**）。提交后新增 **TaskInstance**，`status: 'QUEUING'`（[`ConfigDetailPage.tsx`](../prototype/model-experiment-web/src/app/components/ConfigDetailPage.tsx)、[`App.tsx`](../prototype/model-experiment-web/src/app/App.tsx) 列表侧 `handleTrigger` 亦生成 QUEUING）。 |
| **旧文档** | 强调仅画布内单一「Run」按钮、且 Run 状态写作 **WAITING**。 |
| **结论** | 采纳设计稿：主路径文案为 **Trigger Run**；排队态文档与界面统一为 **QUEUING**（组件库亦预留 `WAITING` 展示映射，见 `StatusBadge.tsx`）。 |

### ID-03 — 是否支持「从当前节点执行」

| 项 | 内容 |
|----|------|
| **设计稿/原型** | 存在 `RunDropdown`（From Current Step / From Start）及 `validateRunPath('from_current', …)`，但 **未挂接到页面**；实际 **Trigger Run** 固定走 `from_start`。画布底部提示「Click node to set start point」体现设计意图。 |
| **旧文档** | 明确「不提供从当前节点执行」。 |
| **结论** | 采纳设计稿：**交互意图**支持从选中节点起执行；**当前导出实现**仅落实全量 `from_start`。文档区分「设计能力」与「当前原型已接线行为」。 |

### ID-04 — Version / Run History / bindTask

| 项 | 内容 |
|----|------|
| **设计稿/原型** | `TrainingTask.history[]`、`TaskInstance.bindTask`；配置页 **Run History** 下拉、`Version History` 弹窗组件（[`Modals.tsx`](../prototype/model-experiment-web/src/app/components/Modals.tsx)）；顶栏 **Current Config** vs **History Run** 只读视图。 |
| **旧文档** | 不强调 Version、无历史版本切换等。 |
| **结论** | 采纳设计稿：写明版本历史、按 Run 查看快照、bindTask 等与界面一致的交互。 |

### ID-05 — Manage / Enable / Disable / Kill

| 项 | 内容 |
|----|------|
| **设计稿/原型** | `ManageDropdown`（Enable / Disable / Delete）在源码中 **未挂接**；**Action** 下拉含 **Trigger Run**、**Kill**（运行中实例）。列表行 **Kill / View / More**。 |
| **旧文档** | 称列表无 Enable/Disable/Trigger。 |
| **结论** | 采纳设计稿：描述 **Manage（Enable/Disable）** 与 **Action（Trigger Run / Kill）** 为设计约定；并脚注当前导出中 Manage 下拉尚未接入列表或顶栏时需以 Figma 为准实现。 |

### ID-06 — 配置区布局：Drawer vs 固定侧栏

| 项 | 内容 |
|----|------|
| **设计稿/原型** | 画布右侧 **固定宽度配置面板**（`PropertyPanel`，约 256px），非滑出抽屉。 |
| **旧文档** | §4.1.1 描述为滑出式 Drawer。 |
| **结论** | 采纳设计稿：改为 **右侧固定配置面板**；Tab **Config / Last Run**。 |

### ID-07 — 全局导航与列表标题

| 项 | 内容 |
|----|------|
| **设计稿/原型** | 侧栏 **Aimos Model**；`Pipelines` / `Experiments` / `Model Registry`；列表标题 **Model Experiments**；列名 **Exp Id / Exp Name**。 |
| **旧文档** | 以 Experiment 列表表述为主，未对齐上述文案。 |
| **结论** | 采纳设计稿：IA 与可见文案与原型一致；领域名 Experiment/Run 在映射表中保留。 |

### ID-08 — 调度与 Cron

| 项 | 内容 |
|----|------|
| **设计稿/原型** | Start/Experiment Meta 相关面板含 **Schedule**：`ONCE` \| `Hourly` \| `Daily` \| `Weekly` \| `Monthly`（[`ConfigDetailPage.tsx`](../prototype/model-experiment-web/src/app/components/ConfigDetailPage.tsx)）。 |
| **旧文档** | `Naming-And-Responsibilities.md`：**暂不支持 cron**；`Training-Data-Pipeline.md` 流程图含 Cron。 |
| **结论** | 采纳设计稿：Naming 改为「设计稿含调度频率配置；是否后端落地 Cron 以迭代为准」；Pipeline 图保留 Cron 并加注与控制台调度配置的关系。 |

### ID-09 — CheckPoint 与「Continue」按钮

| 项 | 内容 |
|----|------|
| **设计稿/原型** | 无独立 **Continue** 文案按钮；择优/分支由 DAG 与节点状态表达。 |
| **旧文档** | PRD 写「不提供 Continue」与节点文案「Continue 至 Model Inference」并存。 |
| **结论** | 采纳设计稿：取消「独立 Continue 按钮」的歧义；择优后进入下游节点为 **流程语义**，非单独控件。 |

### ID-10 — 列表级 Trigger 按钮

| 项 | 内容 |
|----|------|
| **设计稿/原型** | `App.handleTrigger` 可从列表逻辑触发新 Instance，但 **TaskRow 未渲染 Trigger**，属实现缺口。 |
| **旧文档** | 曾写列表 Trigger 与产品不符。 |
| **结论** | 采纳设计稿：**允许**列表触发（与设计数据流一致）；注明当前 React 导出是否在行内展示 Trigger 以仓库实现为准。 |

### ID-11 — WideTable 对齐：Execute Config 与 DAG 无 Start/End

| 项 | 内容 |
|----|------|
| **参考** | [FeatureStore WideTable 画布](https://github.com/Cedric-Chan/FeatureStore)：`Execute Config` 顶栏入口 + 弹窗（Resource · Queue Priority · Scheduler）；DAG 为业务节点链，无独立 Start/End 占位。 |
| **设计稿/Figma** | 可能尚未单独标注 **Execute Config** 或与顶栏分区不一致。 |
| **结论** | 采纳参考实现：**Model Experiment** 顶栏增加 **Execute Config**（样式与 WideTable 一致）；画布 **移除 Start（exp_meta）与 End** 节点；实验级调度与 Pipeline Input Fields 归入 **Execute Config**。Figma 后续可再对齐。 |

---

**最后更新**：与 `docs/design` 本轮以 Figma/原型为准的修订同步。
