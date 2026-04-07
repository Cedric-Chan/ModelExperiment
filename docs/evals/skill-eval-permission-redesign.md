# Skill Eval：platform-product-builder 三版本对比评测

本文档包含三组测试用例，对比以下三个 Skill 版本在不同类型需求下的输出质量差异。

## Skill 版本说明

| 版本 | 标识 | 来源 | 核心特征 |
|------|------|------|----------|
| **A. GitHub Reference Skill** | `product-manager-platform` | 工作区 `.cursor/skills/product-manager-platform/SKILL.md` | 扁平 PRD 模板（Problem Statement → Scope → User Stories → FR → NFR → Data Model → API → QA → Success Metrics）。无分层设计框架、无 Impact Triage、无 AI/LLM 论证 |
| **B. Refine 前 Builder Skill** | `platform-product-builder` (v1) | 全局 `~/.cursor/skills/platform-product-builder/SKILL.md`（Refine 前） | 五层 Garrett 模型（Strategy → Scope → Structure → Skeleton → Surface），**每次需求均完整输出全部五层**。无 Impact Triage、无 AI/LLM Justification |
| **C. Refine 后 Builder Skill** | `platform-product-builder` (v2) | 全局 `~/.cursor/skills/platform-product-builder/SKILL.md`（Refine 后） | 五层 Garrett 模型 + **Step 1 Impact Triage**（Chain-of-Thought 确定受影响层级写入集）+ **AI/LLM Justification**（Scope 层条件性 "Why LLM?" 五问） |

### Refine 变更摘要

**新增 Step 1 — Impact Triage**：在编写 PRD 前先输出影响分析——定位需求的起源层级，仅编写起源层及其上层，跳过未受影响的底层。避免小需求触发完整五层 PRD。

**新增 AI/LLM Justification**：当需求涉及 AI 能力时，Scope 层必须回答五个问题——使用什么 AI 能力、为什么需要动态判断、为什么优于替代方案、失败模式、成本与延迟边界。

---

# Test Case 1：权限系统跨 Team 复用改造（完整 Revamp）

> 此为原始评测用例，对比无 Skill 与有 Skill（Refine 前 Builder）的输出差异。

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

---

# Test Case 2：权限类型微调（小需求，验证 Impact Triage）

> 此用例测试 Refine 后新增的 **Impact Triage** 机制：面对一个小范围权限枚举拆分需求，Skill 是否能避免生成冗余的完整五层 PRD，而是精准定位受影响层级、仅输出必要内容。

## 评测设置

### 共享 Prompt

> **背景**：在已有的 ResourceShare 授权机制中，当前 `REFERENCE` 权限允许消费方在 Experiment 中引用共享 Build 的同时，也能查看 Build 的完整训练配置和 Artifact 列表。
>
> **需求**：出于数据安全考虑，希望将"查看训练配置详情"的能力从 `REFERENCE` 权限中拆出，新增一个 `VIEW_DETAIL` 权限等级。即 `REFERENCE` 仅允许引用 S3 产物路径，`VIEW_DETAIL` 才允许查看完整的训练超参数、特征列表和评估报告。
>
> **要求**：给出设计方案。

### 评测维度

| 维度 | 定义 |
|------|------|
| **冗余度** | 对于一个枚举拆分级别的小改动，是否产出了不必要的战略层/表现层内容 |
| **层级精准度** | 是否正确识别了受影响的设计层级和技术层级 |
| **可执行性** | 工程师能否拿到输出直接开发，无需二次设计 |
| **向后兼容分析** | 是否分析了现有 `REFERENCE` 授权记录的迁移策略 |

---

## Output A：GitHub Reference Skill（product-manager-platform）

---

### Problem Statement

当前 ResourceShare 机制的 `REFERENCE` 权限粒度过粗——同时赋予了"引用 S3 产物路径"和"查看完整训练配置"两个能力。部分场景下，资源 Owner 只希望消费方使用产物路径，不希望暴露训练超参数和特征工程细节。

### North Star Connection

权限粒度细化提升资产 Owner 的共享意愿（减少因担心配置泄露而拒绝共享），间接提升跨 Team 资源引用次数。

### Target Users

| 角色 | 需求 |
|------|------|
| TeamOwner（生产者） | 授权时可选择是否暴露训练详情 |
| 算法工程师（消费者） | 理解不同权限等级下可见内容的差异 |

### Scope

**In scope**：新增 `VIEW_DETAIL` 权限枚举值；拆分现有 `REFERENCE` 权限的能力边界；现有授权记录迁移。

**Out of scope**：ResourceShare 机制本身的架构变更；新增其他权限类型。

### User Stories

- 作为 TeamOwner，我希望在授权时可选择 `REFERENCE`（仅引用）或 `VIEW_DETAIL`（引用 + 查看详情），以便更精细地控制共享范围。
- 作为算法工程师（消费者），我希望在 Build 详情页看到权限不足时的明确提示，而不是空白页面。

### Functional Requirements

1. `ResourceShare.permission` 枚举扩展为 `VIEW` | `REFERENCE` | `VIEW_DETAIL`
2. Build Detail API 根据 `permission` 字段返回不同数据：`REFERENCE` 仅返回 `artifact_s3_path`；`VIEW_DETAIL` 返回完整配置
3. 新建共享表单中 permission 下拉框新增 `VIEW_DETAIL` 选项
4. 现有 `REFERENCE` 记录需按迁移策略处理（默认升级为 `VIEW_DETAIL` 以保持向后兼容）

### Non-Functional Requirements

- 权限变更生效延迟 ≤ 5s
- API 向后兼容：现有调用方不受影响

### Data Model Impact

- `ResourceShare.permission` 枚举增加 `VIEW_DETAIL`
- Build Detail API 增加权限级别校验逻辑

### API Changes

| 方法 | 路径 | 变更 |
|------|------|------|
| POST | `/api/v1/shares` | `permission` 字段接受新枚举值 |
| GET | `/api/v1/builds/{id}` | 根据 share permission 返回不同详情级别 |

### QA & Testing Impact

