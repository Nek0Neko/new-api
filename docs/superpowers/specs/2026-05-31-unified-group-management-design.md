# 统一分组管理 + 渠道级计费覆盖 设计文档

- 日期：2026-05-31
- 分支：`custom`
- 状态：已确认设计，待编写实施计划
- 范围：两个特性，分两阶段实现
  - **Phase 1**：统一分组管理（场景 A — 用分组区分价位）
  - **Phase 2**：渠道级 × 模型 计费覆盖（场景 B — 同组同模型按渠道各算各价）

## 1. 背景与问题

「分组」(group) 在本项目中不是一张表，而是一个贯穿用户 / 令牌 / 渠道三层的**字符串标签**，没有中心化的管理实体。一个分组的各项属性目前被拆散在 **5 个独立的 Option 表 JSON 键**、3 个 Go 包里：

| 属性 | 存储位置（内存） | Option 键 | 读取热路径 |
|------|------------------|-----------|-----------|
| 消费倍率 `map[组]float64` | `ratio_setting.groupRatioMap` | `GroupRatio` | 计费 |
| 充值折扣 `map[组]float64` | `common.TopupGroupRatio` | `TopupGroupRatio` | 充值 |
| 描述 / 可见性 / `admin_only` / 自动升级 / 阈值（`GroupMeta`） | `setting.userUsableGroups` | `UserUsableGroups` | 鉴权 / 用户列表 |
| 自动分组轮询顺序 `[]string` | `setting.autoGroups` | `AutoGroups` | 路由 |
| 档位→组访问覆盖 `map[tier]map[组]desc` | `ratio_setting.GroupSpecialUsableGroup` | (随 group_ratio 持久化) | 鉴权 |
| 新用户默认组 / 新渠道默认组 / 默认走 auto | 三个标量 | `NewUserDefaultGroup` / `DefaultChannelGroup` / `DefaultUseAutoGroup` | 注册 / 建渠道 |
| 「哪些渠道服务该组」 | 派生自 `Channel.Group` → `Ability` 表 | — | 路由 |

**乱的根因**：同一个 `"vip"` 分组，它的倍率、描述、可见性、是否参与 auto 分散在 4 个 map 里，靠字符串名隐式关联，没有任何一处能看到「这个组的全貌 + 它绑定了哪些渠道」。管理时需要在「系统设置→模型与路由→分组倍率」「渠道管理」「用户管理」三个页面间来回跳。

### 关键代码事实（已核对）

- `model/channel.go:40` `Channel.Group` 是逗号分隔的多值 CSV；`GetGroups()`（`:296`）拆分。渠道保存时展开进 `Ability` 表（`AddAbilities()` `:146`）。
- `model/user.go:44` `User.Group` 单值；`:60` `ConsumptionGroups` 为可选白名单 JSON。
- `model/token.go:29` `Token.Group` 非空则覆盖用户分组。
- `model/ability.go:16` `Ability(Group,Model,ChannelId)` 复合主键，是路由索引。
- 计费倍率由**渠道组**决定，与用户等级无关：`service/group.go:139` `GetUserGroupRatio` 已忽略 `userGroup` 参数。用户等级 (`default/vip/svip`) 现仅影响充值折扣 (`TopupGroupRatio`)。
- 所有分组相关设置的写入都经 `model/option.go` 的 `OptionMap` 同步（`:117/119/146/147` 序列化，`:470/529/535` 反序列化）——这是「双向同步」干净的接管点。
- 设置富元数据已集中在 `setting/user_usable_group.go` 的 `GroupMeta{Description, Visibility, AdminOnly, AutoUpgrade, UpgradeThreshold}`。
- 迁移注册在 `model/main.go:250 migrateDB()`（`AutoMigrate`）与 `:300 migrateDBFast()`。

### 1.x 计费现状（与本设计强相关）

计费公式（`relay/helper/price.go`）：

```
最终计费 = 模型倍率 ModelRatio[模型]  ×  分组倍率 GroupRatio[请求落到的分组]
```

