# 异步图片生成任务 — 设计文档

日期：2026-05-30
分支：custom

## 1. 背景与目标

当前图片生成（playground）是**同步**的：前端 `POST /v1/images/generations`，`await` 等待整个上游响应，期间锁住输入。虽然切 tab 不会丢（`keepMounted` + IndexedDB，fetch 在后台继续），但**离开 playground 路由、刷新页面、关闭浏览器或换设备**都会丢失正在进行的生成——hydration 时未完成的流被标记为 error。

目标：**把每一次图片生成做成服务器端任务**。用户提交后立即拿到 `task_id`，可以随意离开页面、刷新、甚至换设备，回来后仍能查到任务状态与最终结果。

### 关键架构差异（决定改造形态）

现有异步任务系统（suno / 视频 / mj，见 `service/task_polling.go`）的模式是**轮询上游异步 API**：上游返回 task_id，后台 goroutine 每 15s 去上游拉状态。

但 OpenAI 等**图片生成上游接口是同步的**——上游在同一个 HTTP 响应里直接返回图片，没有可轮询的上游 task_id。因此"把图片生成做成服务器任务"不能照搬轮询模式，而是：**new-api 自己起后台 goroutine 执行那一次同步上游调用**，把结果落库到 `Task`，客户端轮询的是 new-api 自己的库（不再轮询上游）。

## 2. 设计决策（已定）

1. **加法式，不破坏现有同步 API。** 保留 `/v1/images/generations` 与 `/v1/images/edits` 的同步行为不变（大量外部 API 客户端依赖 OpenAI 兼容的同步语义——图片必须在响应体里返回）。异步是**新增路径**，仅供 web playground 使用。

2. **新增 TaskPlatform = `image`**（`constant/task.go`）。复用现有 `Task` 表，无需新表。

3. **新增异步路由**（async 专用，OpenAI 兼容路径保持不动）：
   - `POST /v1/images/generations/tasks` — 提交，返回 `{ task_id }`
   - `POST /v1/images/edits/tasks` — 提交（编辑/mask），返回 `{ task_id }`
   - `GET  /v1/images/generations/tasks/:task_id` — 查询任务状态与结果

4. **后台执行模型（核心）：**
   - 提交时（请求线程内，`middleware.Distribute()` 已选好渠道）：校验参数 → 应用模型映射 → 计算并 **预扣额度**（复用图片计费逻辑）→ `InitTask` 创建 `Task`（status=`SUBMITTED`，记录 `ChannelId`、`PrivateData.Key`、计费快照）→ `Insert` 落库 → 把 job 投入**有界 worker（信号量限制并发）** → 立即返回 `task_id`。
   - Worker goroutine：把 `Task` 置为 `IN_PROGRESS` → 用提交时锁定的渠道+key 执行**同步**图片 relay（复用 `image_handler.go` 的渠道适配与请求逻辑，抽成可后台调用的函数）→ 成功：响应 JSON 存入 `Task.Data`，status=`SUCCESS`，结算额度；失败：status=`FAILURE`，`FailReason` 记录原因，**全额退款**。
   - 与现有 15s 上游轮询循环**无关**（图片任务不进 `TaskPollingLoop` 的上游拉取分支）。

5. **结果存储：** 上游图片响应 JSON 直接存入 `Task.Data`（`json.RawMessage`，建表为 TEXT/JSON，三库通用）。
   - b64 模式下数据较大（单图 3–5MB）。playground 提交时**优先请求 `response_format=url`**（若该 provider 支持），以减小落库体积；不支持 url 的 provider 退回存 b64。
   - 与现状一致：前端 IndexedDB 已能处理 3–5MB b64。

6. **计费：** 按次计费（per-call），复用现有图片额度计算（从 `image_handler.go` 抽出 `计算图片配额` 的纯函数）。
   - 提交时 `PreConsumeBilling` 预扣；成功时 `SettleBilling`（图片通常预扣=实际，n/quality 若与上游不符则按实际结算）；失败时 `RefundTaskQuota` 全额退。
   - 复用现有 `service/task_billing.go` 的退款/结算与日志（`LogTaskConsumption`）。

