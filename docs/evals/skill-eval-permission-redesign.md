# Skill Eval：权限设计改造 — 有无 platform-product-builder 的输出对比

## 评测设置

### 共享 Prompt

> **背景**：当前平台的 biz_team 控制了资源 directory，View / Editor / (Owner) / Admin 分别对应着用户在对应 biz_team 下的可读、可写、可管理的权限。一个用户可以被分到多个 biz_team，可能在多个 Team 有不同的权限。
>
> **问题**：下游消费场景里，也绑定到了不同 biz_team，但 biz_team 限制了上游数据资产的跨 Team 复用。
>
> **要求**：Refine 当前的权限设计，给出几种改进思路以及最推荐的改造方案。

### 评测维度


| 维度        | 定义                                  |
| --------- | ----------------------------------- |
| **结构完整性** | 是否覆盖问题定义、影响分析、方案对比、推荐理由、落地影响        |
| **分层清晰度** | 数据层、逻辑层、API 层、应用层、可观测性层是否分别考虑       |
| **可执行性**  | 方案能否直接用于工程实施，是否有明确的数据模型、权限矩阵、迁移路径   |
| **边界感**   | 是否明确 In Scope / Out of Scope，避免范围蔓延 |
| **权衡透明度** | 是否对每个备选方案列出 trade-off 而非只推一个        |


---

## Output A：不使用 Skill（通用 LLM 直出）

---

### 问题分析

当前 `biz_team` 既是组织归属单元又是资源隔离边界。这在单团队场景下工作良好，但在以下场景出现问题：

1. **跨团队模型复用**：Team A 训练的 Model / Build 无法被 Team B 的 Experiment 引用
2. **共享数据资产**：多个 Team 共用同一张 Hive 宽表做训练，但各自的 Model 和 Experiment 相互不可见
3. **下游消费隔离**：线上 Serving 团队（如风控策略组）需要使用多个 Team 产出的 Build，但自身只属于一个 biz_team

### 改进思路

#### 思路一：跨团队显式授权（最小改动）

在现有 biz_team 隔离基础上，增加 **资源共享授权** 机制：

- Model Owner 可以将 Model / Build 授权给其他 biz_team（只读或引用权限）
- 新增 `resource_share` 表：`resource_type`, `resource_id`, `from_team`, `to_team`, `permission`, `granted_by`, `expires_at`
- 被授权方在资源列表中看到带 "共享" 标签的资源

**优点**：改动小，向后兼容
**缺点**：授权关系多时管理复杂；每次新增消费需手动授权

#### 思路二：引入 Workspace / Project 概念

在 biz_team 之上或之旁引入 **Workspace**（项目空间），Workspace 可以跨 biz_team 聚合资源：

- Workspace 有独立的成员列表和角色
- 资源归属仍在 biz_team，但可以被"关联"到 Workspace
- 消费方通过 Workspace 发现和使用资源

**优点**：清晰的项目协作语义
**缺点**：引入新概念，学习成本高；需要处理 Workspace 与 biz_team 的权限叠加

#### 思路三：资源级 ACL（细粒度权限）

抛弃 biz_team 作为唯一隔离边界，改为每个资源（Model、Experiment、Build）独立维护 ACL：

- 每个资源有 owner、read_acl、write_acl
- ACL 条目可以是 user_id 或 team_id
- biz_team 退化为默认 ACL 模板

**优点**：最灵活
**缺点**：权限爆炸，审计困难；对现有架构改动最大

### 推荐方案

推荐 **思路一**，原因：

- MVP 阶段跨团队需求有限
- 改动可控，可在 1-2 个迭代落地
- 后续可从思路一平滑演进到思路二

### 实施建议

1. 新增 `resource_share` 表
2. Model / Build 的 View 接口增加共享资源查询
3. 前端资源列表增加 "共享给我" 过滤标签
4. 后续根据使用频率决定是否引入 Workspace

---

## Output B：使用 platform-product-builder Skill（分层框架驱动）

---

### Step 0 — 产品类型确认

本次改造属于 **功能型（平台类）产品** 的权限层迭代。核心关切是 **工作流（任务）**：数据资产的生产（训练团队）与消费（策略/部署团队）之间的权限壁垒。

当前产品处于 **One-to-Ten** 阶段——平台已上线、核心训练流程已跑通，权限是在使用规模增长后暴露的结构性问题。应 **聚焦问题所在的层（数据层 + 逻辑层）**，不重新设计已经工作的部分。

