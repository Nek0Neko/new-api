# 多域名按请求 Host 动态判断 — 设计文档

日期：2026-06-08
分支：custom

## 背景

系统当前用单一配置项 `system_setting.ServerAddress`（默认 `http://localhost:3000`）作为对外公网根 URL，被拼接到 OAuth 回调、密码重置邮件、易支付回调、Midjourney 图片 URL、视频内容回链等所有对外链接前面。它是一个**全局单值字符串**，无法支持「同一套后端、多个外部域名访问」的场景。

部署形态：外部多个域名（如 `llms.gaopuer.com`、`llms.totcat.cc`）指向同一 IP，前面有 **nginx 反向代理**，再转发到 Go 服务。终止 TLS 在 nginx，真实 scheme 通过 `X-Forwarded-Proto` 传递，真实域名通过 `Host` / `X-Forwarded-Host` 传递。

## 目标

让对外链接根据**当前请求访问的域名**动态生成，使多个外部域名各自闭环（`llms.gaopuer.com` 访问时回调/邮件/前端 API 地址都用 `llms.gaopuer.com`，`llms.totcat.cc` 同理，互不串台），同时保持安全（白名单兜底）与向后兼容（零配置 = 现状）。

覆盖场景（用户确认全选）：OAuth 回调、前端显示地址、密码重置邮件、支付/MJ 图片/视频回链。

## 安全模型：域名白名单

新增配置项 `TrustedDomains`。只有请求 Host 命中白名单（或等于配置的 `ServerAddress` 自身 host）时才采用动态域名，否则**静默回退**到静态 `ServerAddress`。这样即使攻击者伪造 `Host` / `X-Forwarded-Host` 头，也拿不到非法域名，杜绝 Host 头注入导致的钓鱼/开放重定向/token 泄露。

## 方案选择

采用**集中式 Resolver + 域名白名单**（方案 A）：新增唯一入口 `system_setting.ResolveBaseURL(r *http.Request) string`，所有调用点从直接读 `ServerAddress` 改为调用它。

否决的替代方案：
- 中间件注入 + context 传递：异步/无请求场景失效，oauth 包取值别扭，隐式依赖难追踪。
- 完全信任 Host 无白名单：有钓鱼/开放重定向风险，用户已否决。

## 设计细节

### 1. 配置与数据模型

- 新增配置项 `TrustedDomains`（字符串，换行或逗号分隔），走现有 OptionMap 机制（`model/option.go` 注册默认空值 + `case` 分支），在 `system_setting` 包缓存为解析好的 `[]string`，保存后热更新无需重启。
- 匹配规则：
  - 按 **hostname（去端口）** 不区分大小写比较。
  - 支持 `*.example.com` 一层通配（匹配 `llms.example.com`，**不**匹配裸域 `example.com`，**不**匹配多层 `a.b.example.com`）。
  - 配置的 `ServerAddress` 自身的 host **永远隐式可信**——保证单域名老部署即使不填白名单也照常工作。
- 前端「系统信息」区新增 `Trusted Domains` 多行输入框 + 说明文案，6 语言 i18n，复用现有 `updateOption` 通道保存。

### 2. 核心 Resolver

新增 `setting/system_setting/server_address.go`（与 `ServerAddress` 变量同包）：

```go
// ResolveBaseURL 返回当前请求应使用的对外根 URL（不带末尾斜杠）。
// 规则：r 的有效 Host 命中可信域名 → scheme://host；否则回退到配置的 ServerAddress。
func ResolveBaseURL(r *http.Request) string {
    fallback := strings.TrimRight(ServerAddress, "/")
    if r == nil {
        return fallback                 // 异步/无请求场景
    }
    host := firstForwardedHost(r)        // X-Forwarded-Host 第一个值
    if host == "" {
        host = r.Host
    }
    if host == "" {
        return fallback
    }
    hostname := hostWithoutPort(host)    // 匹配用，去端口
    if !isTrustedDomain(hostname) {      // 含 ServerAddress 自身 host + 白名单 + 通配
        return fallback
    }
    scheme := GetRequestScheme(r)        // 复用抽出的统一逻辑
    return scheme + "://" + host         // 构造用，保留端口
}
```

配套：
- 把 passkey 包私有的 `detectScheme`（处理 `X-Forwarded-Proto` / `r.TLS` / `r.URL.Scheme` / `X-Forwarded-Protocol`）**抽到共享位置**（`GetRequestScheme`），passkey 改为复用，消除重复。
- `firstForwardedHost(r)`：读 `X-Forwarded-Host`，取逗号分隔的第一个值并 trim。
- `isTrustedDomain(hostname)`：先比 `ServerAddress` 的 host，再逐条比白名单（exact + `*.` 通配），全部不区分大小写。

**反向代理处理**：优先读 `X-Forwarded-Host` 再回退 `r.Host`，无论 nginx 是否改写 Host 都能拿到真实外部域名。scheme 经 `X-Forwarded-Proto` 还原（`GetRequestScheme` 已优先读它）。