- `ModelRatio` / `ModelPrice` / `CompletionRatio` 全是**按模型名的全局查表**，与渠道无关。
- `model/channel.go` 与 `dto/channel_settings.go` 都**没有**按模型的渠道级计费覆盖字段。
- 唯一让「同一模型算不同钱」的杠杆是**分组倍率**（场景 A）。
- 已确认 `RelayInfo` 携带选中渠道信息：`ChannelId`（`relay/common/relay_info.go:65`）、`ChannelSetting dto.ChannelSettings`（`:76`，从 context 注入），计费时渠道已确定 → 给场景 B 留了干净接入点。

「不同渠道相同模型不同计费」拆成两个场景：
- **场景 A**：让调用方/令牌按分组选价位（不同渠道分到不同分组，各设倍率）。现有机制即支持，Phase 1 让其管理更顺手。
- **场景 B**：同一分组、同一模型，路由挑到哪个渠道就按那个渠道的价计。当前不支持，需 Phase 2 新增渠道级覆盖。

## 2. 目标

1. 新建一张 `groups` 表，作为分组的**唯一来源**，把散落属性收拢成一行。
2. 在前端主菜单 ADMIN 组新增「分组」入口，做成**统一管理中心**：集中查看 / 新建 / 编辑 / 删除分组，查看并快捷增删每个组关联的渠道。
3. 采用**表为唯一来源 + 写时双向同步过渡**：CRUD 落表后同步回写既有 Option JSON 与内存设置，Phase 1 范围内所有计费 / 路由 / 鉴权热路径**一行不改**。
4. 迁移并**移除**旧的「系统设置→模型与路由→分组倍率」入口。
5.（Phase 2）支持**渠道级 × 模型**的计费覆盖：同组同模型可按渠道各算各价；与分组倍率**叠乘**组合（`最终 = 渠道覆盖倍率 × 分组倍率`）。

## 3. 非目标（YAGNI 边界）

- 不在分组页内嵌完整渠道增删改（含密钥 / 模型 / 优先级）。分组页对渠道仅「查看 + 快捷加入/移出/启用禁用 + 一键跳转渠道管理页深编」。
- 本期不把 `GroupSpecialUsableGroup`（档位×组的二维覆盖）纳入 `groups` 表，保持原样。强行塞进单组行会再次制造混乱。
- Phase 1 不改任何计费 / 路由 / 鉴权读取点；计费路径仅在 Phase 2 改动（见 §5.6）。
- Phase 2 v1 **不**对 `tiered_expr`（表达式计费）模型叠加渠道覆盖（它有独立表达式；按 Rule 6 实现前需先读 `pkg/billingexpr/expr.md`）。
- 渠道级覆盖只覆盖 `ModelRatio` / `CompletionRatio` / `ModelPrice` 三项顶层杠杆；缓存/图片/音频等子倍率 v1 仍用全局值。
- 不引入分组本身的国际化命名（分组名仍是用户自定义字符串）。

## 4. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  主菜单 ADMIN 组新增「分组」入口 (/groups)                  │
│  ┌──────────────────┬────────────────────────────────┐   │
│  │ 左：分组列表       │ 右：选中分组详情                  │   │
│  │ default  ×1渠道    │  · 倍率/充值折扣/描述/可见性      │   │
│  │ vip      ×3渠道 ●  │  · admin_only/自动升级/阈值       │   │
│  │ svip     ×0渠道 ⚠  │  · 是否参与 auto 轮询(+顺序)      │   │
│  │ [+ 新建分组]        │  · 服务该组的渠道列表             │   │
│  │                    │    [+加入渠道] [移出] [启用/禁用] │   │
│  │                    │    [→ 去渠道管理页深编]           │   │
│  └──────────────────┴────────────────────────────────┘   │
│  顶部「全局设置」小卡片：默认渠道组 / 新用户默认组 / 默认走auto │
└─────────────────────────────────────────────────────────┘
            │ CRUD                          │ 读 Ability/Channel
            ▼                                ▼
   ┌──────────────────┐          聚合：每组渠道数 / 列表
   │  groups 表(新建)  │ ◄── 唯一来源
   └────────┬─────────┘
            │ 写时同步 (sync-down)
            ▼
   OptionMap JSON (GroupRatio/TopupGroupRatio/UserUsableGroups/AutoGroups...)
            │ 既有热路径不改，照常读内存设置
            ▼
   计费 / 路由 / 鉴权