---

### Layer 1 — 战略层 Strategy

#### 问题陈述

当前 `biz_team` 既承担 **组织归属**（用户属于哪个团队）又承担 **资源隔离**（资源对谁可见）两个正交职责。当平台用户规模从单团队扩展到跨团队协作时，这两个职责产生冲突：


| 场景                              | 当前行为                                | 期望行为                            |
| ------------------------------- | ----------------------------------- | ------------------------------- |
| Team A 的 Build 被 Team B 的线上策略引用 | 不可见，需 Admin 手动干预                    | 资产 Owner 自助授权，消费方可发现并引用         |
| 多 Team 共用同一 Hive 宽表             | 各 Team 独立创建 Experiment，不知对方已有同表训练结果 | 可跨 Team 搜索已有 Model/Build，避免重复训练 |
| 风控策略组同时消费 5 个 Team 的 Build      | 需在 5 个 Team 各有 Viewer 身份，切换上下文查看    | 在统一视图中看到所有被授权的 Build            |


**根因**：`biz_team` 是一个 **一维** 隔离模型，而实际的协作拓扑是 **多维** 的（同一用户既是生产者又是消费者、同一资源被多团队消费）。

#### North Star 连接

平台 North Star = **周活跃 Experiment 数 × Run 成功率**。跨团队复用直接提升这两个因子：

- 减少重复训练 → 提升有效 Experiment 数
- 使用经过验证的 Build 作为 baseline → 提升 Run 质量

#### 目标用户


| 角色               | 痛点                             | 期望                            |
| ---------------- | ------------------------------ | ----------------------------- |
| **算法工程师（生产者）**   | 不知道其他 Team 是否已有类似 Model，导致重复训练 | 可跨 Team 搜索 Model/Build 元信息    |
| **策略 / DS（消费者）** | 需要引用多 Team 的 Build，但权限隔离阻断     | 被授权后在统一列表中发现和引用               |
| **TeamOwner**    | 无法自助管理本 Team 资源的外部共享           | 自助授权 + 审计日志                   |
| **Admin**        | 所有跨 Team 请求都需要 Admin 介入        | 下放共享权限给 Owner，Admin 仅做策略配置和审计 |


---

### Layer 2 — 范围层 Scope

#### In Scope


| 编号   | 能力            | 说明                                                             |
| ---- | ------------- | -------------------------------------------------------------- |
| S-01 | **资源共享授权**    | Owner/TeamOwner 可将 Model / Build **只读引用权** 授予其他 biz_team 或指定用户 |
| S-02 | **共享资源发现**    | 被授权方在 Model / Build 列表中可见共享资源（带标识）                             |
| S-03 | **跨 Team 引用** | Experiment 的数据源配置可引用被授权的其他 Team 的 Build 作为 S3 输入               |
| S-04 | **共享审计日志**    | 记录授权/撤销/引用动作，TeamOwner 和 Admin 可查看                             |
| S-05 | **共享策略配置**    | Admin 可全局配置：是否允许跨 Team 共享、默认共享范围（全平台 / 指定 Team）                |


#### Out of Scope（及原因）


| 排除项                       | 原因                                                    |
| ------------------------- | ----------------------------------------------------- |
| Workspace / Project 概念    | 引入新抽象层增加概念负担，在当前阶段跨 Team 授权已足够；若共享关系超过 50 条/Team 时再考虑 |
| 资源级 ACL（per-resource 细粒度） | 权限爆炸风险；与统一 RBAC 设计哲学冲突；当前阶段 Team 粒度 + 资源粒度的两级模型足够     |
| Experiment 跨 Team 共享      | Experiment 含配置与执行状态，共享语义复杂；仅共享只读产物（Model/Build）       |
| 跨 Team 的 Run 触发           | 安全风险高，需额外的审批流；本期不开放                                   |
| 计算资源配额跨 Team 共享           | 配额与组织预算绑定，不适合在权限层改造时打开                                |


#### 非功能性需求


| 需求     | 指标                                      |
| ------ | --------------------------------------- |
| 共享授权延迟 | 授权生效 ≤ 5s（非最终一致）                        |
| 列表查询性能 | 含共享资源的列表 P95 ≤ 300ms（共享资源 ≤ 100 条/Team） |
| 审计日志保留 | ≥ 180 天                                 |
| 向后兼容   | 现有 API 不破坏；共享能力通过新 endpoint 和查询参数暴露     |