**安全要点**：matching 永远用去端口的 hostname；构造 URL 用完整 host（保端口，兼容 `localhost:3000`）。任何不可信 Host 都走回退路径，拿不到动态 URL。

对应本部署的配置：
- `TrustedDomains` 填 `llms.gaopuer.com` 和 `llms.totcat.cc`（每行一个）。
- nginx 每个 server 块需带：
  ```nginx
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
  ```

### 3. 调用点改造清单

核心原则：有 `c`/`r` 就传进 `ResolveBaseURL`，没有就传 `nil` 自动回退。

**A 类 — 有请求，改为动态（线程 `c.Request`）：**

| 调用点 | 文件 | 改法 |
|--------|------|------|
| OIDC 回调 redirect_uri | `controller/oidc.go:48` + `oauth/oidc.go:59` | 两处都用 `ResolveBaseURL(c.Request)`，握手两步同域名一致 |
| Discord 回调 | `controller/discord.go:46` + `oauth/discord.go:57` | 同上 |
| 通用 OAuth 回调 | `oauth/generic.go:97` | `ResolveBaseURL(c.Request)` |
| 前端 `server_address` | `controller/misc.go:69` (GetStatus) | 返回 `ResolveBaseURL(c.Request)` |
| 密码重置邮件链接 | `controller/misc.go:316` (`SendPasswordResetEmail`) | `ResolveBaseURL(c.Request)`，白名单兜底防钓鱼 |
| 支付 return 链接 | `controller/return_path.go` + `service/return_path.go` | 函数签名加 `r *http.Request`，topup.go / subscription_payment_epay.go 调用处传 `c.Request` |
| 易支付 notify 回调 | `service/epay.go` `GetCallbackAddress` + `controller/topup.go:202` `GetEpayClient` | `GetCallbackAddress` 加 `r` 参；`CustomCallbackAddress`（显式配置）优先级**保持不变**，高于动态 Host |

**B 类 — 异步/可能无请求，请求在就用、不在就回退：**

| 调用点 | 文件 | 改法 |
|--------|------|------|
| MJ 图片 URL | `controller/midjourney.go:273,298`、`relay/mjproxy_handler.go:144` | handler 内有 `c` 就传，用**生成时的请求域名**；URL 持久化，跨域访问仍可达同后端，可接受 |
| 视频内容回链 | `relay/channel/task/taskcommon/helpers.go:66` | 有请求传 `r`，纯后台任务传 `nil` 回退静态 |
| Passkey | `service/passkey/service.go` | 已是 Host 推导，仅替换为复用抽出的 `GetRequestScheme`，行为不变 |

**不改：** `common.WeChatServerAddress`（独立字段，微信回调要求固定域名，不参与动态）。

### 4. 边界与错误处理

全部**静默回退**到静态 `ServerAddress`，绝不报错中断业务：
- `r == nil` 或有效 Host 空 → 静态地址
- Host 不在白名单（含 ServerAddress 自身 host）→ 静态地址
- `X-Forwarded-Host` / `r.Host` 解析失败 → 静态地址
- 白名单为空且 Host ≠ ServerAddress host → 静态地址（**= 现状，向后兼容**）
- 通配 `*.example.com` 只匹配一层子域，不匹配裸域、不匹配多层

### 5. 测试

Go table-driven，新建 `setting/system_setting/server_address_test.go`：
- 白名单命中 → 返回 `scheme://host`（带端口 / 不带端口各一例）
- 白名单未命中 → 回退静态
- `X-Forwarded-Host` 优先于 `r.Host`
- `X-Forwarded-Proto=https` 决定 scheme（模拟 nginx 反代）
- 通配符 `*.gaopuer.com` 命中 `llms.gaopuer.com`、不命中裸域 / 多层
- ServerAddress 自身 host 隐式可信（空白名单也通过）
- `r == nil` 回退
- 大小写不敏感
- OAuth 一致性：authorize 与 callback 同 Host 算出同一 redirect_uri

### 6. 前端

- 「系统信息」区（`web/default/src/features/system-settings/general/system-info-section.tsx`）新增 `Trusted Domains` 多行 `Textarea`，带说明文案。
- 加入 6 语言 i18n key（en 为 base，zh/fr/ru/ja/vi）。
- 注意：`bun run i18n:sync` 会把中文塞进 `en.json` 的老坑，需手动校正 en 值为英文。

## 向后兼容性

`TrustedDomains` 默认空。空白名单 + Host ≠ ServerAddress host 时，`ResolveBaseURL` 行为与直接读 `ServerAddress` 完全一致。现有单域名部署零配置升级，行为不变。

## 非目标（YAGNI）

- 不做微信回调动态化（要求固定域名）。
- 不做 `CustomCallbackAddress` 动态化（显式配置优先，逃生阀保留）。
- 不做多层通配 / 正则匹配（仅单层 `*.`）。