7. **崩溃 / 超时恢复：** 主节点（`common.IsMasterNode`）启动时，扫描 platform=`image` 且仍处于 `SUBMITTED`/`IN_PROGRESS` 的任务 → 标记 `FAILURE` + 退款（不自动重试，最简且正确）。另设按 `SubmitTime` 的超时清扫（复用/参照 `sweepTimedOutTasks`），防止 worker 卡死产生僵尸任务。

8. **前端改造（参照已成熟的 video/music playground 轮询）：**
   - `image/api.ts`：新增 `submitImageTask()`（返回 task_id）、`fetchImageTask(taskId)`。
   - `image/use-image-playground.ts`：新增轮询 hook（`pollOnce`/`ensurePolling`/`stopPolling`，间隔约 3s，最大尝试次数约 200，`useRef` 管理定时器，hydration 后自动恢复进行中的任务，组件卸载清理）。
   - item 增加 `taskId` 与服务器状态（`submitting`→`queued`→`in_progress`→`succeeded`/`failed`），存入 IndexedDB（含 `taskId`）。
   - 提交后不再依赖保持连接；离开页面/刷新/换设备回来后凭 `taskId` 续查。

## 3. 取舍（trade-off，可否决）

- **流式预览将与异步任务互斥。** 现有 gpt-image-1 的 partial-image 流式预览需要保持 HTTP 连接，无法在"离开页面也能拿结果"的任务模式下成立。**默认采用异步任务模式**（满足本次核心诉求），任务模式下不做流式预览，改为显示排队/生成中状态。流式预览代码保留，但与异步不同时启用。若你更看重流式预览，可改为"流式（须留在页面）/ 异步任务"二选一开关——但这会增加复杂度，默认不做（YAGNI）。

## 4. 涉及文件

后端：
- `constant/task.go` — 新增 `TaskPlatformImage`
- `relay/image_handler.go` — 抽出可后台复用的图片执行与配额计算函数
- 新增 `controller/image_task.go`（或 `relay/image_task.go`）— 提交/查询/worker 调度
- `router/relay-router.go` — 注册 3 个异步路由
- `service/task_billing.go` — 复用预扣/结算/退款（必要时小幅适配 image platform）
- `main.go` — 启动时图片任务崩溃恢复 + 超时清扫
- `model/task.go` — 复用 `InitTask`/`Insert`/`UpdateWithStatus`/`GetByTaskId`/`GenerateTaskID`，新增按 platform 查未完成图片任务（如已有可复用）

前端：
- `web/default/src/features/playground/image/api.ts`
- `web/default/src/features/playground/image/use-image-playground.ts`
- `web/default/src/features/playground/image/storage.ts`（item 增加 taskId/status 字段）
- `web/default/src/features/playground/image/index.tsx`（状态展示）
- 参照：`web/default/src/features/playground/video/use-video-playground.ts`

## 5. 任务生命周期（图片）

```
提交请求 → 校验+模型映射 → 预扣额度 → InitTask(SUBMITTED) → Insert → 入队worker → 返回 task_id
                                                                              │
worker: IN_PROGRESS → 同步调上游 ── 成功 ─→ Data=响应, SUCCESS, 结算
                                  └ 失败 ─→ FAILURE, FailReason, 退款
前端: 凭 task_id 轮询 GET .../tasks/:id  →  succeeded 展示图片 / failed 展示错误
崩溃恢复: 启动扫 SUBMITTED|IN_PROGRESS(image) → FAILURE + 退款
```

## 6. 非目标（YAGNI）

- 不改造同步 OpenAI 兼容端点的行为。
- 不做任务模式下的流式预览。
- 不做失败自动重试（崩溃任务直接失败退款，由用户重新提交）。
- 不引入新的对象存储/图床（沿用上游返回的 url 或 b64 存 `Task.Data`）。