- **高风险面**：现有 `REFERENCE` 权限的消费方可能在升级后看到更多内容（如默认升级为 `VIEW_DETAIL`），需验证
- **回归范围**：共享授权创建、Build Detail 页面、Experiment 数据源引用流程

### Success Metrics

| 指标 | 基线 | 目标 |
|------|------|------|
| 使用 `REFERENCE`（仅引用）的新建共享占比 | 0% | ≥ 30%（表明 Owner 确实需要细粒度控制） |

---

## Output B：Refine 前 Builder Skill（完整五层输出）

---

### Step 0 — 产品类型确认

功能型平台类产品。One-to-Ten 阶段——在已有 ResourceShare 机制上做权限粒度细化。

---

### Layer 1 — 战略层 Strategy

#### 问题陈述

当前 `REFERENCE` 权限耦合了两个正交能力："引用 S3 产物路径用于下游训练"和"查看完整训练配置（超参数、特征列表、评估报告）"。对于部分保密要求较高的模型（如核心风控模型），Owner 希望允许其他 Team 引用产物但不暴露训练方法论。这种需求在当前权限模型下无法满足，导致 Owner 宁愿不共享，降低了平台的跨 Team 复用价值。

#### North Star 连接

平台 North Star = 周活跃 Experiment 数 × Run 成功率。细粒度权限降低 Owner 的共享顾虑 → 更多资源被共享 → 更多跨 Team 引用 → 有效 Experiment 数提升。

#### 目标用户

| 角色 | 痛点 | 期望 |
|------|------|------|
| TeamOwner（生产者） | 担心共享后训练配置泄露，因此拒绝授权 | 可选择仅允许引用、不暴露配置 |
| 算法工程师（消费者） | 看到共享 Build 但无法区分哪些详情可见 | 清晰的权限等级提示 |
| Admin | 需审计不同权限等级的使用情况 | 审计日志含权限级别字段 |

---

### Layer 2 — 范围层 Scope

#### In Scope

| 编号 | 能力 | 说明 |
|------|------|------|
| S-01 | 权限枚举拆分 | `permission` 从 `VIEW` \| `REFERENCE` 扩展为 `VIEW` \| `REFERENCE` \| `VIEW_DETAIL` |
| S-02 | 条件化数据返回 | Build Detail API 根据 share permission 级别返回不同字段集 |
| S-03 | 授权表单更新 | 新建共享时可选择三级权限 |
| S-04 | 数据迁移 | 现有 `REFERENCE` 记录默认升级为 `VIEW_DETAIL` |

#### Out of Scope

| 排除项 | 原因 |
|--------|------|
| 资源级字段级 ACL | 过度设计——三级权限已满足当前需求 |
| Model 对象的权限拆分 | 本次仅针对 Build；Model 共享配置信息泄露风险低 |

#### 非功能性需求

| 需求 | 指标 |
|------|------|
| 权限变更生效 | ≤ 5s |
| API 兼容性 | 现有 `REFERENCE` 调用者行为不变（因迁移为 `VIEW_DETAIL`） |

#### 数据模型影响

- `ResourceShare.permission` 枚举增加 `VIEW_DETAIL`
- 无新表、无新 FK

#### API 变更

| 方法 | 路径 | 变更 |
|------|------|------|
| POST | `/api/v1/shares` | `permission` 接受 `VIEW_DETAIL` |
| GET | `/api/v1/builds/{id}` | 新增权限级别校验，`REFERENCE` 级别屏蔽 `hyperparams`、`feature_list`、`eval_report` 字段 |

---

### Layer 3 — 结构层 Structure

#### User Stories

| 编号 | Story |
|------|-------|
| US-01 | 作为 TeamOwner，我希望授权时可选择 `REFERENCE` 或 `VIEW_DETAIL`，以便控制共享详情粒度 |
| US-02 | 作为消费方算法工程师，我希望在 Build Detail 页看到权限不足的字段有明确提示（而非空白） |
| US-03 | 作为 Admin，我希望审计日志记录每条共享的权限级别 |

#### 页面结构影响

```
Build Detail 页面
├── 概览 Tab — 不受影响（BUILD 基本信息）
├── 训练配置 Tab — REFERENCE 权限下显示 "权限不足" 占位；VIEW_DETAIL 显示完整内容
├── Artifacts Tab — REFERENCE 仅显示 S3 路径；VIEW_DETAIL 显示完整列表
└── 共享管理 Tab
    └── 新增共享 Drawer — permission 下拉从 2 项改为 3 项
```

---

### Layer 4 — 框架层 Skeleton

| 编号 | 功能需求 |
|------|---------|
| FR-01 | **新增共享 Drawer — permission Select** — 下拉选项从 `VIEW` / `REFERENCE` 扩展为 `VIEW` / `REFERENCE` / `VIEW_DETAIL` — 每个选项附 Tooltip 说明可见范围 → 选中后表单状态更新 |
| FR-02 | **Build Detail 训练配置 Tab — 权限屏蔽** — 当 share permission = `REFERENCE` 时，超参数 / 特征列表 / 评估报告区域替换为 `Empty State`（"当前权限仅允许引用产物路径，如需查看详情请联系 Owner 升级权限"）→ 附 "申请升级" 按钮（跳转至共享管理或触发通知） |
| FR-03 | **Build Detail Artifacts Tab — 条件化显示** — `REFERENCE` 仅显示主 S3 路径条目；`VIEW_DETAIL` 显示完整 Artifact 列表（含 metrics、logs） |
| FR-04 | **审计日志 — permission 字段** — 现有 `share_granted` 事件增加 `permission_level` 属性 |

---

### Layer 5 — 表现层 Surface

| 元素 | 处理 |
|------|------|
| 权限等级 Tag | `VIEW` = 灰色、`REFERENCE` = 蓝色、`VIEW_DETAIL` = 绿色 |
| 权限不足占位 | 使用 Ant Design `Empty` 组件 + 自定义 description + CTA 按钮 |
| Tooltip 说明 | permission Select 中每个选项右侧 info icon，hover 显示可见字段范围 |

---

## Output C：Refine 后 Builder Skill（Impact Triage + 精简输出）

---

### Impact Triage

