# 用户可选 API 域名（密钥页）— 设计文档

日期：2026-06-09
分支：custom

## 背景

站点对外只有单一全局根 URL `system_setting.ServerAddress`（默认 `http://localhost:3000`）。前端所有"复制密钥连接信息 / CC Switch / Codex / 接口示例 / 聊天预设"的地址都来自同一个值——`localStorage` 里的 `status.server_address`（后端 `GetStatus` 返回），拿不到才回退 `window.location.origin`。

部署形态：同一套后端挂多个外部域名（如 `llms.gaopuer.com`、`llms.totcat.cc`），nginx 反代到同一 Go 服务。API 密钥**不绑定域名**（`middleware/auth.go` 的 `TokenAuth` 只校验 `sk-xxx` token 本身），因此多域名打 API 早已天然可用。

痛点：用户在前端"复制连接信息""填入 CC Switch"时，地址**恒为主域名**，无法选用其他线路域名。

## 目标

让用户在**密钥页**选择一个 API 域名，使该页的复制 / 配置输出（复制连接信息、CC Switch、Codex）都使用所选域名。可选域名列表由**管理员后台**统一配置（全站共用）。主域名始终作为默认第一项保留，保证老用户行为零变化。

## 非目标（YAGNI）

- 不改 API 鉴权（密钥本就不绑域名，无需改动）。
- 不改定价页接口示例、首页、聊天预设里的 `server_address`（仅密钥页生效）。
- 不实现 `multi-domain-dynamic-host-design` 的后端动态 Host（OAuth/邮件/支付回链闭环）——那是另一件事。
- 不做按用户维度的域名列表（全站共用一份）。
- 不在后端解析域名列表（存原始字符串，前端解析）。

## 方案选择

采用**站点级配置项 + 前端选择器（localStorage 记忆）**：

- 管理员在系统设置填一份多行域名列表，存为新配置项 `UserApiEndpoints`（原始字符串，走现有 OptionMap 机制）。
- 经 `GetStatus` 暴露给前端，落入 `localStorage` 的 `status`。
- 密钥页顶部放一个域名选择器，选择持久化到 `localStorage`；该页所有复制/配置输出改读所选域名。

否决的替代方案：
- 每个对话框/复制动作各自放选择器：交互重复、需改每个入口、用户每次都要重选。
- 自动用当前访问域名（`window.location.origin`）：用户无法在一个页面切换到别的线路。
- 复用 `TrustedDomains` 白名单：白名单语义（含通配符、安全兜底）与"展示给用户的线路"语义不完全一致，混用易混淆。

## 数据流

```
管理员后台填域名列表 ──► 配置项 UserApiEndpoints（原始多行字符串）
        │
        ▼
GetStatus 返回 user_api_endpoints ──► 前端 localStorage 'status'
        │
        ▼
密钥页顶部「域名选择器」(useApiEndpoints，选择存 localStorage)
        │
        ▼
复制连接信息 / CC Switch / Codex 都用所选域名（而非固定 server_address）
```

## 设计细节

### 1. 配置与数据模型

新增配置项 `UserApiEndpoints`（字符串，换行分隔），走现有 OptionMap 机制：

- **`setting/system_setting/`**：新增变量 `UserApiEndpoints string`（默认空）。放在与 `ServerAddress` 同包（`system_setting_old.go` 或新建小文件，跟随现有风格）。
- **`model/option.go`**：
  - 注册默认值 `common.OptionMap["UserApiEndpoints"] = ""`（紧挨 `ServerAddress` 注册处）。
  - 加 `case "UserApiEndpoints": system_setting.UserApiEndpoints = value`（镜像 `ServerAddress` 的 case 写法）。
- **存储格式**：每行一条，`备注|https://域名`，其中 `备注|` 可省略（无备注时整行即域名）。后端**不解析**，只存原始字符串。

格式选择理由：纯字符串、零迁移、热更新无需重启、对 SQLite/MySQL/PostgreSQL 三库无差异。

### 2. 后端暴露

**`controller/misc.go` GetStatus**：在返回的 `gin.H` 里新增一行：

```go
"user_api_endpoints": system_setting.UserApiEndpoints,
```

位置紧挨现有的 `"server_address": system_setting.ServerAddress`。

### 3. 管理员前端（系统信息区）

`web/default/src/features/system-settings/general/system-info-section.tsx`：在现有「服务器地址」输入项附近新增一个多行 `Textarea`「用户可选 API 端点 / User API Endpoints」：