#### 数据模型影响

新增实体 **ResourceShare**：


| 字段             | 类型                                   | 说明                                          |
| -------------- | ------------------------------------ | ------------------------------------------- |
| id             | string (ULID)                        | 主键                                          |
| resource_type  | enum: `MODEL`, `BUILD`               | 被共享资源类型                                     |
| resource_id    | string                               | 被共享资源 ID                                    |
| source_team_id | string                               | 资源所属 biz_team                               |
| target_type    | enum: `TEAM`, `USER`                 | 授权目标类型                                      |
| target_id      | string                               | 目标 biz_team 或 user_id                       |
| permission     | enum: `VIEW`, `REFERENCE`            | VIEW = 可查看元信息；REFERENCE = 可在 Experiment 中引用 |
| granted_by     | string                               | 授权人 user_id                                 |
| granted_at     | timestamp                            | 授权时间                                        |
| expires_at     | timestamp (nullable)                 | 过期时间，null = 永不过期                            |
| revoked_at     | timestamp (nullable)                 | 撤销时间                                        |
| status         | enum: `ACTIVE`, `EXPIRED`, `REVOKED` | 当前状态                                        |


**现有实体影响**：

- `Model` / `Build` 查询接口增加 `include_shared=true` 参数
- Permission 校验中间件增加 ResourceShare 查表逻辑

#### API 变更


| 方法     | 路径                                   | 说明                              |
| ------ | ------------------------------------ | ------------------------------- |
| POST   | `/api/v1/shares`                     | 创建共享授权                          |
| GET    | `/api/v1/shares`                     | 查询共享列表（by resource 或 by target） |
| DELETE | `/api/v1/shares/{share_id}`          | 撤销共享                            |
| GET    | `/api/v1/models?include_shared=true` | 现有列表增加共享过滤                      |
| GET    | `/api/v1/builds?include_shared=true` | 现有列表增加共享过滤                      |


---

### Layer 3 — 结构层 Structure

#### User Story


| 编号    | Story                                                                                   |
| ----- | --------------------------------------------------------------------------------------- |
| US-01 | 作为 **TeamOwner**，我希望将本 Team 的某个 Build 共享给另一个 biz_team，以便对方在其 Experiment 中引用该 Build 作为输入 |
| US-02 | 作为 **算法工程师（消费者）**，我希望在 Model / Build 列表中看到其他 Team 共享给我的资源，以便复用已验证的模型产物                  |
| US-03 | 作为 **TeamOwner**，我希望查看本 Team 资源的所有共享记录，以便审计谁在使用我们的产物                                    |
| US-04 | 作为 **Admin**，我希望配置全局共享策略（允许 / 禁止 / 需审批），以便控制平台的开放度                                      |
| US-05 | 作为 **TeamOwner**，我希望随时撤销某条共享授权，以便在资产退役或安全事件时快速切断访问                                      |


#### 页面结构影响

```
Model Management（模型管理页）
├── Model List — 增加 "共享给我" 过滤标签 [S-02]
│   └── Model Detail — 增加 "共享管理" Tab [S-01, S-04]
│       ├── 共享列表（谁被授权、什么权限、何时过期）
│       └── 新增共享（选择 target team/user + permission + 可选过期时间）
└── Build List — 同上
    └── Build Detail — 同上

Platform Settings（仅 Admin 可见）
└── 共享策略配置 [S-05]
    ├── 全局开关：是否允许跨 Team 共享
    ├── 默认共享范围：全平台 / 仅白名单 Team
    └── 审计日志查看入口 [S-04]
```

---

### Layer 4 — 框架层 Skeleton