**需求摘要**：将 `REFERENCE` 权限拆分为 `REFERENCE`（仅引用路径）和 `VIEW_DETAIL`（引用 + 查看详情），细化共享授权粒度。

**生命周期阶段**：One-to-Ten

**设计层级影响**：
- 起源层：**范围层 Scope**（权限枚举边界变更）
- 写入集：**Scope → Structure → Skeleton**
- 稳定层（不重写）：Strategy（北极星和目标用户不变）、Surface（复用现有设计体系，无新视觉模式）

**技术层级影响**：Business Logic（授权校验逻辑）、API（响应字段条件化）、Application（前端表单和详情页）

**理由**：这是对已有权限机制的枚举细分，不改变平台战略方向或目标用户定义。视觉层面复用现有 Tag 色值体系和 Empty State 组件，无需新增设计 Token。

---

### Layer 2 — 范围层 Scope

#### In Scope

| 编号 | 能力 | 说明 |
|------|------|------|
| S-01 | 权限枚举扩展 | `permission`: `VIEW` \| `REFERENCE` \| `VIEW_DETAIL`。`REFERENCE` = 仅 S3 路径引用；`VIEW_DETAIL` = 引用 + 完整配置查看 |
| S-02 | API 条件化返回 | `GET /builds/{id}` 根据 share permission 返回不同字段子集 |
| S-03 | 授权表单更新 | 新建共享 Drawer 中 permission 下拉增加第三项 |
| S-04 | 存量迁移 | 现有 `REFERENCE` 记录批量迁移为 `VIEW_DETAIL`（保持向后兼容） |

#### Out of Scope

| 排除项 | 原因 |
|--------|------|
| 字段级 ACL | 三级权限已覆盖需求；字段级控制引入过大复杂度 |
| Model 共享权限拆分 | Model 元信息泄露风险低于 Build 训练配置，本次不涉及 |

#### 非功能性需求

- 权限变更生效 ≤ 5s
- 存量迁移必须在单次 DB migration 中完成，不中断服务
- API 向后兼容：未升级的客户端调用 `REFERENCE` 时行为等同于迁移前

#### 数据模型影响

- `ResourceShare.permission` 枚举增加 `VIEW_DETAIL`
- 无新表、无 Schema 结构变更

#### API 变更

| 方法 | 路径 | 变更 |
|------|------|------|
| POST | `/api/v1/shares` | `permission` 接受 `VIEW_DETAIL` |
| GET | `/api/v1/builds/{id}` | `REFERENCE` 级别：响应排除 `hyperparams`、`feature_list`、`eval_report`；`VIEW_DETAIL` 级别：完整返回 |

#### 迁移策略

1. DB migration：`UPDATE resource_share SET permission = 'VIEW_DETAIL' WHERE permission = 'REFERENCE'`
2. 新枚举值 `REFERENCE` 语义变窄（仅引用路径）
3. 回滚方案：`VIEW_DETAIL` 回退为 `REFERENCE`（功能降级但不丢数据）

---

### Layer 3 — 结构层 Structure

#### User Stories

| 编号 | Story |
|------|-------|
| US-01 | 作为 TeamOwner，我希望授权时区分"仅允许引用"和"允许查看详情"，以便保护训练方法论 |
| US-02 | 作为消费方，我希望权限不足时看到明确提示和升级入口，而不是空白内容 |

#### 页面影响（增量）

```
Build Detail — 训练配置 Tab / Artifacts Tab：根据 permission 显示或屏蔽
共享管理 Tab — 新增共享 Drawer：permission 下拉 3 项
审计日志：事件属性增加 permission_level
```

---

### Layer 4 — 框架层 Skeleton

| 编号 | 功能需求 |
|------|---------|
| FR-01 | **新增共享 Drawer — permission Select** — 3 项下拉（`VIEW` / `REFERENCE` / `VIEW_DETAIL`）— 每项附 Tooltip 标注可见范围 → 提交时传入选定值 |
| FR-02 | **Build Detail 训练配置 Tab — 权限屏蔽** — `REFERENCE` 级别下，超参数 / 特征列表 / 评估报告区域替换为 Ant Design `Empty` + "权限不足，请联系 Owner 升级" + 「申请升级」CTA |
| FR-03 | **Build Detail Artifacts Tab** — `REFERENCE` 仅显示主 S3 路径行；`VIEW_DETAIL` 显示完整列表 |

> **Surface 层**：无新增设计 Token。`VIEW_DETAIL` Tag 复用现有绿色 Tag 样式，Empty State 复用平台 Empty 组件。

---

## 质量对比分析

### 逐维度对比

| 评测维度 | Output A（Reference Skill） | Output B（Refine 前 Builder） | Output C（Refine 后 Builder） | 分析 |
|---------|---------------------------|---------------------------|---------------------------|------|
| **冗余度** | ⭐⭐⭐ 扁平模板天然无层级冗余，但也无法区分重要/次要内容 | ⭐⭐ 完整输出 Strategy + Surface 两层，对一个枚举拆分需求而言是显著冗余——Strategy 花了一整段论述 North Star 和三类用户，Surface 定义了 Tag 色值，均非此需求必要内容 | ⭐⭐⭐⭐⭐ Impact Triage 准确跳过 Strategy 和 Surface，正文仅 Scope → Structure → Skeleton，Surface 以一行 "无新增 Token" 注释带过 | **Refine 后的核心改进点**：冗余度从 B 的 ~220 行降至 C 的 ~100 行，信噪比显著提升 |
| **层级精准度** | ⭐⭐ 无层级意识——所有内容在同一抽象面 | ⭐⭐⭐ 有层级意识但无裁剪能力——每层都写，无法表达"此层不受影响" | ⭐⭐⭐⭐⭐ 显式输出 Impact Triage，明确标注起源层、写入集和稳定层，读者一目了然知道这个需求的影响范围 | Impact Triage 是 C 独有能力 |
| **可执行性** | ⭐⭐⭐ 有 FR 和 Data Model，但 FR 仅列功能不含交互细节 | ⭐⭐⭐⭐⭐ Skeleton 级 FR 含组件形态、位置、触发、响应 | ⭐⭐⭐⭐⭐ 同 B，Skeleton 级 FR 含交互细节 + 额外的迁移策略节（含回滚方案） | B 和 C 可执行性相当，C 略胜在迁移策略更具体 |
| **向后兼容分析** | ⭐⭐⭐ 提及"默认升级为 VIEW_DETAIL"，但无回滚方案 | ⭐⭐⭐ Scope 中提及迁移，但未展开实施细节 | ⭐⭐⭐⭐⭐ 独立"迁移策略"节：含 SQL、语义变化说明、回滚方案 | C 的迁移分析最完整 |

