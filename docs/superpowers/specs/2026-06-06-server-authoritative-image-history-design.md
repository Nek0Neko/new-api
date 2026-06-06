# 服务器权威的图片生成历史（全状态跨端同步）

**日期**: 2026-06-06
**分支**: custom
**前置**: [2026-06-04-image-playground-cross-device-sync-design.md](./2026-06-04-image-playground-cross-device-sync-design.md)、[2026-05-30-async-image-generation-tasks-design.md](./2026-05-30-async-image-generation-tasks-design.md)、[2026-06-03-image-cos-remote-storage-design.md](./2026-06-03-image-cos-remote-storage-design.md)

## 问题

当前画图 playground 只把**成功**（少数情况下失败）的生成同步到服务器，且持久化是**前端驱动**的——前端在终态时 `PUT` 推送到 `ImageHistory` 表。这带来三个缺口：

1. **在途（loading/in-progress）任务不跨端**：只有发起设备本地存了 `taskId`，其他设备无从发现正在跑的任务。
2. **失败常常丢失**：若发起设备在任务失败前关闭，失败状态只落在 `Task` 表，从未进入 `ImageHistory`，其他设备/刷新后看不到。
3. **同步/流式路径完全不入库**：非异步路径在客户端请求内执行，页面一关就断，服务器没有任何记录。

用户诉求：**服务器保持所有请求**，从用户点下提交那一刻起就记录，使任意设备、刷新页面都能同步看到当前状态（在途/失败/成功）。

## 设计决策（已与用户确认）

1. **统一走异步任务路径**：playground 的所有生成都改走服务器端执行的异步任务路径。移除纯客户端的同步/流式路径与 partial-image 即时预览。
2. **后端驱动持久化**：后端在异步任务生命周期内写入 `ImageHistory`（提交=loading，运行=in-progress，结束=success/error）。前端退化为「只读 + 轮询」。
3. **在途/失败与成功一视同仁**：均计入每用户 100 条上限，按时间裁剪，用户可手动删除任意项。
4. **流式代码直接移除**：删除 `generateImageStream`/`editImageStream`/`sse.ts`/`streaming` 状态/partial 预览。
5. **发起设备成功渲染**：继续用轮询 `FetchImageTask` 返回的 `data` 在前端本地解析出图片立即渲染；后端另存一份到 history 供晚加载/跨端设备读取（前后端各解析一次，轻微重复，换取最快显示）。
6. **失败请求记日志**：失败请求要写入 `logs` 表（`LogTypeError`, type=5, quota=0），只是不扣费。范围是**所有 relay 失败**，不限图片。

## 架构：反转控制权

```
任何设备提交
  POST /v1/images/generations/tasks (或 /edits/tasks)
    ├─ Task.Insert()                                   [已有]
    └─ ImageHistory.Upsert(status=loading)             [新增]
         ItemId = taskId
         Data   = { id:taskId, prompt, model, size, quality, mode,
                    createdAt, status:'loading', taskId }
  返回 { task_id, status:'submitted' }

后台 worker runImageTask() 复用 Relay()                 [已有，计费不变]
    ├─ markImageTaskInProgress()
    │     └─ ImageHistory 更新 status=in-progress(loading) [新增]
    └─ finishImageTask()
          ├─ 成功: 解析上游响应中的 COS URL → ImageHistory.images, status=success [新增]
          └─ 失败: ImageHistory status=error + errorMessage(fail_reason)          [新增]

任意设备渲染
    ├─ 进入页面 GET /api/playground/image/history → 全部状态(含 loading/error)
    ├─ 对每个 status=loading 且有 taskId 的行 → 轮询 FetchImageTask(taskId)
    │     （按 userId+taskId 查，任何设备都能查到同一任务 → 天然跨端）
    └─ 轮询到终态 → 本地解析 data 立即渲染
         晚加载/从未轮询的设备 → 直接从 history 行拿到终态结果
```

**关键洞察**：任务轮询接口 `FetchImageTask` 以 `userId+taskId` 为键，不绑定发起设备。只要一台设备从 history 拿到了 loading 行（含 taskId），它就能轮询该任务的进展。因此**无需新增「列出我的任务」接口**——history 的 loading 行本身就是任务发现机制。