| 编号    | 功能需求                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | **Model / Build 列表 — 共享过滤标签** — 页面顶部过滤栏新增 Tab「本 Team」|「共享给我」|「全部」— 点击切换 → 列表数据刷新，共享资源行左侧显示来源 Team 徽标                                                                                        |
| FR-02 | **Model / Build Detail — 共享管理 Tab** — Detail 页新增「共享」Tab — 展示当前资源的所有 ResourceShare 记录（data table：目标 Team/用户、权限类型、授权人、过期时间、状态）— 行尾「撤销」按钮 → PopConfirm → 调用 DELETE /shares/{id} → 乐观更新 + Toast |
| FR-03 | **新增共享 — 抽屉表单** — 「共享」Tab 右上角「新增共享」按钮 → 右侧 Drawer — 表单：target_type (Team/User) → target 搜索选择 → permission (VIEW/REFERENCE) → expires_at (可选) → 提交 → POST /shares → 成功 Toast + 列表刷新          |
| FR-04 | **Experiment 数据源配置 — 跨 Team Build 引用** — DataSource Type=S3 的路径输入框增加「从共享 Build 选择」快捷入口 → 弹窗列出 permission=REFERENCE 的共享 Build → 选中后自动填入 S3 artifact 路径                                       |
| FR-05 | **Admin 共享策略配置** — Platform Settings 新增「共享策略」卡片 — 全局开关 (Switch) + 默认范围 (Radio: 全平台/白名单) + 白名单 Team 多选 — 保存 → Toast                                                                          |
| FR-06 | **审计日志** — Admin Settings 或 TeamOwner 的共享管理页提供「审计日志」Tab — data table：时间、操作人、操作类型 (grant/revoke/reference)、资源、目标 — 支持时间范围过滤                                                                  |


---

### Layer 5 — 表现层 Surface

设计复用平台现有 Ant Design Pro 体系，无需新增设计系统。关键视觉要素：


| 元素     | 处理                                                 |
| ------ | -------------------------------------------------- |
| 共享资源标识 | 列表行左侧 `Tag` 组件，颜色 `#13c2c2`（主色），文案「来自 {team_name}」 |
| 权限类型标识 | `VIEW` = 灰色 Tag、`REFERENCE` = 蓝色 Tag               |
| 过期提醒   | 即将过期（≤ 7 天）的共享行显示橙色警告图标                            |
| 撤销确认   | Ant Design `PopConfirm`，文案「撤销后对方将无法访问此资源，是否继续？」    |


---

### 备选方案对比（含推荐理由）


| 维度                    | 方案 A：跨 Team 授权 (推荐)       | 方案 B：Workspace 模型                         | 方案 C：资源级 ACL             |
| --------------------- | ------------------------- | ----------------------------------------- | ------------------------ |
| **概念复杂度**             | 低 — 在现有 biz_team 上加一层共享关系 | 高 — 引入新实体、新角色、新导航                         | 中 — 概念简单但权限条目爆炸          |
| **数据模型改动**            | +1 表 (ResourceShare)      | +2 表 (Workspace, WorkspaceMember) + 多处 FK | 改造所有资源表增加 ACL 列或独立 ACL 表 |
| **向后兼容**              | 完全兼容 — 新 endpoint + 查询参数  | 需迁移 — 现有资源需绑定 Workspace                   | 需迁移 — 现有资源需初始化 ACL       |
| **权限审计**              | 简单 — ResourceShare 表即审计主表 | 中等 — Workspace 级 + Team 级交叉               | 困难 — 每个资源独立 ACL          |
| **扩展到 Experiment 共享** | 追加 resource_type 枚举值即可    | 天然支持                                      | 天然支持                     |
| **跨 Team 发现**         | 需额外搜索 — 仅授权后可见            | 天然支持 — Workspace 内全可见                     | 需额外搜索                    |
| **迁移成本**              | 1-2 Sprint                | 3-5 Sprint                                | 2-3 Sprint               |
| **适用规模**              | ≤ 50 共享关系/Team 表现良好       | 适合大规模多 Team 协作                            | 适合细粒度但规模小的场景             |


**推荐方案 A 的理由**：

1. **One-to-Ten 阶段原则**：在现有模型上叠加能力，而非重构基座
2. **改动面最小**：+1 数据表、+3 API endpoint、+2 前端页面变更
3. **平滑演进**：若共享规模超过阈值（>50 条/Team），可在方案 A 基础上演进为方案 B（ResourceShare 可作为 Workspace 成员关系的前身）
4. **审计友好**：单表记录所有授权关系，合规审计清晰

#### 演进路径

```
Phase 1 (当前)          Phase 2 (按需)           Phase 3 (长期)
biz_team 隔离     →    + ResourceShare 授权  →   + Workspace 聚合
                                                  (ResourceShare 迁移为
                                                   Workspace 成员关系)
```

---

### 成功指标


| 指标                      | 基线       | 目标     | 度量方式                                               |
| ----------------------- | -------- | ------ | -------------------------------------------------- |
| 跨 Team 资源引用次数 / 周       | 0        | ≥ 10   | `build_referenced` 事件中 source_team ≠ consumer_team |
| Admin 手动授权工单数 / 月       | ~15      | ≤ 3    | 运维工单系统                                             |
| 重复训练比例（同 Hive 表 + 相似配置） | 未知（需先采集） | 降低 30% | Experiment 配置 hash 去重分析                            |