### 总分对比

| | Output A | Output B | Output C |
|---|----------|----------|----------|
| **总分（20 分满）** | 11 / 20 | 14 / 20 | 19 / 20 |
| **核心优势** | 简洁直接 | 交互级 FR 完整 | 精准裁剪 + 完整可执行 |
| **核心短板** | 无层级、无交互细节 | 冗余——为枚举改动写了战略层和视觉层 | — |

### 本用例核心结论

**对小范围改动，Refine 前的 Builder Skill 反而暴露了"死板"问题**——它不区分需求大小，一律输出完整五层，导致 Strategy 和 Surface 层在此类需求中成为噪音。GitHub Reference Skill 的扁平结构虽然没有层级冗余，但也缺少结构化的影响分析。

**Refine 后的 Impact Triage 机制解决了这个问题**：先显式输出影响分析，让读者（和 LLM 自身）清楚知道"这个需求不需要重新论述战略方向"，再仅编写受影响的层级。这体现了分层设计思想的正确应用——分层是为了定位，不是为了每次都走完所有层。

---

# Test Case 3：AI 辅助配置表单（新能力，验证 AI/LLM Justification）

> 此用例测试 Refine 后新增的 **AI/LLM Justification** 机制：面对一个涉及 AI 的新能力需求，Skill 是否能迫使输出者回答"为什么用 AI"而不是把 AI 当成不证自明的黑盒。

## 评测设置

### 共享 Prompt

> **背景**：模型训练任务的 Canvas 配置界面中，算法工程师需要手动填写大量参数——特征工程参数（WOE 分箱策略、IV 筛选阈值、相关性阈值）、模型超参数（learning_rate、num_leaves、max_depth 等）、评估指标组合（KS、AUC、PSI 等）。新手工程师经常不知道如何配置，老手也需要反复试错。
>
> **需求**：引入 AI Copilot 能力——当创建或编辑 Experiment 时，AI 根据所选数据源的特征分布、历史 Experiment 配置与效果、以及模型训练最佳实践知识库，自动推荐上述三类参数。用户可以一键接受、逐项修改或完全忽略。
>
> **要求**：给出设计方案。

### 评测维度

| 维度 | 定义 |
|------|------|
| **AI 论证精度** | 是否显式分类使用了什么 AI 能力（推理 / RAG / 生成 / 分类），以及为什么 |
| **替代方案对比** | 是否对比了 AI 与规则模板 / 统计聚合等替代实现，并阐明 AI 的精确加成点 |
| **失败模式设计** | AI 推荐错误时的用户体验和系统行为是否被设计 |
| **成本边界** | 是否设定了每次推荐的延迟和成本上限 |
| **结构完整性** | PRD 是否覆盖了必要层级，且无过度冗余 |

---

## Output A：GitHub Reference Skill（product-manager-platform）

---

### Problem Statement

算法工程师在 Canvas 配置界面手动填写训练参数效率低：新手不知道合理参数范围，老手需要反复试错。这导致 Experiment 创建耗时长、初始配置质量参差不齐。

### North Star Connection

AI 推荐降低配置门槛 → 新手也能快速创建有效 Experiment → 周活跃 Experiment 数提升。推荐基于历史最佳配置 → 初始 Run 的成功率提升。

### Target Users

| 角色 | 需求 |
|------|------|
| 新手算法工程师 | 不了解参数含义和合理范围，需要引导 |
| 资深算法工程师 | 希望快速得到一组合理 baseline，再微调 |

### Scope

**In scope**：
- AI 推荐引擎：基于数据源特征分布 + 历史 Experiment 配置 + 最佳实践知识库
- 推荐三类参数：特征工程（WOE 分箱、IV 阈值、相关性阈值）、模型超参（learning_rate、num_leaves、max_depth）、评估指标（KS、AUC、PSI）
- 用户交互：一键接受 / 逐项修改 / 忽略

**Out of scope**：自动执行推荐配置（必须用户确认）、训练过程中的实时参数调优

### User Stories

- 作为新手算法工程师，我希望在配置 Experiment 时看到 AI 推荐的参数组合，以便快速上手
- 作为资深算法工程师，我希望 AI 推荐基于历史效果最佳的配置，以便作为调优起点
- 作为算法工程师，我希望可以逐项修改或忽略推荐，以保留完全控制权

### Functional Requirements

1. 用户进入 Experiment 配置页面并选定数据源后，系统自动触发 AI 推荐
2. 推荐结果以"建议值"形式显示在每个参数输入框旁
3. 提供"一键填入全部推荐"按钮
4. 用户可逐个接受或修改推荐值
5. 推荐请求超时（> 10s）时降级为空，不阻塞用户手动填写
6. 推荐来源可追溯（hover 显示"基于 N 个历史 Experiment 的效果分析"）

### Non-Functional Requirements

- 推荐响应时间 P95 ≤ 5s
- 推荐可用性 ≥ 99%（降级为空不算不可用）

### Data Model Impact

- 新增 `recommendation_log` 表：记录每次推荐请求和用户采纳情况
- Experiment 表增加 `recommendation_id` 外键（可选，记录配置来源）