后端写 history 的职责分工：
- **loading 行**：让其他设备发现任务（任务发现）。
- **终态行**：作为持久记录，供从未轮询过、或在完成之后才加载的设备读取（晚加载兜底）。

## 数据模型

`ImageHistory` 表**无需改列**（`Data TEXT` 仍存整条 item JSON）。变化在于：

- `ItemId` 对异步项统一使用 `taskId`（前端乐观项在 submit 成功后把自身 `id` 改为 `taskId`，hydrate 时按 id 去重）。
- `Data` 现在可以是任意状态（loading/error/success），不再只有终态。
- `MaxImageHistory = 100` 上限与裁剪逻辑不变；loading 项也计数。
- 裁剪边界：若某 loading 行被裁掉而任务随后完成，`finishImageTask` 用 **upsert**（裁掉后会重新插入）再裁剪——该完成项会重新出现。正常用量下可接受。

item JSON 形状沿用前端 `ImageGenerationItem`，后端构造时只含轻量字段：
`{ id, prompt, model, size, quality, mode, createdAt, status, taskId, images:[{url, revised_prompt?}], errorMessage? }`
**绝不写入** base64（`inputImages`/`maskImage`/`partialImage`/`b64_json`）。

## 后端改动

### `controller/image_task.go`
- `submitImageTask`：解析出 `size`/`quality`/`n`/`mode` 等展示字段（JSON 路径从 body，multipart 路径从 PostForm），Task.Insert 之后写一条 `ImageHistory` loading 行（key=taskId）。
- `markImageTaskInProgress`：更新该 history 行（保持 loading 状态即可，或加 in-progress 进度）。
- `finishImageTask`：
  - 成功：解析 `w.Body`（OpenAI 图片响应 `data:[{url,b64_json,revised_prompt}]`）。提取 `url` 项构造 `images`；若仅 base64（COS 关闭），`images` 留空。写 status=success。
  - 失败：写 status=error + `errorMessage = failReason`。
- 新增 Go 端解析函数 `buildImageHistoryItemFromResponse(...)`：把上游响应转成轻量 item（只取 URL，丢弃 base64）。
- `RecoverInterruptedImageTasks`：把中断任务置 FAILURE 的同时，更新其 history 行为 error（「服务重启，图片任务已中断」）。

### `controller/image_history.go`
- **移除** `validateImageHistoryItem` 与前端 `PUT`（upsert）路由——后端直接经 model 写入，不再经前端校验门。
- 保留 `GetImageHistoryList`、`DeleteImageHistoryItem`、`ClearImageHistoryList`。
- 删除对应的 `image_history_test.go` 中只针对前端 PUT 校验的用例；为后端 item 构造/解析新增单元测试。

### `model/image_history.go`
- 无结构变更。`UpsertImageHistory` 复用。新增/复用一个供 controller 调用的便捷写入方法（已有 Upsert 即可）。

### `router/api-router.go`
- 移除 `PUT /api/playground/image/history` 路由。

## 前端改动

### `use-image-playground.ts`
- generation/edit 永远走异步任务路径（`submitImageGenerationTask`/`submitImageEditTask`）；删除 sync/stream 分支与终态 `pushItemRemote`。
- 乐观 loading 项：submit 成功后将 `item.id` 设为 `taskId`（与服务器行对齐）。
- hydrate：`fetchRemoteHistory()` 为权威来源；对返回的 loading+有 taskId 行恢复轮询；本地 IndexedDB 仅作缓存（COS 关闭时的 base64 结果仍需本地存）。
- 轮询到 SUCCESS：沿用现有 `data` 本地解析渲染。

### `remote-history.ts`
- 删除 `isSyncableItem`、`pushRemoteHistoryItem`、`toRemoteHistoryItem`、`carryOverInFlightItems`（服务器现在直接返回 loading 行，前端不再推送、不再本地拼接在途项）。
- 保留 `fetchRemoteHistory`、`deleteRemoteHistoryItem`、`clearRemoteHistory`。

### 流式移除
- 删除 `generateImageStream`、`editImageStream`、`sse.ts`、`streaming` 状态分支、`partialImage` 渲染。loading 期间仅 spinner。

