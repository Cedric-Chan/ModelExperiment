# docs 目录索引

本目录按用途分为四类，便于区分「调研材料 / 设计文档 / 交互原型 / 内部参考」。

---

## 1. 调研整理材料（可增删改）

**路径**：`docs/research/`

供方案对比与竞品分析，不直接驱动产品定稿。

| 文件 | 说明 |
|------|------|
| 竞品调研_Amazon_SageMaker.md | 竞品调研 |
| 竞品调研_DagsHub.md | 竞品调研 |
| 竞品调研_Kubeflow.md | 竞品调研 |
| 竞品调研_Metaflow.md | 竞品调研 |
| 竞品调研_Prefect.md | 竞品调研 |
| 竞品调研_Valohai.md | 竞品调研 |
| 竞品调研_ZenML.md | 竞品调研 |
| 竞品调研_火山引擎机器学习平台.md | 竞品调研 |
| Canvas-DAG-技术选型与方案对比.md | Canvas DAG 技术选型与方案对比 |
| 方案B-G-Task与Run概念及配置承载对比.md | Task/Run 与配置承载方案对比 |
| Model Experiment.zip | Figma 导出的交互与视觉参考（React 代码包）；**实体与操作以 [系统架构说明](architecture/系统架构说明.md) 与 [产品原型与PRD](design/产品原型与PRD.md) 为准**，与设计稿的差异见 PRD §4.1.1「设计稿差异」及「设计稿与产品差异」表。 |

---

## 2. 内部参考材料（不可改动）

**路径**：仓库根目录 `MODEL_PIPELINE.md`、`risk_model_on_ray/`

仅作阅读与对照，请勿修改。

| 路径 | 说明 |
|------|------|
| MODEL_PIPELINE.md | 流程图与步骤定义 |
| risk_model_on_ray/ | 参考实现代码与分布式训练手册（含 RayUtil、WOE、Tune、Train 等） |

---

## 3. PRD 与设计描述（可编辑）

**路径**：`docs/design/`、`docs/architecture/`

产品需求、画布配置、数据管道、系统架构等设计文档。

| 文件 | 说明 |
|------|------|
| [architecture/系统架构说明.md](architecture/系统架构说明.md) | 系统架构、领域模型、模块职责、状态机等 |
| [design/产品原型与PRD.md](design/产品原型与PRD.md) | 产品原型与 PRD |
| [design/Naming-And-Responsibilities.md](design/Naming-And-Responsibilities.md) | 命名与职责 |
| [design/Pipeline-Steps-and-Canvas-Nodes.md](design/Pipeline-Steps-and-Canvas-Nodes.md) | Pipeline 步骤与画布节点 |
| [design/Task-Canvas-Config.md](design/Task-Canvas-Config.md) | Task 与画布配置 |
| [design/Training-Data-Pipeline.md](design/Training-Data-Pipeline.md) | 训练数据管道设计 |

---

## 4. 前端交互示意（可编辑）

**路径**：`docs/prototype/`

React（Vite）可交互原型源码在 `model-experiment-web/`；公共部署见 **[GitHub Pages](https://cedric-chan.github.io/ModelExperiment/)**。`MODEL_TRAINING.html` 为说明页，引导打开线上演示与本地运行方式。

| 路径 | 说明 |
|------|------|
| [prototype/MODEL_TRAINING.html](prototype/MODEL_TRAINING.html) | 说明页：线上演示链接与本地运行命令 |
| [prototype/model-experiment-web/](prototype/model-experiment-web/) | React 交互原型源码（与 Figma 导出一致） |