### API Changes

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/recommendations` | 输入数据源 ID + 任务类型，返回推荐参数集 |

### QA & Testing Impact

- 需验证：无历史 Experiment 时推荐降级行为
- 需验证：推荐参数超出合理范围时的前端校验
- 需验证：推荐超时的用户体验

### Success Metrics

| 指标 | 基线 | 目标 |
|------|------|------|
| 推荐采纳率（至少接受 1 项） | — | ≥ 60% |
| Experiment 首次 Run 成功率 | 当前值 | 提升 15% |
| 配置页面平均停留时间 | 当前值 | 降低 30% |

---

## Output B：Refine 前 Builder Skill（完整五层输出）

---

### Step 0 — 产品类型确认

功能型平台类产品。One-to-Ten 阶段——平台训练流程已跑通，AI Copilot 是在现有配置流程上叠加智能推荐能力。

---

### Layer 1 — 战略层 Strategy

#### 问题陈述

Canvas 配置界面是训练流程的入口和最大摩擦点。当前配置完全手动，存在两个核心问题：

1. **认知门槛高**：新手工程师不了解 WOE 分箱策略选择、IV 阈值设置与数据分布的关系、超参数组合对模型效果的影响
2. **试错成本高**：一次 Experiment Run 耗时可达数小时，错误配置导致的无效 Run 浪费计算资源和人力

平台积累了大量历史 Experiment 数据（配置 + 效果指标），但这些知识被锁在数据库中，未被利用来指导新配置。

#### North Star 连接

North Star = 周活跃 Experiment 数 × Run 成功率。

- AI 推荐降低配置门槛 → 更多工程师能独立创建有效 Experiment → 活跃 Experiment 数 ↑
- 推荐基于历史最佳配置 → 首次 Run 成功率 ↑
- 减少无效 Run → 计算资源利用率 ↑

#### 目标用户

| 角色 | 痛点 | 期望 |
|------|------|------|
| 新手算法工程师 | 参数含义不清、范围不明，配置靠问同事 | AI 给出推荐 baseline，附带解释 |
| 资深算法工程师 | 需反复试错寻找最优配置 | AI 基于历史数据给出高质量起点 |
| TeamOwner | 团队新人 onboarding 慢 | AI 辅助降低 onboarding 时间 |

---

### Layer 2 — 范围层 Scope

#### In Scope

| 编号 | 能力 | 说明 |
|------|------|------|
| S-01 | 推荐引擎 | 基于数据源特征分布 + 历史 Experiment 效果 + 最佳实践知识库生成参数推荐 |
| S-02 | 三类参数覆盖 | 特征工程参数、模型超参数、评估指标组合 |
| S-03 | 用户控制 | 一键接受 / 逐项修改 / 忽略 |
| S-04 | 推荐溯源 | 显示推荐依据（基于 N 个历史 Experiment） |
| S-05 | 降级策略 | 推荐失败或超时时不阻塞手动配置 |

#### Out of Scope

| 排除项 | 原因 |
|--------|------|
| 自动执行推荐（无需用户确认） | 安全风险——错误配置可能浪费大量计算资源 |
| 训练过程中的实时调参 | 需要与 Ray Tune 深度集成，复杂度高，后续迭代 |
| 推荐模型的自动训练 | 第一版使用规则 + LLM 混合，不训练专用推荐模型 |

#### 非功能性需求

| 需求 | 指标 |
|------|------|
| 推荐延迟 | P95 ≤ 5s |
| 推荐可用性 | ≥ 99%（降级为空不算故障） |
| 推荐准确性 | 采纳率 ≥ 60%（3 个月后评估） |

#### 数据模型影响

新增实体 **RecommendationLog**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (ULID) | 主键 |
| experiment_id | string | 关联 Experiment |
| datasource_id | string | 输入数据源 |
| recommended_params | JSON | 推荐的参数集 |
| accepted_params | JSON (nullable) | 用户实际采纳的参数（null = 全部忽略） |
| acceptance_rate | float | 采纳比例 |
| latency_ms | int | 推荐耗时 |
| created_at | timestamp | 创建时间 |

#### API 变更

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/recommendations` | 输入：`datasource_id` + `task_type`；输出：推荐参数集 |
| GET | `/api/v1/recommendations/{id}` | 查询推荐详情和采纳情况 |

---

### Layer 3 — 结构层 Structure

#### User Stories

| 编号 | Story |
|------|-------|
| US-01 | 作为新手算法工程师，我希望选择数据源后自动看到 AI 推荐的参数，以便快速完成配置 |
| US-02 | 作为资深算法工程师，我希望查看推荐依据（历史 Experiment 统计），以便决定是否采纳 |
| US-03 | 作为算法工程师，我希望可以逐项修改推荐值，以保留完全控制权 |
| US-04 | 作为算法工程师，我希望推荐超时时可以继续手动配置，不被阻塞 |

#### 页面结构影响

```
Experiment Canvas 配置页
├── 数据源选择 — 不变
├── 特征工程配置 — 增加 AI 推荐面板
│   └── 每个参数输入框右侧增加 "AI 建议" 标注
├── 模型超参配置 — 同上
├── 评估指标配置 — 同上
└── 页面顶部 — 增加 "一键填入 AI 推荐" 全局按钮
```

---

### Layer 4 — 框架层 Skeleton

| 编号 | 功能需求 |
|------|---------|
| FR-01 | **AI 推荐触发** — 用户选定数据源并切换到参数配置步骤时 → 自动调用 POST `/recommendations` → 加载状态：参数区域显示 Skeleton 闪烁 → 成功后参数输入框右侧出现 "AI 建议: {value}" 标注 |
| FR-02 | **一键填入** — 页面顶部 sticky 位置 → "一键填入 AI 推荐" 按钮（Primary）→ 点击后所有空白参数框填入推荐值 + Toast "已填入 N 项推荐" → 已有手动值的字段不覆盖（hover 提示 "已有自定义值，AI 建议: {value}"） |
| FR-03 | **逐项采纳** — 每个参数输入框右侧 AI 建议标注 → 点击标注 → 将推荐值填入输入框 + 标注变为 "已采纳" 状态 |
| FR-04 | **推荐溯源** — AI 建议标注 hover → Popover 显示推荐依据："基于 {N} 个相似数据源的历史 Experiment，效果最佳配置的 P50 值" |
| FR-05 | **超时降级** — 推荐请求 > 5s → 取消加载 → 参数区域恢复为普通输入框 + 顶部 Info Banner "AI 推荐暂不可用，您可以手动配置" |
| FR-06 | **推荐日志** — 用户提交 Experiment 配置时 → 自动记录 RecommendationLog（推荐值 vs 实际值 vs 采纳率） |