```

## 5. 详细设计

### 5.1 数据模型 — 新建 `model/group.go`

```go
type Group struct {
    Id               int     `json:"id" gorm:"primaryKey"`
    Name             string  `json:"name" gorm:"type:varchar(64);uniqueIndex"`
    Description      string  `json:"description" gorm:"type:text"`
    ConsumptionRatio float64 `json:"consumption_ratio"` // ← GroupRatio
    TopupRatio       float64 `json:"topup_ratio"`       // ← TopupGroupRatio（0 表示未设充值折扣）
    Visibility       string  `json:"visibility" gorm:"type:varchar(16);default:'public'"` // public/private ← GroupMeta
    AdminOnly        bool    `json:"admin_only"`        // ← GroupMeta
    AutoUpgrade      bool    `json:"auto_upgrade"`      // ← GroupMeta
    UpgradeThreshold int64   `json:"upgrade_threshold"` // ← GroupMeta
    InAutoRotation   bool    `json:"in_auto_rotation"`  // 是否在 AutoGroups 列表
    AutoOrder        int     `json:"auto_order"`        // 在 auto 轮询中的顺序
    CreatedTime      int64   `json:"created_time"`
}
```

- 三库兼容：仅用 `varchar`/`text`/`bigint`/`bool`，GORM `AutoMigrate` 生成，无 DB 专有特性（遵守 Rule 2）。
- 全局标量（`DefaultChannelGroup` / `NewUserDefaultGroup` / `DefaultUseAutoGroup`）**不进表**——它们不是单个组的属性，留在原 `setting` 包，由分组页顶部「全局设置」小卡片读写（仍走 Option 通道）。
- `GroupSpecialUsableGroup`（tier×group 覆盖）**不进表**，保持原样（见非目标）。

### 5.2 双向同步机制（成败关键）

**不变式**：`groups` 表与 `GroupRatio` / `TopupGroupRatio` / `UserUsableGroups` / `AutoGroups` 四个 Option 键，在任意时刻内容一致。

1. **启动回填（一次性迁移，幂等）**：在 `model/main.go` 迁移流程中 `AutoMigrate(&Group{})` 后，若 `groups` 表为空，从当前已加载的内存设置（`ratio_setting.GetGroupRatioCopy()`、`common.TopupGroupRatio`、`setting.GetUserUsableGroupMetaCopy()`、`setting.GetAutoGroups()`）回填成 `Group` 行。表非空则跳过。
   - 合并键为分组名：以四份 map 的**并集**为准（某组可能只有倍率没描述，反之亦然），缺失字段取零值/默认。
2. **写时下行同步（sync-down）**：分组 CRUD 落表后，立即用**全表**数据重建那 4 段 JSON，走既有 `model/UpdateOption`（最终经 `OptionMap` + 各 `Update*ByJSONString`）写回 Option 表并刷新内存设置。
   - 复用既有序列化反序列化函数（`ratio_setting.GroupRatio2JSONString` 等的反向），确保格式与现有读取点完全一致。
3. **热路径零改动**：计费 / 路由 / 鉴权继续读 `ratio_setting.GetGroupRatio()` / `service.GetUserUsableGroups()` / `setting.GetAutoGroups()` 等内存值，sync-down 后这些值自然正确。

### 5.3 后端 API — `controller/group.go` 扩展

新增 admin 路由（沿用现有 `/api/group` 前缀风格，子路径 `manage`）：

- `GET    /api/group/manage` — 所有分组全貌 + 每组渠道数（聚合 `Ability` / `Channel.Group`）+ 全局标量。
- `GET    /api/group/manage/:name/channels` — 该组下的渠道列表（id / 名称 / 状态）。
- `POST   /api/group/manage` — 新建分组（落表 + sync-down）。
- `PUT    /api/group/manage/:name` — 编辑分组（落表 + sync-down）。
- `DELETE /api/group/manage/:name` — 删除分组；删除前校验是否仍被渠道 / 用户引用，被引用时返回警告/阻止。
- `POST   /api/group/manage/:name/channels` — 将渠道加入 / 移出该组（改 `Channel.Group` CSV + 复用渠道现有 `Ability` 刷新逻辑）；同一接口支持 `enabled` 切换。

现有 `GetGroups`（`controller/group.go:14`）/ `GetUserGroups`（`:32`）保持不变——它们读内存设置，sync-down 后自然正确。

### 5.4 前端 — 主菜单 + 统一页面

- `web/default/src/hooks/use-sidebar-data.ts` 的 `admin` 组中，在 Channels（`:119`）之后插入「分组」项：`url: '/groups'`，图标用 `Layers`（lucide）。
- 新增路由 `web/default/src/routes/_authenticated/groups/index.tsx`（admin-only，参照 channels 路由的权限模式）。
- 新增 `web/default/src/features/groups/`：
  - `index.tsx` — 左分组列表 + 右详情布局 + 顶部全局设置卡片。
  - 分组元数据表单（倍率 / 充值折扣 / 描述 / 可见性 / admin_only / 自动升级 + 阈值 / 参与 auto + 顺序）。
  - 渠道关联子表（渠道行支持「移出 / 启用禁用」与「→去渠道页深编」跳转，跳转携带 group 预过滤参数，复用 channels 页 `:111` 已有的 group 过滤）。
  - `api.ts` — 对接 5.3 的 `/api/group/manage/*`。
- **移除旧入口**：「分组倍率」tab 实际注册在 `web/default/src/features/system-settings/billing/section-registry.tsx`（section id `group-pricing`，`visibleTabs={['groups']}`，渲染 `RatioSettingsCard`；表单本体 `models/group-ratio-form.tsx`）。从 `BILLING_SECTIONS` 删除该 section，其逻辑迁移进新分组页。
- i18n：新菜单项与页面文案走 `t()`，按 `web/default/src/i18n/` 流程补 zh/en（及 `bun run i18n:sync`）。

### 5.6 Phase 2：渠道级 × 模型 计费覆盖（场景 B）

**数据 — `dto/channel_settings.go` 扩展 `ChannelSettings`（即 `Channel.Setting` JSON）**：

```go
ModelRatioOverride      map[string]float64 `json:"model_ratio_override,omitempty"`
CompletionRatioOverride map[string]float64 `json:"completion_ratio_override,omitempty"`
ModelPriceOverride      map[string]float64 `json:"model_price_override,omitempty"`
```

- 键为模型名（与全局计费一致，用 `info.OriginModelName`）。未配置的模型回退全局值。
- 零迁移：老渠道该字段为空 → 全部走全局，行为不变。
- 复用既有 `Channel.Setting` 文本字段，无需新增列。

**计费接入 — `relay/helper/price.go`**：

- `ModelPriceHelper`：在全局查表（`GetModelRatio` / `GetCompletionRatio` / `GetModelPrice`）之后，读取 `info.ChannelSetting` 的覆盖表，若 `info.OriginModelName` 命中则用覆盖值替换对应的 `modelRatio` / `completionRatio` / `modelPrice`，随后照常 `× groupRatioInfo.GroupRatio`。
- `ModelPriceHelperPerCall`：同理覆盖 `modelPrice` / `modelRatio`。
- **组合语义（已确认）**：叠乘 —— `最终计费 = 渠道覆盖倍率（命中时，否则全局） × 分组倍率`。场景 A、B 互不干扰，可叠加使用。
- 选中渠道在计费时已确定（`info.ChannelSetting` 已注入），预扣（pre-consume）与结算（post-consume）走同一 `ModelPriceHelper`，跨渠道重试会按新渠道重算 —— 无需额外处理。
- `tiered_expr` 分支（`modelPriceHelperTiered`）v1 **不**应用渠道覆盖（见非目标，Rule 6）。

**日志/审计透明性**：

- 当渠道覆盖生效时，在消费日志的 `other` / `PriceData` 中记录「生效的 ModelRatio + 来源=渠道覆盖 + channelId」，使账单可追溯（参照 `PriceData.ToSetting()` 现有字段）。

**UI — 渠道编辑抽屉**：

- 在 `web/default/src/features/channels/` 的渠道编辑表单新增「按模型计费覆盖」区：对该渠道支持的模型，可逐模型填 `ModelRatio` / `CompletionRatio` / `ModelPrice` 覆盖（留空=全局）。
- 分组页（§5.4）的渠道子表：对设有覆盖的渠道显示「有覆盖」徽标 + 跳转到渠道编辑抽屉（不在分组页内嵌编辑覆盖，符合 Q4 边界）。

### 5.5 测试

- 后端（参照 `service/group_test.go`）：
  - 迁移回填幂等性：空表回填正确、非空表跳过、四份 map 并集合并正确。
  - sync-down 一致性：CRUD 后 `groups` 表 ↔ `GroupRatio2JSONString()` / `TopupGroupRatio2JSONString()` / `UserUsableGroups2JSONString()` / `AutoGroups2JsonString()` 输出一致。
  - 删除被引用组的校验。
  - 渠道加入/移出后 `Ability` 表正确刷新。
- 三库兼容：`Group` 模型在 SQLite / MySQL / PostgreSQL 下 `AutoMigrate` 通过。
- Phase 2 计费（参照 `relay/helper` 现有测试）：
  - 渠道有覆盖 → 生效 = 覆盖倍率 × 分组倍率；渠道无覆盖 → 生效 = 全局倍率 × 分组倍率。
  - 同模型不同渠道（含/不含覆盖）在同一分组下计费不同。
  - `ModelPrice` 覆盖与 `ModelRatio` 覆盖分别生效。
  - `tiered_expr` 模型不受渠道覆盖影响（回归保护）。
  - 跨渠道重试后按新渠道覆盖重算。

## 6. 风险与缓解

- **同步漂移**：表与 Option JSON 不一致 → 用单一 sync-down 函数（全表重建，非增量）杜绝增量遗漏；加一致性测试。
- **删除孤儿组**：删除仍被渠道/用户引用的组 → 删除前引用校验 + 警告。
- **迁移并集遗漏**：以四份 map 并集回填，避免「只在某一份里出现」的组丢失。
- **JSON 包**：所有 marshal/unmarshal 走 `common.*`（遵守 Rule 1）。
- **计费回归（Phase 2）**：改动 `price.go` 是高敏感区。用单测覆盖「无覆盖时与改动前完全一致」，并保留 `tiered_expr` 回归用例，避免影响存量计费。
- **覆盖键名漂移**：渠道覆盖按 `OriginModelName` 匹配，与全局计费同口径，避免出现 model mapping 后键名不一致。

## 7. 待编写实施计划时细化

- `model/option.go` sync-down 的精确接入点与函数签名。
- 渠道加入/移出复用 `controller/channel.go` 现有逻辑的具体调用。
- 前端 `system-settings/models` section 导航移除后的回退路径。
- Phase 2：`price.go` 覆盖应用的精确位置（`modelRatio`/`completionRatio`/`modelPrice` 赋值点之后、`× groupRatio` 之前）。
- Phase 2：渠道编辑抽屉「按模型计费覆盖」区如何枚举该渠道的可填模型（取 `Channel.Models`）。
- Phase 2：实现前阅读 `pkg/billingexpr/expr.md`，复核 tiered_expr 不受影响（Rule 6）。
