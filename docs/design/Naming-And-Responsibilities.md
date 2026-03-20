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
| Create Task / Create Pipeline | Create Experiment | 创建实验 |
| Instance Artifacts / Run Artifacts | Run Artifacts | 运行产物（绑定 Run id） |

产品/模块名可后续考虑「Model Lab」；本轮仅做上述命名统一。

---

## 二、Experiment 与 Run 的职责

- **Experiment（模型实验）**：定义完整的真实实验计划。须**绑定已注册 Model**（1 Model Version → N Experiment，以产品为准），默认继承 Model 的 name 与 region（Experiment 与 Run 不覆盖 Model 元信息）。基于 **Experiment Template** 创建：选模板后通过表单配置，表单提交后后端自动生成等价的 Python **RayUtil** 脚本，即为该 **Model Experiment**。保留**当前/最新画布配置**，便于历史 Run 溯源与复现。画布配置**入口在 Experiment 层级**；新建 Run 在画布内点击「Run」执行调度。**暂不支持 cron 调度**。
- **Run（实验执行）**：**Experiment 中涉及 Component 的一次有顺序的实际执行记录**，以 **Run id** 标识。创建时携带**画布配置快照**（DAG + 节点参数）。**中间产物与画布配置均绑定 Run id**。Run = Experiment 的一次执行（携带当时画布配置快照；系统不区分、不存储配置 Version 维度）；Run 记录该次执行中**执行了哪几步、涉及哪些节点（Component）、Step 顺序、各节点配置及产物**。**改配置并从某节点执行 = 新 Run**（Kill 原 Run、生成新 Run id，按最新 Experiment 配置从头执行；执行时无变更部分可走缓存）。每次执行产物有对应存储路径（`s3://…/{exp_id}/{run_id}/`）。

---

## 三、Run 相关操作场景

画布内**仅提供 Run**（始终从头执行），不提供「从当前节点执行」或「Run From Current Step」。

1. **新建 Run（从头执行）**：在画布内点击「Run」即新建 Run，从节点 1 序贯执行。执行时系统分析配置是否变更，无变更部分可走缓存；提示是否使用缓存，并支持 **Force Restart**。
2. **改配置后执行**：在画布配置页调整配置后再次执行 → 等价于 **Kill 原 Run（若在跑）、生成新 Run id**，按**最新 Experiment 配置**从头执行；无变更部分可走缓存。即 **改配置并从某节点执行 = 新 Run**。

---

## 四、与其他文档的关系

- 架构说明、画布配置、训练数据管道、产品 PRD 等文档中的实体名、ER、状态机、术语表均按本约定使用 **Experiment / Run** 及上述职责划分。
- 画布首位节点称「**Experiment Meta**」，对应实验元信息、修改不落版（直接更新 Experiment 实体）。
- 画布节点 = **Experiment Component**（基于 **Component Template** 的实例）；完整术语表见 [系统架构说明 §11](../architecture/系统架构说明.md)。
