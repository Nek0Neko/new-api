# 图片生成结果远程对象存储（腾讯云 COS）设计

- 日期：2026-06-03
- 分支：custom
- 状态：已通过设计评审，待生成实现计划

## 1. 背景与问题

图片 playground 当前把生成图以 base64（`b64_json`）形式渲染：`resolveImageSrc`
构造 `data:image/png;base64,...` 作为 `<img src>`，并把完整 base64 持久化到
IndexedDB（`use-image-playground.ts` 的 `saveImageItems`）。`gpt-image-1` 这类模型
只产出 b64，单图 base64 字符串可达数 MB。浏览器在执行动画（网格展开、预览器过渡、
masonry 布局等）时需要在主线程处理这些超长 data URL，导致掉帧卡顿。

DALL·E / Ali 等已原生返回 URL 的通道不卡顿——卡顿只来自返回大 b64 的 OpenAI 兼容通道。

目标：让后端把这类生成图上传到腾讯云 COS，前端改用普通 URL 渲染，使 base64 不再进入
渲染/动画路径，也不再长期堆积在 IndexedDB。

## 2. 现状要点（代码事实）

- 前端渲染：`web/default/src/features/playground/image/index.tsx:49-55`（`resolveImageSrc`，
  url 优先、b64 回退）；流式 partial 内联 b64 `:115-121`。
- 前端请求格式：
  - 非流式同步 `response_format: 'url'`（`use-image-playground.ts:449`）
  - 异步任务 `response_format: 'url'`（`:382`）
  - 流式强制 `response_format: 'b64_json'`（`api.ts:156,209`）
- 流式 SSE 解析：`image/sse.ts:106-117`，`completed` 事件只读 `b64_json`。
- 后端图片中继：`relay/image_handler.go`（`ImageHelper` → `adaptor.DoResponse`）。
- 后端 b64 可得的三个 choke point：
  1. 非流式：`relay/channel/openai/relay-openai.go` `OpenaiHandlerWithUsage`
     （读完整 body 后 `service.IOCopyBytesGracefully` 写回，body 含 `data[].b64_json`）。
  2. 流式：`OpenaiImageStreamHandler` 逐事件转发；`completed` 事件携带最终 b64。
  3. 异步：`controller/image_task.go` `finishImageTask`（落库前可改写 `task.Data`）。
- 现状无任何对象存储集成。`go.mod`：`module github.com/QuantumNous/new-api`，`go 1.25.1`，
  无腾讯 COS SDK。

## 3. 设计决策（已确认）

- **触发方式**：按 `response_format=url` 触发。仅当 COS 开启 + 客户端请求 url + 该图有
  b64 无 url 时上传。直接调 API 且未请求 url 的用户完全不受影响。
- **流式 partial**：保持 b64 内联预览（短暂、符合 OpenAI 协议），只把最终图存 COS。
- **配置管理**：后台设置页 + DB 存储（沿用现有 options 机制，跨 SQLite/MySQL/PG）。
- **访问模型**：公有读 + 可选 CDN/自定义域名，URL 永久有效，适配前端长期 IndexedDB 历史。
- **覆盖范围**：仅 OpenAI 兼容图片通道（卡顿来源）。已原生返 url 的通道不动。

## 4. 架构与数据流

```
playground 请求 (response_format=url)
        │
   relay/image_handler.go → adaptor.DoResponse
        │
   ┌────┴───────── 三个 b64 落点接入后处理器 ──────────┐
   │ 非流式: OpenaiHandlerWithUsage
   │ 流式:   OpenaiImageStreamHandler 的 completed 事件
   │ 异步:   finishImageTask 落库前
   └────┬──────────────────────────────────────────────┘
        │  service/mediastore.RewriteImageResponse(body)
        │     · common.Unmarshal → dto.ImageResponse
        │     · 对每个「有 b64、无 url」的图：解码→UploadImage→填 Url、清空 B64Json
        │     · COS 失败 → 原样返回 b64（出图不受影响）
        ▼
   返回前端 { data:[{ url:"https://cdn.../xxx.png" }] }
        ▼
   resolveImageSrc 用 url，base64 不再进渲染/动画路径
```

## 5. 组件设计