---

### Layer 5 — 表现层 Surface

| 元素 | 处理 |
|------|------|
| AI 建议标注 | 参数框右侧 inline Tag，颜色 `#722ed1`（紫色系，区分于功能色），文案 "AI 建议: {value}" |
| 一键填入按钮 | Primary 按钮 + ✨ 图标前缀，sticky 在配置区域顶部 |
| 采纳状态 | 标注变为绿色 ✓ "已采纳" |
| 溯源 Popover | 浅色背景卡片，含 mini 柱状图显示历史分布 |
| 降级 Banner | Ant Design `Alert` type="info" |

---

## Output C：Refine 后 Builder Skill（Impact Triage + AI/LLM Justification）

---

### Impact Triage

**需求摘要**：在 Canvas 配置界面引入 AI Copilot，基于数据源特征、历史 Experiment 和最佳实践推荐训练参数。

**生命周期阶段**：One-to-Ten（新能力叠加在已有配置流程上）

**设计层级影响**：
- 起源层：**范围层 Scope**（新增 AI 推荐能力 = 新功能边界定义）
- 写入集：**Scope → Structure → Skeleton → Surface**（新能力引入新交互模式，Surface 需定义 AI 推荐的视觉语言）
- 稳定层（不重写）：**Strategy**（目标用户和 North Star 不变，AI Copilot 是提升手段而非方向变更）

**技术层级影响**：Business Logic（推荐引擎逻辑）、API（新 endpoint）、Application（前端 Copilot UI）、Data（RecommendationLog）、Observability（推荐采纳追踪）

**理由**：这是在现有配置流程上叠加的新能力，不改变平台定位或目标用户。但因引入全新的 AI 交互模式，需要从 Scope 层开始编写，并覆盖到 Surface 层定义 AI 相关的视觉语言。Strategy 层稳定——仅在 Scope 中引用 North Star 连接即可。

---

### Layer 2 — 范围层 Scope

#### In Scope

| 编号 | 能力 | 说明 |
|------|------|------|
| S-01 | AI 推荐引擎 | 基于数据源特征分布 + 历史 Experiment 效果 + 最佳实践知识库生成参数推荐 |
| S-02 | 三类参数覆盖 | 特征工程参数、模型超参数、评估指标组合 |
| S-03 | 用户控制 | 一键接受 / 逐项修改 / 忽略——AI 永远不自动执行 |
| S-04 | 推荐溯源 | 显示推荐依据（历史统计 + 知识来源标注） |
| S-05 | 降级策略 | 推荐失败或超时不阻塞手动配置 |
| S-06 | 推荐日志 | 记录推荐 vs 采纳数据，用于后续推荐质量迭代 |

#### Out of Scope

| 排除项 | 原因 |
|--------|------|
| 自动执行推荐配置 | 错误配置浪费计算资源，成本 > 便利性——必须 human-in-the-loop |
| 训练过程中实时调参 | 需 Ray Tune 深度集成，复杂度高，后续迭代 |
| 专用推荐模型训练 | 第一版用 LLM + 统计聚合，验证价值后再考虑专用模型 |

#### AI / LLM Justification — Why LLM?

**1. 使用了什么 AI 能力？**

| 能力 | 用途 | 占比 |
|------|------|------|
| **Knowledge Retrieval (RAG)** | 检索最佳实践知识库（文档 + 调参指南）和历史 Experiment 配置效果 | 60% |
| **Reasoning / Decision** | 综合数据源特征分布、任务类型、历史效果多因素推导推荐值 | 30% |
| **Content Generation** | 生成推荐理由的自然语言解释 | 10% |

**2. 为什么需要动态判断？**

参数推荐不是静态映射。以 WOE 分箱策略为例：

- **输入 A**：数据源有 200 个特征，其中 150 个是连续型、分布呈长尾，历史同类 Experiment 表现最佳的分箱策略是等频分箱 + IV > 0.02 筛选
- **输入 B**：数据源有 50 个特征，其中 40 个是离散型，历史同类 Experiment 使用卡方分箱 + IV > 0.05 效果更好

两个输入"都是 WOE 配置"，但最优策略完全不同。变量组合空间为：特征类型分布 × 特征数量 × 任务类型 × 历史数据可用性 × 数据量级——这个空间太大，无法用有限的 if-else 规则穷举。

**3. 为什么 AI 优于替代方案？**

| 替代方案 | 评估 | 为什么不够 |
|---------|------|-----------|
| **固定模板**（按任务类型给默认值） | 成本最低 | 无法感知数据源特征分布差异；分类任务模板无法区分二分类 vs 多分类 vs 类不平衡场景 |
| **统计聚合**（取历史 P50） | 中等成本 | 对新特征组合无历史数据时失效；无法综合多维度因素（特征分布 + 数据量 + 任务类型同时考虑） |
| **规则引擎** | 中等成本 | 需人工编写和维护规则，随场景增长规则数量爆炸；无法处理知识库中的非结构化调参经验 |

AI 的精确加成点：能 **同时** 处理结构化信号（特征统计、历史指标）和非结构化知识（调参文档、最佳实践），并根据具体上下文综合推理——这是规则引擎和统计方法各自无法独立完成的。

**4. 失败模式**

| 失败场景 | 处理 |
|---------|------|
| 推荐参数不合理（超出有效范围） | 前端校验拦截——推荐值必须通过与手动输入相同的验证规则 |
| 推荐偏离最优（用户不满意） | Human-in-the-loop：用户可逐项修改或完全忽略；推荐日志记录采纳率，低采纳率触发告警 |
| LLM 服务不可用 | 降级为统计聚合（历史 P50）→ 再降级为空 → 不阻塞手动配置 |
| 推荐理由不准确 | 理由仅辅助参考，不影响参数值本身；标注来源以便用户判断 |

**错误成本评估**：中等。错误推荐 ≠ 直接损失（用户确认后才执行），但可能导致一次 Run 浪费（数小时计算资源）。因此 human-in-the-loop 是硬约束。

**5. 成本与延迟边界**

