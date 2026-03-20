# 方案 B～I：Task/Pipeline/Flow 与 Run 概念及配置承载对比

本文档对 **方案 B（火山引擎）、C（Metaflow）、D（Prefect）、E（ZenML）、F（DagsHub）、G（Valohai）、H（Kubeflow）、I（Amazon SageMaker）** 做分维度对比；**本平台**采用 **Experiment (EXP) + Run** 约定，见 [系统架构说明](../architecture/系统架构说明.md) 与 [产品原型与PRD](../design/产品原型与PRD.md)。严格依据 [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow](./竞品调研_Metaflow.md)、[竞品调研_Prefect](./竞品调研_Prefect.md)、[竞品调研_ZenML](./竞品调研_ZenML.md)、[竞品调研_DagsHub](./竞品调研_DagsHub.md)、[竞品调研_Valohai](./竞品调研_Valohai.md)、[竞品调研_Kubeflow](./竞品调研_Kubeflow.md)、[竞品调研_Amazon_SageMaker](./竞品调研_Amazon_SageMaker.md) 及其中引用的官方文档。**不明确或调研/官网均未写清的地方会单独注明，不编造。**

---

## 一、Task（或 Pipeline / Flow）和 Run（或 Instance）怎么区分？

一句话：**谁叫“定义”、谁叫“一次执行”**，各方案对比如下。