### 5.1 `setting/object_storage_setting/`（DB 配置）
沿用现有 setting 包模式，字段：
- `Enabled bool`
- `SecretID string`
- `SecretKey string`（管理端 UI 脱敏显示）
- `Region string`（如 `ap-guangzhou`）
- `Bucket string`（含 appid，如 `mybucket-1250000000`）
- `CustomDomain string`（可选，CDN/自定义域名，为空则用桶默认域名）
- `PathPrefix string`（默认 `images/`）

存储走现有 options 表机制，三种数据库通用，无需自定义迁移。

### 5.2 `service/mediastore/`（复用型上传器）
- 依赖：`github.com/tencentyun/cos-go-sdk-v5`（go.mod 新增）。
- `UploadImage(ctx, data []byte, mime string) (url string, err error)`：
  - 对象键 `<PathPrefix>/YYYY/MM/DD/<uuid>.<ext>`，ext 由 mime 推断（png/jpeg/webp...）。
  - 上传时设置 Content-Type；对象 public-read（或依赖桶级公有读）。
  - 返回 `CustomDomain || 桶默认域名` 拼接 key 的完整 URL。
- `RewriteImageResponse(body []byte) (newBody []byte, changed bool)`：
  - `common.Unmarshal` 到 `dto.ImageResponse`；遍历 `Data`。
  - 对「有 `B64Json`、无 `Url`」的项：base64 解码 → `UploadImage` → 设 `Url`、清空 `B64Json`。
  - 任一上传失败：记录日志，该项保留原 b64（整体降级，不报错）。
  - 有改动时 `common.Marshal` 回写；无改动返回原 body。
  - JSON 全程走 `common/json.go` 包装（Rule 1）。
- COS 客户端通过接口注入，便于单测 mock。

### 5.3 后处理接入点
1. **非流式**：OpenAI 图片响应路径，在写回客户端前，若 COS 开启 + 客户端请求 url，
   对 body 跑 `RewriteImageResponse` 再 `IOCopyBytesGracefully`。
2. **流式**：`OpenaiImageStreamHandler` 中，partial 事件原样透传；`completed` 事件解析出
   b64 → 上传 → 改写该 SSE data 为携带 `url`、去掉 `b64_json`，再 `StringData` 转发。
   为保证 partial 正常，`ConvertImageRequest` 对流式仍按 b64 与上游协商（即使客户端
   传 url，上游内部用 b64），仅把 url 作为「存 COS」的内部信号。
3. **异步任务**：`finishImageTask` 落库前对 `data` 跑 `RewriteImageResponse`，DB 直接存 url。

### 5.4 后台设置页
管理端新增「对象存储 / 腾讯云 COS」设置卡片，沿用现有 setting 页的读写模式与脱敏处理。

## 6. 前端改动

- `image/api.ts`：`generateImageStream` / `editImageStream` 的 `response_format`
  由 `'b64_json'` 改为 `'url'`（partial 仍为 b64，由后端强制上游 b64 保证）。
- `image/sse.ts`：`SSEEvent` 与 `finalImage` 增加 `url`；`completed` 事件优先读 `url`，
  回退 `b64_json`；partial 处理不变。
- 非流式 / 异步路径已请求 `url`，**零改动**——后端填好 url 后 `resolveImageSrc` 自动走 url。
- 历史记录因此只存 url、不再存大 b64；旧记录仍含 b64，`resolveImageSrc` 保留兼容回退。

## 7. 容错与边界

- COS 任意失败 → 记日志 + 回退原 b64 响应，**绝不让出图失败**。
- URL 永久有效（公有读 + 可选 CDN），适配前端长期 IndexedDB 历史。
- 保留期交由 COS 桶生命周期规则处理（文档说明，不写代码）。
- `n>1` 多图：逐张上传（先简单实现，后续可并行优化）。

## 8. 测试

- Go：`mediastore.RewriteImageResponse` 单测——b64→url 改写、无 b64 跳过、上传失败回退、
  多图部分失败；COS 客户端用接口 mock 隔离网络。
- 前端：`sse.ts` `completed` 事件 url 优先 / b64 回退的解析测试（沿用现有 tsx 测试运行器）。

## 9. 不做（YAGNI）

- 不改 Ali/Minimax 等已原生返回 url 的通道。
- 不做私有桶预签名 URL。
- 不迁移已存于 IndexedDB 的历史 b64。
- 不引入「所有出图强制进 COS」的全局开关。