---

### 事件追踪


| 事件                        | 触发条件                        | 属性                                                                                                | 回答的问题              |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| `share_granted`           | 创建共享授权                      | share_id, resource_type, resource_id, source_team, target_type, target_id, permission, granted_by | 共享活跃度、哪些 Team 最常共享 |
| `share_revoked`           | 撤销共享                        | share_id, revoked_by, reason                                                                      | 撤销频率、安全事件追踪        |
| `shared_resource_viewed`  | 消费方查看共享资源详情                 | resource_type, resource_id, viewer_id, viewer_team                                                | 共享资源使用热度           |
| `shared_build_referenced` | 消费方在 Experiment 中引用共享 Build | build_id, source_team, consumer_exp_id, consumer_team                                             | 跨 Team 复用实际转化率     |


---

## 质量对比分析

### 逐维度对比


| 评测维度      | Output A（无 Skill）                                  | Output B（有 Skill）                                                                | 差异说明                                                                            |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **结构完整性** | ⭐⭐⭐ 覆盖了问题、3 个方案、推荐和实施建议                            | ⭐⭐⭐⭐⭐ 覆盖战略→范围→结构→框架→表现 5 层 + 方案对比 + 成功指标 + 事件追踪                                  | Skill 版多出了 User Story、Page Structure、Skeleton FR、Surface 规范、非功能性需求、事件追踪 6 个关键板块 |
| **分层清晰度** | ⭐⭐ 扁平列表结构，问题/方案/建议三段式                              | ⭐⭐⭐⭐⭐ 严格按五层模型组织，每层有明确输入输出                                                        | 无 Skill 版所有内容在同一抽象层级；有 Skill 版可清晰看到哪些是战略决策、哪些是落地细节                              |
| **可执行性**  | ⭐⭐ 提到了 `resource_share` 表，但无字段定义；无 API 设计；前端改动一句带过 | ⭐⭐⭐⭐⭐ 完整的数据模型（含字段类型）、5 条 API 路径、6 条骨架级 FR（组件+位置+触发+响应）、Surface 视觉规范              | 这是最大差距 — 无 Skill 版工程师拿到后需要再做一轮设计；有 Skill 版可直接进入开发                               |
| **边界感**   | ⭐⭐ 仅列出 3 个方案，未明确说哪些不做                              | ⭐⭐⭐⭐⭐ 显式 Out of Scope 表格，每项附原因（Workspace 为什么不做、资源级 ACL 为什么不做、Experiment 共享为什么不做） | 无 Skill 版边界模糊 — 读者不清楚 Experiment 共享是否在范围内；有 Skill 版一目了然                         |
| **权衡透明度** | ⭐⭐⭐ 每个方案有简要优缺点                                     | ⭐⭐⭐⭐⭐ 8 维对比表（概念复杂度、数据模型改动、向后兼容、审计、扩展性、发现性、迁移成本、适用规模）+ 演进路径图                      | Skill 版的对比粒度更细，决策依据更充分                                                          |


### 总分对比


|               | Output A                                                   | Output B                                                     |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| **总分（25 分满）** | 12 / 25                                                    | 24 / 25                                                      |
| **适合用途**      | 早期头脑风暴、团队讨论时的方向指引                                          | PRD 评审、工程排期、设计走查的输入文档                                        |
| **缺失的关键板块**   | 数据模型细节、API 设计、骨架级 FR、非功能性需求、成功指标、事件追踪、Out of Scope 论证、演进路径 | 仅缺少 QA 影响分析（Skill 中标注为 "pervasive changes 时 required"，本次可追加） |


### 核心结论

**Skill 的价值不在于产出更多文字，而在于迫使思维覆盖每一层 —— 特别是容易被跳过的 Scope 边界定义和 Skeleton 交互细节。** 无 Skill 版的最大问题不是方向错误（方向一致），而是 **抽象层级不均匀** —— 战略层讲了，实施层只点到为止，框架层完全缺失。

对于平台型产品的权限改造这类系统性问题，Skill 的分层框架能将思考从"我有几个方案"提升到"每个方案在数据层/逻辑层/API 层/应用层/可观测性层分别意味着什么"，这是产出质量差异的根本来源。