- 占位/说明文案：每行一条，格式 `备注|地址`（备注可省略），示例 `主线路|https://llms.gaopuer.com`。
- 复用现有 `updateOption` 保存通道，绑定 key `UserApiEndpoints`。
- 新增 6 语言 i18n key（en 为 base，zh/fr/ru/ja/vi）。**坑**：`bun run i18n:sync` 会把中文塞进 `en.json`，需手动校正 en 值为英文。

### 4. 用户前端（密钥页）— 核心

#### 4.1 共享 hook `useApiEndpoints()`

放在 keys feature 下（如 `web/default/src/features/keys/hooks/use-api-endpoints.ts`），职责单一：

- 从 `status.server_address` 取主域名 → **永远作为列表第一项、默认项**，label 用 i18n（如「默认线路」）。取不到时回退 `window.location.origin`。
- 解析 `status.user_api_endpoints` 多行字符串 → `Array<{ label: string; url: string }>`：
  - 按行 split，trim，跳过空行。
  - 每行按第一个 `|` 拆 `label` 与 `url`；无 `|` 时 `url = 整行`、`label = url`。
  - 校验 `url`（须是 http(s) 形式），非法行跳过。
  - 与主域名 url 去重（主域名已在第一项）。
- 读/写所选域名到 `localStorage`（key 如 `selected_api_endpoint`，存 url）。
- 回退规则：无选择、或所选 url 已不在当前列表（管理员删了）→ 回退主域名（第一项）。
- 暴露 `{ endpoints, selected, setSelected }`，其中 `selected` 为 `{ label, url }`。

#### 4.2 共享状态接入

所选域名挂到已有的 `api-keys-provider` 上下文（`ApiKeysProvider`）——顶部选择器与行内菜单都在其范围内，避免再引一套全局 store。Provider 内部用 `useApiEndpoints()`，向下暴露 `endpoints / selectedEndpoint / setSelectedEndpoint`。

#### 4.3 选择器组件

密钥页顶部放一个域名下拉选择器：

- 显示 label（无备注则显示域名）。
- **当列表只有 1 项（管理员未配置额外域名）时自动隐藏**——保证现状零变化。
- 选择即写入 `localStorage` 并更新 context。

#### 4.4 接入点改造

删掉现在两个各自为政的本地 `getServerAddress()`，改读所选域名：

| 文件 | 现状 | 改法 |
|------|------|------|
| `features/keys/components/data-table-row-actions.tsx` | 本地 `getServerAddress()` 拼连接信息 | 复制连接信息改用 context 的 `selectedEndpoint.url` |
| `features/keys/components/dialogs/cc-switch-dialog.tsx` | `buildCCSwitchURL` 内部 `getServerAddress()` | `buildCCSwitchURL` 改为接收 `serverAddress` 入参，由调用处传 `selectedEndpoint.url`；删掉内部 `getServerAddress()` |

`cc-switch-dialog` 的 Codex 端点仍是 `serverAddress + '/v1'`，Claude/Gemini 仍是 `serverAddress`，只是 `serverAddress` 来源改为所选域名。

**不动**：`data-table-row-actions.tsx` 里的聊天预设（`useChatPresets().serverAddress`）——聊天不在本需求范围。

### 5. 边界与兼容

- 管理员未配置 `UserApiEndpoints`（默认空）→ 列表只有主域名一项 → 选择器隐藏 → 所有输出仍用主域名 = **现状，完全向后兼容**。
- 所选域名失效（管理员事后删除）→ 静默回退主域名。
- 非法配置行（无 http(s)、空行）→ 解析时跳过，不报错。
- 主域名始终为第一项且为回退目标。

### 6. 测试

前端为主（tsx 测试 runner，沿用项目现有约定）：

- `useApiEndpoints` 解析：
  - `备注|url` 正确拆分 label/url。
  - 无 `|` 时 label = url。
  - 空行 / 非法 url 行被跳过。
  - 主域名恒为第一项；列表与主域名去重。
  - localStorage 选择持久化；所选失效时回退主域名；无选择时回退主域名。
- 选择器：列表只有 1 项时不渲染。
- `buildCCSwitchURL`：传入不同 `serverAddress` 时 endpoint / homepage 正确（Codex 带 `/v1`）。

后端无需新增测试（仅新增一个透传配置项与一个 status 字段）。

## 向后兼容性

`UserApiEndpoints` 默认空。空列表时密钥页仅主域名、选择器隐藏，所有复制/配置输出与现状逐字节一致。现有部署零配置升级，行为不变。