| 指标 | 上限 | 理由 |
|------|------|------|
| 单次推荐延迟 | P95 ≤ 5s | 配置页面交互节奏——超过 5s 用户倾向于跳过 |
| 单次推荐成本 | ≤ $0.05 | 日均 ~200 次推荐 → 月成本 ≤ $300 |
| LLM Token 消耗 | ≤ 4K input + 1K output / 次 | 控制 RAG 上下文窗口大小 |

#### 非功能性需求

- 推荐延迟 P95 ≤ 5s，P99 ≤ 8s
- 推荐服务可用性 ≥ 99%（降级为统计聚合不算故障）
- 推荐日志保留 ≥ 90 天
- 每日推荐次数无硬限制，但单用户 > 50 次/天时记录异常日志

#### 数据模型影响

新增实体 **RecommendationLog**：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (ULID) | 主键 |
| experiment_id | string | 关联 Experiment |
| datasource_id | string | 输入数据源 |
| task_type | enum | 分类 / 回归 |
| input_context | JSON | 特征分布摘要 + 历史 Experiment 引用列表 |
| recommended_params | JSON | 推荐参数集 |
| accepted_params | JSON (nullable) | 用户实际采纳参数 |
| acceptance_rate | float | 采纳比例 |
| recommendation_source | enum: `LLM`, `STAT_AGGREGATE`, `EMPTY` | 推荐来源（含降级标识） |
| latency_ms | int | 推荐耗时 |
| created_at | timestamp | 创建时间 |

#### API 变更

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/recommendations` | 输入：`datasource_id` + `task_type`；输出：推荐参数集 + 推荐理由 |
| GET | `/api/v1/recommendations/{id}` | 查询推荐详情和采纳情况 |

---

### Layer 3 — 结构层 Structure

#### User Stories

| 编号 | Story |
|------|-------|
| US-01 | 作为新手算法工程师，我希望选择数据源后看到 AI 推荐的参数并理解推荐理由，以便学习参数配置逻辑 |
| US-02 | 作为资深算法工程师，我希望 AI 推荐基于历史效果数据，以便作为调优起点而非盲猜 |
| US-03 | 作为算法工程师，我希望逐项控制推荐采纳，以保留对配置的完全决策权 |
| US-04 | 作为算法工程师，我希望 AI 不可用时可无缝继续手动配置，不被阻塞 |

#### 页面结构影响

```
Experiment Canvas 配置页
├── 数据源选择步骤 — 不变（作为推荐触发条件）
├── 特征工程配置步骤 — 增加 AI 推荐内联标注
├── 模型超参配置步骤 — 增加 AI 推荐内联标注
├── 评估指标配置步骤 — 增加 AI 推荐内联标注
└── 全局 — 页面顶部 sticky "一键填入 AI 推荐" 按钮 + 降级 Banner
```

---

### Layer 4 — 框架层 Skeleton

| 编号 | 功能需求 |
|------|---------|
| FR-01 | **推荐触发** — 用户选定数据源后切换到参数配置步骤 → 自动 POST `/recommendations` → 参数区域显示 Skeleton 加载态 → 成功后每个参数框右侧出现内联推荐标注 |
| FR-02 | **一键填入** — sticky 区域 "一键填入 AI 推荐" 按钮 → 点击填入所有空白参数 → 已有手动值的字段不覆盖（hover 提示 "已有自定义值，AI 建议: {value}"）→ Toast 确认 |
| FR-03 | **逐项采纳** — 参数框右侧推荐标注 → 点击填入该值 → 标注变为 "已采纳" 状态 |
| FR-04 | **推荐溯源** — 推荐标注 hover → Popover 显示推荐来源和置信依据（"基于 {N} 个相似配置的历史效果，{source} 推荐"） |
| FR-05 | **降级** — 超时 > 5s → 取消加载 → 恢复普通输入框 + Info Banner "AI 推荐暂不可用" → 若降级到统计聚合，标注来源为 "统计建议" 而非 "AI 建议" |
| FR-06 | **输入校验** — AI 推荐值必须通过与手动输入相同的前端校验规则 → 不合理推荐值不显示（静默丢弃 + 记录异常日志） |

---

### Layer 5 — 表现层 Surface

| 元素 | 设计 |
|------|------|
| AI 推荐标注 | 参数框右侧 inline Tag，紫色系 `#722ed1`（区分功能色），文案 "AI 建议: {value}" |
| 统计建议标注 | 同位置，灰蓝色 `#8c8c8c`，文案 "统计建议: {value}"（降级标识） |
| 一键填入按钮 | Primary 按钮 + sparkle icon 前缀，sticky 在配置区域顶部 |
| 采纳状态 | Tag 变为绿色 ✓ "已采纳" |
| 溯源 Popover | 浅色卡片，含推荐来源标注 + 历史 Experiment 效果分布 mini chart |
| 降级 Banner | `Alert` type="info"，可关闭 |

**AI 视觉语言原则**：
- AI 生成的内容使用紫色系标识，与平台功能色（蓝色）和状态色（绿/橙/红）区分
- AI 建议始终标注来源，不冒充系统确定性输出
- 降级状态使用灰蓝色，视觉权重低于 AI 推荐

---

## 质量对比分析

### 逐维度对比

