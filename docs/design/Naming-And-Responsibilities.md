# Experiment / Run 命名与职责约定

本文档记录模型训练平台中 **Experiment（EXP）**、**Experiment Component（实验物料）** 与 **Run** 的命名与职责结论，供架构与设计文档一致引用。文档中 **Experiment** 即 **Model Experiment（模型实验）**，**画布节点 / 节点配置** 即 **Experiment Component（实验物料）**，其类型来自 **Component Template（物料模板）**。

---

## 一、命名

| 原称谓 | 新称谓（英文） | 新称谓（中文） |
|--------|----------------|----------------|
| 实验流程模板 | Experiment Template | 实验模板 |
| Training Task / Pipeline | Experiment (EXP) / Model Experiment | 实验 / 模型实验 |
| Task Instance / Pipeline Run | Run | 实验执行 / 运行 |
| Task Name / Pipeline Name | Experiment Name | 实验名称 |
| Task Config（画布首位节点） | Experiment Meta | 实验元信息 |
| 画布节点 / 节点配置 | Experiment Component（基于 Component Template） | 实验物料（基于物料模板） |
| Task Count / Pipeline Count | Experiment Count | 实验数量 |
| Create Task / Create Pipeline | Create Experiment / Create Exp. | 创建实验 |
| Instance Artifacts / Run Artifacts | Run Artifacts | 运行产物（绑定 Run id） |

**界面用语**（与 [Figma Model Experiment](https://www.figma.com/design/C15E8rRER0qSqYsQZgdVif/Model-Experiment) / [`model-experiment-web`](../prototype/model-experiment-web/README.md) 对齐）：列表 **Model Experiments**、列 **Exp Id / Exp Name**、运行列 **Run ID**；配置页 **Action → Trigger Run**、**Run History**。领域文档仍统一写 **Experiment / Run**。

产品/模块名可后续考虑「Model Lab」；本轮仅做上述命名统一。

---

## 二、Experiment 与 Run 的职责

- **Experiment（模型实验）**：定义完整的真实实验计划。须**绑定已注册 Model**（1 Model Version → N Experiment，以产品为准），默认继承 Model 的 name 与 region（Experiment 与 Run 不覆盖 Model 元信息）。基于 **Experiment Template** 创建：选模板后通过表单配置，表单提交后后端自动生成等价的 Python **RayUtil** 脚本，即为该 **Model Experiment**。保留**当前/最新画布配置**与 **history[]（配置版本）**，便于历史 Run 溯源与复现。画布配置**入口在 Experiment 层级**；新建 Run 的主交互为 **Action → Trigger Run**（见 [产品原型与PRD §4.1](./产品原型与PRD.md)）。**设计稿在 Experiment Meta / Start 节点提供 Schedule（ONCE / Hourly / Daily / Weekly / Monthly）**；是否由后端实现 Cron 与队列对接以迭代为准，本文不再写死「不支持」。
- **Run（实验执行）**：**Experiment 中涉及 Component 的一次有顺序的实际执行记录**，以 **Run id** 标识（界面同源 **TaskInstance**）。创建时携带**画布配置快照**（DAG + 节点参数）。**中间产物与画布配置均绑定 Run id**。Run 记录该次执行中**执行了哪几步、涉及哪些节点（Component）、Step 顺序、各节点配置及产物**；可展示 **bindTask**（配置版本标签）。**改配置后再次执行 = 新 Run**（按最新 Experiment 配置执行；执行时无变更部分可走缓存）。每次执行产物有对应存储路径（`s3://…/{exp_id}/{run_id}/`）。

---

## 三、Run 相关操作场景

配置页以 **Action → Trigger Run** 为主入口；**Trigger Run** 弹窗内 **Use Cache** 表达是否优先复用缓存（关即全量重跑）。设计意图包含 **从选中节点起执行**（原型中有 **Run 下拉**组件，当前导出未挂接；画布提示「set start point」），落地以 Figma 为准。

1. **新建 Run（默认全 DAG）**：**Trigger Run** 通过校验后打开弹窗，提交后新建 Run，默认按**全 pipeline / from start** 路径验证；执行时系统分析配置是否变更，无变更部分可走缓存。
2. **改配置后执行**：在画布配置页调整配置后再次执行 → **新 Run id**，按**最新 Experiment 配置**执行；无变更部分可走缓存。

---

## 四、与其他文档的关系

- 架构说明、画布配置、训练数据管道、产品 PRD 等文档中的实体名、ER、状态机、术语表均按本约定使用 **Experiment / Run** 及上述职责划分。交互层与 Figma 矛盾的追溯见 [_FIGMA_SYNC_REVIEW.md](./_FIGMA_SYNC_REVIEW.md)。
- 画布首位节点称「**Experiment Meta**」，对应实验元信息、修改不落版（直接更新 Experiment 实体）。
- 画布节点 = **Experiment Component**（基于 **Component Template** 的实例）；完整术语表见 [系统架构说明 §11](../architecture/系统架构说明.md)。