| 方案 | 「定义」叫什么 | 「一次执行」叫什么 | 说明（白话） |
|------|----------------|--------------------|--------------|
| **本平台** | **Experiment (EXP)**：绑定已注册 Model，保留当前/最新画布配置；画布入口在 Experiment 层级。Experiment 基于 **Experiment Template** 创建；画布节点为 **Experiment Component**（基于 **Component Template**）。 | **Run**：以 Run id 标识；中间产物与画布配置均绑定 Run id。Run 记录涉及哪些 Component、Step 顺序、节点配置及产物。新建 Run 在画布内点击「Run」；改配置并从某节点执行 = 新 Run。 | 1 Model → N Experiment；1 Experiment → N Run。CheckPoint 为节点属性、默认关闭；画布仅提供 Run（从头执行），改配置后执行 = 新 Run。 |
| **B 火山引擎** | **工作流 (Workflow) / PipelineTemplate**：YAML 里定义 taskTemplates + tasks（DAG）。**Task** 指 DAG 里的一个节点（可复用 taskTemplate）。 | 调研文档与 [火山引擎 MLP 文档](https://www.volcengine.com/docs/6459/72301) 未明确写出「工作流的一次运行」的正式名称（如是否叫 WorkflowRun / JobRun）。自定义训练**任务 (Job)** 是「单次环境内执行的实体」。 | **不明确**：Workflow 与「一次运行」的层级命名在调研与检索到的官网中未统一写出。 |
| **C Metaflow** | **Flow**：一个 FlowSpec 类，即一套 DAG 定义（步骤 + 转移）。**Step** 是 DAG 里的一个步骤。**Task** 是「某 Run 下某 Step 的一次运行」（foreach 时一个 Step 可对应多个 Task）。 | **Run**：每次 `python flow.py run` 产生一个 Run，有唯一 run id。一次 Run 会跑完 Flow 的 start→…→end。 | Flow = 流水线定义；Run = 这条流水线跑一遍。Step 是图上的节点，Task 是某次 Run 里该节点的一次具体执行。 |
| **D Prefect** | **Flow / Task**：用 `@flow`、`@task` 装饰的函数，即 DAG 定义；依赖由函数调用关系形成。 | **Flow Run / Task Run**：调用一次 flow 函数产生一个 flow run；其内每个 task 执行产生 task run。 | Flow = 工作流定义；Flow Run = 该工作流执行一次。Task 是子单元，Task Run 是某次 flow run 里该 task 的一次执行。 |
| **E ZenML** | **Pipeline / Step**：`@pipeline`、`@step` 装饰的函数，即 DAG 定义；Step 间依赖由数据流或 `after=` 指定。 | **Pipeline Run**：执行一次 pipeline 函数（如 `my_pipeline()`）产生一个 pipeline run，会记录状态、artifacts、metadata。 | Pipeline = 流水线定义；Pipeline Run = 跑一遍这条流水线。Step 是步骤定义，每次 run 里每个 step 会有对应的 step run。 |
| **F DagsHub** | **无内置编排**。若与方案 A 组合：画布 + Ray 是「定义」；若单看 DagsHub：**Repository** 是项目容器，**MLflow Experiment** 是实验容器。 | **Run** 在 DagsHub/MLflow 语境下指 **MLflow Run**（一次实验记录）。编排若在外部，则「一次执行」由外部系统定义（如方案 A 的 PipelineRun）。 | 不提供自己的 Task/Pipeline/Run 编排模型；Run = MLflow run 或外部系统的 run。 |
| **G Valohai** | **Pipeline**：valohai.yaml 里 `- pipeline:` 段，定义 nodes（Execution/Task/Deployment）+ edges。**Step**：valohai.yaml 里 `- step:` 段，定义单步（image、command、inputs、outputs）。**Node** 是 Pipeline 里的一个节点，可指向某 step 或为 Task/Deployment。 | **Pipeline 的一次运行**：文档用 "pipeline run"、 "run"（如 "toggle reuse for individual pipeline runs"）。每个 node 在该次运行中对应一次 **Execution**（单步执行）。 | Pipeline = DAG 定义；一次「跑这个 pipeline」= 一次 pipeline run；Execution = 该次 run 里某一个 step 的一次执行。 |
| **H Kubeflow** | **Pipeline**：逻辑 DAG 定义（Component 组合 + 执行顺序/条件/参数与数据流）。**Component**：最小构建块（Python `@dsl.component` 或 YAML，含代码、依赖、镜像、Artifact/Parameter I/O）。**Step** = 某次 Run 中某 Component 的一次执行（可循环/条件多实例）。 | **Run**（或 Recurring Run）：提交 Pipeline 的一次执行；通过 `create_run_from_pipeline_func` / `create_run_from_pipeline_package` 或 UI 上传 IR YAML 触发。Experiment 为 Run 分组工作区。 | Pipeline + Component = 定义；Run = 一次执行；Step = 该次 Run 里某 Component 的实例。 |
| **I SageMaker** | **Pipeline**：`name` + `parameters` + `steps`（DAG）；同一 (account, region) 内 name 唯一。**Step**：管道中的一步，有类型（Processing、Training、Condition 等）与 `properties`（对应各 Job 类型的 Describe* 响应）。 | **Pipeline execution**：`pipeline.start(...)` 触发的一次执行；每次 start 产生新 execution，可传 `parameters` 覆盖默认值。 | Pipeline = 定义；Pipeline execution = 一次执行。 |

---

## 二、版本与 Artifact 怎么保存、记录？

| 方案 | 版本/Artifact 怎么存 | 按什么维度查历史 | 说明（白话） |
|------|----------------------|------------------|--------------|
| **B 火山引擎** | 调研文档写：**需自建或依托 Task 产出存储**；Experiment 只做**后置**的 config/summary/logs 追踪（如 WandB/TensorBoard），不负责 DAG 产物的版本化。 | 未提供「按 Run/Step 取历史 data」的一等 API；实验对比在 Experiment 面板看打点指标。 | **不明确**：Task 产出的 artifact 是否由平台统一存储、是否按 run/task 版本化，调研与 [火山引擎 MLP](https://www.volcengine.com/docs/6459/72301) 未写清。 |
| **C Metaflow** | 每个 **Task** 结束时，该 step 内赋给 `self` 的变量**自动序列化写入 datastore**（本地或 S3），成为该 Task 的 **DataArtifact**。大对象建议写路径到 artifact。 | **Run → Step → Task → artifact 名**：Client API 可访问任意历史 Run 的任意已完成 Step 的产出（Time Travel）。路径示例：`Run('HelloFlow/2')['start']['1'].data.xxx`。 | 每 Run 每 Step（Task）的 artifact 都持久化、可追溯；版本隐含在 Run+Step+Task 里。 |
| **D Prefect** | **Result** 可持久化；**Artifact** 支持 link/markdown/table 等，同一 key 可多版本、lineage 在 UI/CLI 可见。大对象需应用层写对象存储 + 自管版本。 | **无**「按 run_id + step 取任意历史 data」的一等 API；`Artifact.get("key")` 取**最新版本**。要按 run/step 查历史需自建元数据与存储。 | 小/展示型用 Artifact；大数据用 Result 或外部存储，版本与 lineage 部分在 Prefect、部分自建。 |
| **E ZenML** | Step 的输入输出在 **Artifact Store** 中自动存储、**版本化**并记录 **lineage**。Pipeline Run 会记录该 run 下各 step 的 artifacts、metadata。 | **Pipeline Run → Step → output 名**：`client.get_pipeline_run(run_id).steps["step_name"].outputs["name"].load()`；也可 `get_artifact_version("name", "version")` 按 artifact 名/版本取。 | 每 Run 每 Step 的 artifact 都进 Artifact Store，按 run/step 或按 artifact 名版本查。 |
| **F DagsHub** | 实验与 artifact 通过 **MLflow** 记录（每 repo 一个 MLflow Server）；数据集版本用 **DVC**。编排在外部时，产物由外部写 S3 等，同时可 log 到 MLflow。 | 按 **MLflow run/artifact** 查询；数据版本用 DVC（dataset 等）。 | 版本与 artifact 在 MLflow/DVC；DagsHub 本身不定义「Task 产出」的存储，由 MLflow 与外部编排决定。 |
| **G Valohai** | 写入 `/valohai/outputs/` 的文件自动上传，得到 **datum://** 不可变链接；每个 datum 包含代码、参数、execution、时间、内容。Lineage 完整。 | 按 **execution**（即某次 step 运行）或 **datum** 查询；界面/API 可按 pipeline run、execution 回溯。 | 每个 execution 的产出都有 datum 链接，版本与 lineage 由平台记录。 |
| **H Kubeflow** | **Pipeline Root** 配置对象存储根路径；**Artifact**（Dataset、Model 等）与 **Parameters** 由 Component 产出与消费，在 Pipeline Root 下持久化。支持 Caching（按 task 复用）。 | 按 **Run → Step** 在 UI/API 可查历史 Run、各 Step 状态与产出。 | metadata 与 Artifact 存 Pipeline Root；按 Run/Step 维度追溯。 |
| **I SageMaker** | Step 产存在 **S3**；通过各 Step 的 **properties**（Describe* 响应）在 Pipeline 定义中引用（JsonPath）。无统一「按 Run/Step 取历史 artifact」的 Time Travel API。 | 按 **execution ARN + step 名** 或 List/Describe Pipeline Execution API 查历史；结合 S3 路径访问实际数据。与 SageMaker Experiments / Model Registry 集成。 | 产出在 S3，经 properties 引用；历史需 Describe/List + S3。 |

---

## 三、执行计划明细（DAG + 参数等）承载在 Task 维度还是 Run 维度？

| 方案 | DAG 结构放在哪 | 某次运行的参数/配置放在哪 | 说明（白话） |
|------|----------------|---------------------------|--------------|
| **B 火山引擎** | **PipelineTemplate / Workflow**（YAML）：taskTemplates + tasks 的 DAG。 | 调研与官网未明确「某次工作流运行」是否有一套独立于模板的 run 级参数（如覆盖某 task 的镜像、资源、入参）。 | **不明确**：执行计划是只在模板维度，还是某次「运行」也有自己的配置覆盖，[火山引擎 MLP 文档](https://www.volcengine.com/docs/6459/1109772) 未在检索中给出明确说法。 |
| **C Metaflow** | **Flow**（代码）：DAG 由 FlowSpec 类 + `@step` + `self.next(...)` 定义。 | **Run**：Parameters 在 Flow 类上定义，**run 时**通过命令行传入（如 `--alpha 0.6`）。每次 `run` 产生一个 Run，该 Run 的 parameters 即本次执行的参数，**Resume 时不能修改**，沿用原 Run。 | 执行计划 = Flow 的 DAG（定义）+ 该 Run 的 parameters（承载在 **Run**）。 |
| **D Prefect** | **Flow**（代码）：DAG 由函数调用关系形成。 | **Flow Run**：每次调用 flow 函数即产生一个 flow run，**传入函数的参数即该次 run 的参数**。Pause 后 resume 可带 `run_input`（Pydantic），相当于「对当前 flow run 提交后续输入」。 | 执行计划 = Flow 的 DAG（定义）+ 该 **Flow Run** 的参数与 run_input（承载在 **Run**）。 |
| **E ZenML** | **Pipeline**（代码）：DAG 由 pipeline 函数内调用的 step 及数据流/`after=` 定义。 | **Pipeline Run**：执行 pipeline 时可传入 **pipeline 参数**、**step 参数**；ZenML 会记录到该次 run。Snapshot 是「Pipeline 的不可变快照（DAG+代码+配置）」；从 Snapshot 触发 run 时可带 run_configuration。 | 执行计划 = Pipeline 的 DAG（定义）+ 该次 **Pipeline Run** 的 configuration（参数等，承载在 **Run**）。 |
| **F DagsHub** | 无内置 DAG；若用方案 A，画布是「定义」，在外部系统。 | **MLflow Run** 记录实验参数与 artifact；「执行计划」若指画布配置，则在外部系统（如方案 A 的 RunConfig）。 | 不适用：执行计划在外部编排系统；DagsHub 只记录实验/artifact。 |
| **G Valohai** | **Pipeline**（valohai.yaml）：`- pipeline:` 下 nodes + edges。**Step**（valohai.yaml）：`- step:` 定义单步。 | 某次 **pipeline run** 可带 run 级配置：[Reuse](https://docs.valohai.com/pipelines/reuse-nodes) 文档提到可 "per-run in the web interface" toggle reuse，说明 **run 级**有配置。Step 的默认 inputs/parameters 在 yaml（Task 维度）。 | DAG 在 **Pipeline/Step**（yaml）；某次运行的覆盖/参数可在 **Run** 维度（界面或 API 指定）。**是否所有参数均可 run 级覆盖**在调研与检索的 Valohai 文档中未逐一写明。 |
| **H Kubeflow** | **Pipeline**（Python/IR YAML）：DAG 由 Component 组合 + 数据流与条件定义。 | **Run**：提交 Run 时传入参数（如 `create_run_from_pipeline_func(..., parameters={...})`）；即某次运行的参数承载在 **Run** 维度。 | DAG 在 Pipeline（定义）；某次 Run 的参数在提交 Run 时传入。 |
| **I SageMaker** | **Pipeline**：DAG 由 steps 的**数据依赖**（上游 properties 作为下游输入）+ **DependsOn**（自定义依赖）决定。参数在 Pipeline 的 `parameters` 中声明。 | **Pipeline execution**：`pipeline.start(parameters=...)` 覆盖默认参数；某次执行的配置在 **execution**（即 Run）维度。 | DAG 在 Pipeline（steps + 依赖）；某次运行的参数在 start 时覆盖。 |

---

## 四、CheckPoint 中断后微调了 Pipeline 配置，再从上次 SavePoint 继续：各方案是改 Task 配置还是改 Run 配置？

| 方案 | 典型操作是谁 | 改的是 Task 还是 Run | 说明（白话） |
|------|--------------|----------------------|--------------|
| **B 火山引擎** | 调研与官网未描述「执行到某节点暂停 → 用户改配置 → 从上一 SavePoint 继续」的标准流程。 | **不明确**：若平台支持类似能力，无法从现有调研与 [火山引擎 MLP](https://www.volcengine.com/docs/6459/72301) 判断是改 Workflow/Task 模板还是改「某次运行」的配置。 | 调研文档与检索到的官网均未提供该场景的明确说明。 |
| **C Metaflow** | **Resume**：`python flow.py resume` 从失败步继续，**此前成功步复用**。文档明确：Resume 时**不能修改** Flow 的 Parameters 与 Config，**沿用原 Run 的参数**。 | 若要「改配置再继续」= 用**新参数**起一个**新 Run**（`python flow.py run --alpha 0.02`），不能在同一次 Run 里改参数后 resume。从历史某步的 artifact 继续需用 Client API 取 artifact 作为新 Run 的输入或起点。 | **改的是「新 Run」**：原 Run 不能改参数；改配置 = 新 Run，可依赖已持久化的 artifact（Time Travel）。 |
| **D Prefect** | **Resume**：对当前 **flow run** 调用 `resume_flow_run(run_input={...})`，可提交 **run_input**（如择优结果、选中的模型路径）。Flow 代码与 task 定义不变。 | 微调「再继续」时的输入（如择优结果）= 对**当前 Flow Run** 提交 run_input，即 **Run 维度**。若改的是 flow 代码或 task 逻辑，那是改「定义」，下次新 flow run 才会用新代码。 | **改 Run 的输入**：CheckPoint 后继续 = 对当前 run 提交 run_input，不改 Task/Flow 定义。 |
| **E ZenML** | 无「从失败 Run 原地 Resume」的 API；做法是**重新跑同一 Pipeline**，Step 缓存会复用已成功 step。若改参数，则**新的一次 pipeline 调用**（新 Run）带新参数。 | 改配置 = **新 Pipeline Run**（新参数）；复用的是**缓存**（相同 code/inputs/params 的 step 不重算），不是「在原 Run 上改配置」。 | **改的是新 Run**：用新参数再跑一次 pipeline；旧 run 的 step 输出通过缓存被新 run 复用。 |
| **F DagsHub** | 无编排与 CheckPoint/SavePoint；该场景由**外部系统**（如方案 A 画布）实现。DagsHub 只记录实验与 artifact。 | 不适用：若外部是方案 A，则「改配置再继续」在外部系统里是改 **Run** 的配置（如 RunConfig）还是改画布模板，由外部设计决定。 | 编排在外部；DagsHub 不定义 Task/Run 的配置承载。 |
| **G Valohai** | **Reuse nodes**：可复用前面 steps 的历史 Execution，从某步开始用**新参数/新代码**跑后续。可在界面或 API 为某 node 指定「用某次历史 execution 的输出」或让系统自动匹配复用。 | 若「微调」指只改某几步的**输入/参数**而不改 yaml 里 step 定义：应在**该次 pipeline run** 的配置里覆盖（**Run 维度**），Valohai 支持 run 级配置（如 per-run toggle reuse）。若改的是 step 的默认值或 DAG 结构，则改 **valohai.yaml**（Task/Pipeline 维度）。 | **视改什么而定**：只改这次跑的参数/输入 = **Run 维度**；改 step 定义或 DAG = **Task/Pipeline 维度**（改 yaml）。 |
| **H Kubeflow** | 检索到的 [Kubeflow Pipelines 文档](https://www.kubeflow.org/docs/components/pipelines/overview/) 中**未**找到「从失败 Step 继续且允许修改参数」的明确说明（无等效 Metaflow Resume / Prefect run_input）。支持按 task 的 **Caching** 复用相同输入/配置的 Step 产出。 | **不明确**：若需「改配置再继续」，是否仅能通过新 Run + 缓存复用实现，以最新 KFP 文档或源码为准，本表不编造。 | 未明确 Resume 改参；Caching 可复用已成功 Step。 |
| **I SageMaker** | **Selective execution**：新 execution + `SelectiveExecutionConfig(selected_steps=[...], source_pipeline_execution_arn=..., reference_latest_execution=...)`；未选中 step 复用 reference execution 的产出；可选 `build_parameters_from_execution` + `parameter_value_overrides` 覆盖参数。 | 改配置再继续 = **新 execution**（Run 维度），指定 selected_steps 与 reference execution，parameters 可覆盖；等价于「新 Run、复用上游、改参重跑下游」。 | **改 Run（execution）**：Selective execution 实现部分重跑 + 参数覆盖。 |

---

## 五、分方案小结（白话）

- **B 火山引擎**：Workflow/PipelineTemplate = 定义，Task = DAG 节点；「一次运行」的正式名称、执行计划与 artifact 是否在 Run 维度承载、CheckPoint 后改配置改谁，**调研与官网均未写清**，表中已标不明确。
- **C Metaflow**：Flow = 定义，Run = 一次执行；Step/Task、Artifact 按 Run/Step/Task 存且可 Time Travel；执行计划在 Run（parameters）；Resume **不能改参数**，要改配置只能**新 Run**。
- **D Prefect**：Flow/Task = 定义，Flow Run/Task Run = 一次执行；Artifact 有 key 版本、无按 run/step 的一等 API；执行计划在 Run（调用参数 + run_input）；CheckPoint 后继续 = **改当前 Run 的 run_input**，不改 Task/Flow 定义。
- **E ZenML**：Pipeline/Step = 定义，Pipeline Run = 一次执行；Artifact 按 run/step 存、可 Time Travel；执行计划在 Run（configuration）；无原地 Resume，改配置 = **新 Run**，靠缓存复用已成功 step。
- **F DagsHub**：无自有 Task/Pipeline；Run = MLflow run 或外部 run；版本与 artifact 在 MLflow/DVC；执行计划与 CheckPoint 后改谁**由外部编排系统**决定。
- **G Valohai**：Pipeline/Step = 定义，Pipeline run + Execution = 一次执行；datum 版本化、lineage 完整；执行计划 DAG 在 yaml，run 级可覆盖部分配置；CheckPoint 后微调 = 若只改参数/输入则 **Run 维度**，若改步骤定义则 **Task/Pipeline 维度**。
- **H Kubeflow**：Pipeline + Component = 定义，Run = 一次执行，Step = 某 Run 中某 Component 的实例；Artifact/Parameter 存 Pipeline Root，按 Run/Step 可查；某次 Run 参数在提交 Run 时传入；**Resume 且改参数**在检索到的 KFP 文档中未明确，不编造。
- **I SageMaker**：Pipeline（name + parameters + steps）= 定义，Pipeline execution = 一次执行；DAG 由数据依赖（properties 引用）+ DependsOn 决定，参数在 execution 的 start 时覆盖；Selective execution = 新 execution + 复用上游 + 可选参数覆盖，实现「改配置再继续」。

---

## 六、引用与出处

- [竞品调研_火山引擎机器学习平台](./竞品调研_火山引擎机器学习平台.md)；[火山引擎 MLP 文档](https://www.volcengine.com/docs/6459/72301)；[创建工作流](https://www.volcengine.com/docs/6459/1109772)。
- [竞品调研_Metaflow](./竞品调研_Metaflow.md)；[Metaflow Basics](https://docs.metaflow.org/metaflow/basics)；[Metaflow Debugging (Resume)](https://docs.metaflow.org/metaflow/debugging)；[Client API](https://docs.metaflow.org/api/client)。
- [竞品调研_Prefect](./竞品调研_Prefect.md)；[Prefect Write and Run Workflows](https://docs.prefect.io/v3/how-to-guides/workflows/write-and-run)；[Resume Flow Run API](https://docs.prefect.io/v3/api-ref/rest-api/server/flow-runs/resume-flow-run)；[run_input](https://docs.prefect.io/v3/api-ref/python/prefect-input-run_input)。
- [竞品调研_ZenML](./竞品调研_ZenML.md)；[ZenML Core Concepts](https://docs.zenml.io/getting-started/core-concepts)；[Pipeline Snapshots](https://docs.zenml.io/concepts/snapshots)。
- [竞品调研_DagsHub](./竞品调研_DagsHub.md)；[DagsHub 文档](https://dagshub.com/docs/)；[MLflow 集成](https://dagshub.com/docs/integration_guide/mlflow_tracking/).
- [竞品调研_Valohai](./竞品调研_Valohai.md)；[Valohai Introduction](https://docs.valohai.com/)；[Pipelines](https://docs.valohai.com/pipelines/)；[Executions](https://docs.valohai.com/executions/)；[Execution Reuse](https://docs.valohai.com/pipelines/reuse-nodes)；[Data](https://docs.valohai.com/data/).
- [竞品调研_Kubeflow](./竞品调研_Kubeflow.md)；[Kubeflow Pipelines Overview](https://www.kubeflow.org/docs/components/pipelines/overview/)；[Concepts](https://www.kubeflow.org/docs/components/pipelines/concepts/)（Pipeline、Component、Step、Experiment、Run、Output Artifact、IR YAML）.
- [竞品调研_Amazon_SageMaker](./竞品调研_Amazon_SageMaker.md)；[SageMaker Pipelines overview](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-overview.html)；[Pipeline structure and execution](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-pipeline.html)；[Steps](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-steps.html)；[Step types](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-steps-types.html)；[Parameters](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-parameters.html)；[Caching](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-caching.html)；[Selective execution](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-selective-ex.html).