| 评测维度 | Output A（Reference Skill） | Output B（Refine 前 Builder） | Output C（Refine 后 Builder） | 分析 |
|---------|---------------------------|---------------------------|---------------------------|------|
| **AI 论证精度** | ⭐⭐ 提到"AI 推荐"但未分类使用了什么 AI 能力，未区分推理 / RAG / 生成 | ⭐⭐ 同 A——Scope 中 AI 作为功能列出，但未解释"为什么用 AI"而非规则模板 | ⭐⭐⭐⭐⭐ 显式分类三种 AI 能力（RAG 60% + Reasoning 30% + Generation 10%），并用具体例子解释为什么参数推荐需要动态判断 | **C 独有的 "Why LLM?" 五问机制**是核心差异——A 和 B 都将 AI 视为不证自明的黑盒 |
| **替代方案对比** | ⭐ 未提及任何替代方案 | ⭐⭐ Out of Scope 提到"第一版用规则 + LLM 混合"，但未系统对比为什么不能只用规则 | ⭐⭐⭐⭐⭐ 三列对比表（固定模板 / 统计聚合 / 规则引擎），逐一说明不足之处，定义 AI 的精确加成点 | C 的替代方案分析是工程决策的关键输入——没有它，团队可能在实现阶段才质疑"为什么不能用规则" |
| **失败模式设计** | ⭐⭐ 提到超时降级，但未覆盖推荐不合理 / LLM 不可用的分层降级 | ⭐⭐⭐ 提到降级策略，但作为 In Scope 一句话带过 | ⭐⭐⭐⭐⭐ 四种失败场景逐一设计处理方式 + 错误成本评估 + 三级降级链（LLM → 统计聚合 → 空） | C 的失败模式分析可直接用于工程异常处理设计 |
| **成本边界** | ⭐ 未提及成本 | ⭐ 未提及成本 | ⭐⭐⭐⭐⭐ 单次推荐延迟、成本、Token 消耗均有明确上限和计算依据 | **A 和 B 完全缺失成本分析**——这对 AI 功能是致命的：没有成本预算，上线后可能超支 |
| **结构完整性** | ⭐⭐⭐ 扁平但覆盖面合理 | ⭐⭐⭐⭐ 五层覆盖，但 Strategy 层对 AI 功能而言是冗余的（目标用户和 North Star 未变） | ⭐⭐⭐⭐⭐ Impact Triage 跳过 Strategy，从 Scope 开始写，Surface 层补充 AI 视觉语言原则 | C 的层级裁剪合理——Strategy 引用但不重写，Surface 因 AI 引入新视觉语言而需要写 |

### 总分对比

| | Output A | Output B | Output C |
|---|----------|----------|----------|
| **总分（25 分满）** | 10 / 25 | 14 / 25 | 24 / 25 |
| **核心优势** | 简洁快速 | 完整的 Skeleton 级 FR | AI 论证深度 + 精准层级裁剪 |
| **核心短板** | AI 是黑盒、无成本分析、无替代方案对比 | AI 是黑盒、无成本分析、Strategy 冗余 | — |
| **缺失的关键板块** | AI 论证、替代方案、失败模式、成本边界 | AI 论证、替代方案、成本边界 | QA 影响分析可追加 |

### 本用例核心结论

**AI 功能的最大风险不是实现不了，而是"不应该用 AI 的场景也用了 AI"或"该考虑的成本和失败模式没考虑"。** Refine 前的 Builder Skill 和 Reference Skill 都没有机制强制回答"为什么用 AI"——它们只关心"做什么"和"怎么做"，默认 AI 是正确的技术选型。

Refine 后的 **AI/LLM Justification 五问机制**迫使输出者在 Scope 层就完成以下推理链：能力分类 → 动态性论证 → 替代方案淘汰 → 失败兜底 → 成本预算。这不仅提升了 PRD 质量，更重要的是**在设计阶段就拦截了"AI for AI's sake"的风险**。

---

# 综合结论：Refine 前后的 Builder Skill 质量变化

## 三用例汇总

| 用例 | 测试目标 | Reference Skill | Refine 前 Builder | Refine 后 Builder | Refine 后的关键改进 |
|------|---------|----------------|------------------|------------------|------------------|
| Case 1：权限系统 Revamp | 完整能力评测 | 12 / 25 | 24 / 25 | — (未测) | — |
| Case 2：权限类型微调 | Impact Triage | 11 / 20 | 14 / 20 | 19 / 20 | 冗余度从 ~220 行降至 ~100 行；Impact Triage 精准跳过 Strategy + Surface |
| Case 3：AI 辅助配置 | AI/LLM Justification | 10 / 25 | 14 / 25 | 24 / 25 | 新增 AI 五问论证；替代方案对比表；失败模式矩阵；成本边界 |

## 核心发现

### 1. Impact Triage 解决了"死板"问题

Refine 前的 Builder Skill 对所有需求一视同仁地输出完整五层 PRD。这在大需求（Case 1）时是优势——确保思维覆盖。但在小需求（Case 2）时变成劣势——Strategy 层重复论述已知的 North Star、Surface 层为一个枚举改动定义色值，这些内容是噪音而非信号。

Refine 后的 Impact Triage 让 Skill 具备了**需求感知能力**：先分析，再决定写什么。这与分层设计的核心思想一致——**分层是为了定位问题，不是为了每次都走完所有层**。

### 2. AI/LLM Justification 填补了关键盲区

在 AI 需求（Case 3）中，三个 Skill 版本的最大差异不在"功能描述是否完整"（三者都列出了 In Scope 功能），而在**是否回答了"为什么用 AI"**。

- Reference Skill 和 Refine 前 Builder 都把 AI 当作一个功能列在 Scope 里，不质疑、不论证
- Refine 后 Builder 强制执行五问论证，使输出包含：能力分类（RAG/Reasoning/Generation 各占多少）、两个相似但需要不同输出的具体例子、三种替代方案的对比淘汰理由、四种失败场景的处理设计、三项成本边界指标

这些内容在工程实施阶段至关重要——没有它们，团队可能在开发中途才发现"其实规则引擎就够了"或"LLM 成本超出预算"。

### 3. Reference Skill 仍有独特价值

Reference Skill 的扁平模板在**快速头脑风暴和小团队沟通**场景下仍有优势——无需理解五层模型，产出速度快，适合作为第一轮讨论输入。但在需要工程精度的场景（跨团队 PRD 评审、技术方案对齐）中，其缺乏层级意识和 AI 论证能力是硬伤。

## Refine 评价

| 维度 | 评价 |
|------|------|
| **Refine 是否改善了质量？** | **是，显著改善。** Impact Triage 消除了小需求的冗余输出，AI Justification 填补了 AI 需求的论证盲区 |
| **Refine 是否引入了回退？** | **未观察到。** 大需求（Case 1 类型）仍会触发完整五层输出（因 Strategy 层受影响），不会因 Triage 而丢失内容 |
| **适用场景是否扩大？** | **是。** Refine 前仅适合大中型需求；Refine 后对小改动和 AI 需求均有针对性的处理机制 |