### `storage.ts`
- 保留本地缓存；移除 streaming/partial 相关的复活逻辑（不再有 streaming 状态）。在途项的复活改由服务器 history 提供，本地无 taskId 的孤儿在途项直接置 error 的逻辑可保留作兜底。

## 边界与限制（接受）

- **COS 关闭（纯 base64）**：图片不入库，后端成功行 `images` 为空。发起设备靠轮询 data 的 base64 本地渲染；其他设备只见「已完成、无图」。本功能以 COS 启用为前提。
- **图生图输入参考图/mask**：base64 重数据不跨端。其他设备只见 prompt + 结果，不见输入图（与现状一致）。
- **裁剪与在途**：见上「裁剪边界」。

## 失败请求日志（独立但同批交付）

诉求：**失败请求要进 `logs` 表，只是不扣费**。当前「退费」与「记日志」是两回事——退费总会发生，但日志被 `ERROR_LOG_ENABLED`（默认 `false`）门着，导致失败默认什么都不记，与预期相反。

现状两条失败路径：
1. **上游报错**：`controller/relay.go` 的 `processChannelError`（约 line 366）调 `model.RecordErrorLog`（`LogTypeError`, quota=0），但被 `constant.ErrorLogEnabled && types.IsRecordErrorLog(err)` 双重门控，默认关。
2. **图片 200 但无图**（`ContextKeyImageNoContent`）：`relay/image_handler.go`（约 line 125-131）直接退费 + 返回 `nil`（成功），`Relay()` 视为成功，**这种失败即使开了开关也永远不记**。

改动：
- **`common/init.go`**：`ERROR_LOG_ENABLED` 默认值由 `false` 改为 `true`。保留环境变量作为运营方 opt-out。继续尊重 `types.IsRecordErrorLog(err)`——被 `ErrOptionWithNoRecordErrorLog()` 显式标记的客户端拒绝（如配额不足）仍不记。
- **`relay/image_handler.go`**：no-content 退费分支在退费 + 返回前补记一条 `model.RecordErrorLog`（`LogTypeError`, quota=0, content=「upstream returned no image content」），用当前 `relayInfo`/`c` 归属到用户/渠道。覆盖同步流式与异步任务两种触发场景。

双重记录规避：默认开关下，模式 1 走 `processChannelError` 记一条；模式 2 走新增分支记一条；两者互斥，无重复。

异步图片任务路径天然受益：`runImageTask` 内的 `Relay()` 失败时（模式 1）经标准错误日志路径记录，归属由复制过去的 context keys（user/channel/token/group）保证。

测试见下「测试」节失败日志条目。

## 计费

不变。异步任务路径的计费完全由 `Relay()` 完成（预扣 + 结算 + 失败退款）。写 `ImageHistory` 与失败日志均与计费无关——失败仍退费，只是额外留一条 quota=0 的日志。

## 测试

- **后端单测**：
  - `buildImageHistoryItemFromResponse`：URL 提取、base64 丢弃、revised_prompt 保留、空响应。
  - submit→loading 行写入；finish 成功/失败更新；recover 置 error。
  - 跨 DB（SQLite/MySQL/PG）的 Upsert + 裁剪。
- **前端**：
  - hydrate 渲染 loading/error/success 三态；对 loading 行恢复轮询。
  - submit 后 id 对齐 taskId、与服务器行去重。
- **手动跨端验证**：设备 A 提交 → 设备 B 立刻看到 loading → A 关闭 → B 轮询到终态；刷新 A 恢复状态。
- **失败日志**：
  - 上游报错的图片任务 → `logs` 表出现一条 `LogTypeError`、quota=0、归属正确用户/渠道的记录。
  - no-content（200 无图）→ 同样出现一条 `LogTypeError` 记录（同步流式与异步任务各验一次）。
  - 配额不足等被 `ErrOptionWithNoRecordErrorLog` 标记的错误 → 仍不记。
  - 失败仍正常退费（日志与退费并存、互不影响）。

## 不做（YAGNI）

- 不新增「列出我的任务」接口（history loading 行已承担发现职责）。
- 不做 WebSocket/推送（轮询已满足）。
- 不为 base64 结果做跨端（违背「DB 不存大 blob」原则）。
