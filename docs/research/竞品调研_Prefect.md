# 竞品调研：Prefect v3

**来源出处**：[Prefect v3 官方文档](https://docs.prefect.io/v3/get-started) / [Prefect GitHub](https://github.com/PrefectHQ/prefect)

## 1. 来源与概述

Prefect 是开源的工作流编排引擎，用纯 Python 将函数转为可追踪、可恢复的数据管道。v3 强调：无 DSL/YAML、原生 Python 控制流（if/else、循环、动态 task）、State & Recovery、Event-Driven、Dynamic Runtime、现代 UI 与 CI/CD 友好。

**与本文档的关系**：与 [竞品调研_火山引擎机器学习平台.md](./竞品调研_火山引擎机器学习平台.md)、[竞品调研_Metaflow.md](./竞品调研_Metaflow.md) 同属架构层竞品调研，作为 **Canvas DAG 备选方案 D**。重点考察其状态恢复、人工暂停/择优、与 ML Pipeline（SavePoint/CheckPoint、多路 Tune、独立推理画布）的匹配度，以及相对方案 A/B/C 的差异。

## 2. 核心概念

- **Flow / Task**：`@flow` 与 `@task` 装饰器定义工作流；支持 child flows、task mapping、运行时动态生成 task。
- **Run**：一次 flow 执行称为 flow run；任务级为 task run。
- **编排方式**：纯 Python 代码，无 YAML/DSL；依赖关系由函数调用与返回值自然形成。

## 3. 状态与恢复

- **Resume**：从「暂停或失败」的 flow run 继续执行；[Resume Flow Run API](https://docs.prefect.io/v3/api-ref/rest-api/server/flow-runs/resume-flow-run) 支持带 `run_input` 恢复。
- **Task Cache**：`cache_key_fn` / `cache_policy` / `cache_expiration` 在开启 result persistence 后生效，可复用成功 task 结果、仅重跑失败及之后，等价于「从最近成功点恢复」的语义。

## 4. 人工暂停与择优

- **pause_flow_run(wait_for_input=...)** / **suspend_flow_run**：在 UI 中暂停，Resume 时提交类型校验的输入（Pydantic / RunInput）。
- 适合 **CheckPoint（择优）**：多路 Tune 完成后暂停，用户选定再 `resume_flow_run(run_input={...})` 进入 Model Inference。

## 5. Artifact 与 Time Travel

- **Artifact**：支持 link、markdown、table、image 等；同一 **key** 可多版本、lineage 在 UI/CLI 可见；`Artifact.get("key")` 取**最新版本**。
- **局限**：Artifact 偏向元数据与展示，并非「Step 产出大数据（encoder、dataset、model）」的版本化存储；**无** Metaflow 式「按 run_id + step 取任意历史 Run 的 data artifact」的一等 Client API。大对象需用 Result 持久化或外部存储，由应用层维护版本与 lineage。

## 6. 与现有 Ray / risk_model_on_ray 集成

- 无内置 Ray 集成；在 `@task` 内调用现有 Ray 脚本或 risk_model_on_ray 即可，路径与存储需在应用层自行管理（与方案 A 类似）。

## 7. 与方案 A / B / C 的对比

| 维度 | 方案 A | 方案 B | 方案 C（Metaflow） | Prefect（方案 D） |
|------|--------|--------|--------------------|-------------------|
| **执行粒度** | 画布 Node | Task（高自由度） | Step / Task | Task / Flow |
| **编排方式** | 画布 DAG + 平台调度 | YAML PipelineTemplate + tasks | 代码 FlowSpec + @step | 纯 Python @flow/@task |
| **结果保留策略** | 每 Node 仅当前 Run 最新结果 | 需自建或依托 Task 产出存储 | 每 Run 每 Step Artifact 持久化、多版本 | Result 持久化 + 可选 Artifact（key 多版本）；大对象需自建存储 |
| **断点恢复 / 重跑** | 手动触发上游再序贯重跑 | 需在 Task/平台层自设计 | Resume 复用成功步，仅重跑失败步及之后 | Resume + task cache：等价「从最近成功点恢复」 |
| **Time Travel** | 无 | 无内置 | 内置：Client API 访问任意 Run/Step 的 data | 部分：Artifact 有 key 的版本/lineage，无按 run/step 取历史 data 的一等 API |
| **与 Ray / risk_model_on_ray 集成** | 易对齐现有调度与 Run 模型 | 需将 Step 封装为 Task 镜像/脚本 | 需封装为 Step 或通过 artifact 传路径调 Ray | 与 A 类似：Task 内调 Ray/脚本，自管路径与存储 |
| **学习与运维成本** | 低 | 中高（YAML、K8s/Argo） | 中（Python + @checkpoint） | 中低：Python 为主，需 Prefect Server/Cloud 或自建 |

## 8. 基于 Prefect 实现内部模型探索 SOP 的要点

- **Pipeline Meta**：Flow 级参数或首 task 承载元信息、资源等。
- **数据源 → WOE Fit → Feature Selection → WOE Merge**：每个画布节点对应一个或多个 task；SavePoint 通过 task cache 或显式写入外部存储（如 S3）并记录路径实现；CheckPoint 用 `pause_flow_run(wait_for_input=...)` 在指定节点暂停，用户确认或提交择优结果后 resume。
- **多路 Tune 合并择优**：动态分支（多 task 或 child flow）并行跑不同搜索策略/参数，汇总结果后在择优节点 pause，resume 时 `run_input` 传入选定子路径或模型路径，再执行 Model Train / Model Inference。
- **Model Inference 独立画布**：独立 flow，入口参数接收「某次 Run 的模型/artifact 路径」，仅数据源 + 推理即可组成最小可执行画布。
- **缺口**：若需「按 run/step 访问历史 data」的 Time Travel，需在 task 内自建「产出写对象存储 + 元数据记录 run/step/路径」及查询/加载接口。

## 9. 参考链接

- [Prefect v3 Get Started](https://docs.prefect.io/v3/get-started)
- [Prefect v3 Write and Run Workflows](https://docs.prefect.io/v3/how-to-guides/workflows/write-and-run)
- [Prefect v3 Interactive (pause/resume)](https://docs.prefect.io/v3/advanced/interactive)
- [Prefect v3 Artifacts](https://docs.prefect.io/v3/how-to-guides/workflows/artifacts)
