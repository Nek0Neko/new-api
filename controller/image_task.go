package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// 异步图片生成任务
//
// 与同步的 /v1/images/generations 不同：客户端 POST .../tasks 后立即拿到 task_id，
// 真正的（同步）上游调用在后台 goroutine 中通过复用 Relay() 完成，结果落库到 Task 表，
// 客户端凭 task_id 轮询 GET .../tasks/:task_id 获取状态与结果。
//
// 这样用户可以离开页面、刷新、关闭浏览器后再回来查看结果（结果存在服务器端）。
//
// 计费完全由 Relay() 自身完成（预扣 + 结算 + 失败自动退款），与同步路径一致，
// 因此本模块不重复处理计费。Task 表仅作"状态 + 结果"容器。

// imageTaskSem 限制后台并发执行的图片任务数，避免突发大量任务压垮上游或本机。
// 容量由环境变量 IMAGE_TASK_CONCURRENCY 控制（默认 8），首次使用时惰性初始化，
// 以确保 .env 已加载后再读取。
var (
	imageTaskSem     chan struct{}
	imageTaskSemOnce sync.Once
)

func initImageTaskSem() {
	n := common.GetEnvOrDefault("IMAGE_TASK_CONCURRENCY", 8)
	if n < 1 {
		n = 1
	}
	imageTaskSem = make(chan struct{}, n)
}

func acquireImageTaskSlot() {
	imageTaskSemOnce.Do(initImageTaskSem)
	imageTaskSem <- struct{}{}
}

func releaseImageTaskSlot() { <-imageTaskSem }

const (
	imageTaskGenerationsPath = "/v1/images/generations"
	imageTaskEditsPath       = "/v1/images/edits"
)

// SubmitImageGenerationTask 提交文生图异步任务。
func SubmitImageGenerationTask(c *gin.Context) {
	submitImageTask(c, imageTaskGenerationsPath)
}

// SubmitImageEditTask 提交图生图（编辑/mask）异步任务。
func SubmitImageEditTask(c *gin.Context) {
	submitImageTask(c, imageTaskEditsPath)
}

func imageTaskUserId(c *gin.Context) int {
	userId := c.GetInt("id")
	if userId == 0 {
		userId = common.GetContextKeyInt(c, constant.ContextKeyUserId)
	}
	return userId
}

func submitImageTask(c *gin.Context, canonicalPath string) {
	userId := imageTaskUserId(c)

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "read request body failed: " + err.Error()}})
		return
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "read request body failed: " + err.Error()}})
		return
	}

	isJSON := strings.HasPrefix(c.ContentType(), "application/json")

	var modelName, prompt, size, quality string
	workBody := bodyBytes
	if isJSON {
		var m map[string]json.RawMessage
		if e := common.Unmarshal(bodyBytes, &m); e == nil {
			// 异步任务无法流式（结果走轮询），强制去掉 stream 相关字段。
			delete(m, "stream")
			delete(m, "partial_images")
			_ = common.Unmarshal(m["model"], &modelName)
			_ = common.Unmarshal(m["prompt"], &prompt)
			_ = common.Unmarshal(m["size"], &size)
			_ = common.Unmarshal(m["quality"], &quality)
			if nb, e2 := common.Marshal(m); e2 == nil {
				workBody = nb
			}
		}
	} else {
		// multipart（图生图）：原样透传 body，仅尽力提取元信息用于展示/日志。
		modelName = c.PostForm("model")
		prompt = c.PostForm("prompt")
		size = c.PostForm("size")
		quality = c.PostForm("quality")
	}

	// The frontend sends a stable client item id so the history row matches the
	// playground card across submit/retry/devices. It is resolved to the task id
	// below (after the task id is generated) when the header is absent.
	historyItemId := c.GetHeader("X-Playground-Item-Id")
	mode := "generation"
	if canonicalPath == imageTaskEditsPath {
		mode = "edit"
	}

	channelId := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)

	taskID := model.GenerateTaskID()
	now := time.Now().Unix()
	// Resolve the history item id before building the task so it can be persisted
	// on the task record — startup recovery needs it to patch the correct row.
	if historyItemId == "" {
		historyItemId = taskID
	}
	task := &model.Task{
		TaskID:     taskID,
		Platform:   constant.TaskPlatformImage,
		UserId:     userId,
		ChannelId:  channelId,
		Group:      group,
		Action:     constant.TaskActionGenerate,
		Status:     model.TaskStatusSubmitted,
		Progress:   "0%",
		SubmitTime: now,
		Properties: model.Properties{
			Input:           prompt,
			OriginModelName: modelName,
			HistoryItemId:   historyItemId,
			HistoryMode:     mode,
		},
	}
	if err := task.Insert(); err != nil {
		common.SysError("insert image task error: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "create image task failed"}})
		return
	}

	createdAtMs := now * 1000
	// Server owns the history: record a loading row now so every device (and a
	// refresh) sees the in-flight generation, not just the submitting tab.
	writeLoadingHistory(userId, historyItemId, taskID, prompt, modelName, size, quality, mode, createdAtMs)

	// c.Copy() 返回可在 goroutine 中安全使用的上下文副本（脱离原请求生命周期）。
	cc := c.Copy()
	gopool.Go(func() {
		runImageTask(cc, workBody, canonicalPath, taskID, userId, historyItemId)
	})

	c.JSON(http.StatusOK, gin.H{
		"task_id":     taskID,
		"status":      string(model.TaskStatusSubmitted),
		"submit_time": now,
	})
}

// runImageTask 在后台执行一次"同步"图片生成：用一个全新的、脱离原请求的 gin.Context
// （httptest.ResponseRecorder 作为 writer + 拷贝原请求的 context keys + 重放请求体）
// 调用现有 Relay()，复用全部 relay/adaptor/计费/重试逻辑，再把响应体落库。
func runImageTask(cc *gin.Context, body []byte, canonicalPath, taskID string, userId int, historyItemId string) {
	acquireImageTaskSlot()
	defer releaseImageTaskSlot()

	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("image task %s panic: %v", taskID, r))
			finishImageTask(taskID, userId, historyItemId, model.TaskStatusFailure, "internal error", nil)
		}
	}()

	markImageTaskInProgress(taskID, userId)

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	for k, v := range cc.Keys {
		// 跳过缓存的 body storage，强制 worker 从重放的请求体重新构建。
		if k == common.KeyBodyStorage {
			continue
		}
		ctx.Set(k, v)
	}

	req := cc.Request.Clone(context.Background())
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	// 规整路径，使 Path2RelayMode 解析出正确的 RelayMode（generations / edits）。
	req.URL.Path = canonicalPath
	req.RequestURI = ""
	// 去掉 SSE Accept，避免被当作流式响应。
	req.Header.Del("Accept")
	ctx.Request = req

	Relay(ctx, types.RelayFormatOpenAIImage)

	// A streaming upstream that delivers no image flags ContextKeyImageNoContent
	// and returns success (the SSE response is already a 200), leaving an SSE
	// body — not an image — in the recorder. Treat that (and any non-JSON body)
	// as a failure so the card surfaces an error instead of spinning forever,
	// and so invalid JSON never poisons task.Data.
	noImageContent := common.GetContextKeyBool(ctx, constant.ContextKeyImageNoContent)
	if isImageTaskSuccess(w.Code, noImageContent, w.Body.Bytes()) {
		finishImageTask(taskID, userId, historyItemId, model.TaskStatusSuccess, "", w.Body.Bytes())
	} else if noImageContent {
		finishImageTask(taskID, userId, historyItemId, model.TaskStatusFailure, "upstream returned no image content", nil)
	} else {
		finishImageTask(taskID, userId, historyItemId, model.TaskStatusFailure, extractImageTaskError(w.Body.Bytes(), w.Code), nil)
	}
}

// isImageTaskSuccess reports whether a finished async image-task replay actually
// produced an image. The only success is HTTP 200 with the no-image-content flag
// unset AND a valid-JSON body: a streaming "no image" response (flagged, body is
// SSE text) or any non-JSON/empty body is a failure. Requiring valid JSON also
// guarantees a non-JSON body never lands in task.Data (which would break the
// poll response on SQLite or the row update on MySQL/PostgreSQL json columns).
func isImageTaskSuccess(code int, noImageContent bool, body []byte) bool {
	return code == http.StatusOK && !noImageContent && json.Valid(body)
}

func markImageTaskInProgress(taskID string, userId int) {
	task, exist, err := model.GetByTaskId(userId, taskID)
	if err != nil || !exist || task == nil {
		return
	}
	task.Status = model.TaskStatusInProgress
	task.Progress = "10%"
	task.StartTime = time.Now().Unix()
	if e := task.Update(); e != nil {
		common.SysError("update image task error: " + e.Error())
	}
}

func finishImageTask(taskID string, userId int, historyItemId string, status model.TaskStatus, failReason string, data []byte) {
	task, exist, err := model.GetByTaskId(userId, taskID)
	if err != nil || !exist || task == nil {
		return
	}
	task.Status = status
	task.Progress = "100%"
	task.FinishTime = time.Now().Unix()
	if failReason != "" {
		task.FailReason = failReason
	}
	// Offload images to COS before persisting so BOTH the poll payload (task.Data,
	// returned by FetchImageTask) and the history row store durable COS urls — not
	// base64 or expiring upstream urls. This runs regardless of channel
	// pass-through / response_format, which the relay-time offload depends on.
	// Anything that can't be offloaded (COS disabled / error) is left as-is.
	if status == model.TaskStatusSuccess && len(data) > 0 && json.Valid(data) {
		if offloaded, changed := mediastore.OffloadImageResponseBody(context.Background(), data); changed {
			data = offloaded
		}
	}
	// Only persist a valid-JSON payload: task.Data is a json column, so storing
	// non-JSON bytes would make this Update fail on MySQL/PostgreSQL (leaving the
	// task stuck) or break FetchImageTask's JSON serialization on SQLite.
	if len(data) > 0 && json.Valid(data) {
		task.Data = json.RawMessage(data)
	}
	if e := task.Update(); e != nil {
		common.SysError("update image task error: " + e.Error())
	}

	// Mirror the terminal state into the playground history so every device sees
	// the result/failure without polling. Fallback fields cover a trimmed row.
	if historyItemId == "" {
		historyItemId = taskID
	}
	fbMode := task.Properties.HistoryMode
	if fbMode == "" {
		fbMode = "generation"
	}
	fb := fallbackHistoryFields{
		Id:        historyItemId,
		TaskId:    taskID,
		Prompt:    task.Properties.Input,
		Model:     task.Properties.OriginModelName,
		Mode:      fbMode,
		CreatedAt: task.SubmitTime * 1000,
	}
	if status == model.TaskStatusSuccess {
		// data was already offloaded to COS above, so the history row inherits the
		// same durable urls (base64 is kept only when COS couldn't run, for the
		// lazy read-path retry in GetImageHistoryList).
		writeTerminalHistory(userId, historyItemId, fb, "success", extractHistoryImages(data), "")
	} else {
		writeTerminalHistory(userId, historyItemId, fb, "error", nil, failReason)
	}
}

func extractImageTaskError(body []byte, code int) string {
	if len(body) > 0 {
		var e struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := common.Unmarshal(body, &e); err == nil && e.Error.Message != "" {
			return e.Error.Message
		}
		s := strings.TrimSpace(string(body))
		if s != "" {
			if len(s) > 500 {
				s = s[:500]
			}
			return s
		}
	}
	return fmt.Sprintf("image generation failed (status %d)", code)
}

// FetchImageTask 查询图片任务的状态与结果。
func FetchImageTask(c *gin.Context) {
	userId := imageTaskUserId(c)
	taskID := c.Param("task_id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "task_id is required"}})
		return
	}
	task, exist, err := model.GetByTaskId(userId, taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if !exist || task == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "task not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"task_id":     task.TaskID,
		"status":      string(task.Status),
		"progress":    task.Progress,
		"fail_reason": task.FailReason,
		"submit_time": task.SubmitTime,
		"finish_time": task.FinishTime,
		"data":        task.Data,
	})
}

// RecoverInterruptedImageTasks 在（主节点）启动时把所有未完成的图片任务标记为失败。
// 因为后台 worker 随进程一起消失，重启后无法续跑——直接置为失败，由用户重新提交。
func RecoverInterruptedImageTasks() {
	const reason = "服务重启，图片任务已中断，请重新提交"
	// Patch each task's playground history row to error first (the task record's
	// item-id link is the task id; client-id rows that were trimmed fall back),
	// then flip the task records in bulk.
	if tasks, err := model.GetUnfinishedImageTasks(); err != nil {
		common.SysError("list interrupted image tasks error: " + err.Error())
	} else {
		for _, t := range tasks {
			if t == nil {
				continue
			}
			histItemId := t.Properties.HistoryItemId
			if histItemId == "" {
				histItemId = t.TaskID
			}
			histMode := t.Properties.HistoryMode
			if histMode == "" {
				histMode = "generation"
			}
			fb := fallbackHistoryFields{
				Id:        histItemId,
				TaskId:    t.TaskID,
				Prompt:    t.Properties.Input,
				Model:     t.Properties.OriginModelName,
				Mode:      histMode,
				CreatedAt: t.SubmitTime * 1000,
			}
			writeTerminalHistory(t.UserId, histItemId, fb, "error", nil, reason)
		}
	}
	n, err := model.FailUnfinishedImageTasks(reason)
	if err != nil {
		common.SysError("recover interrupted image tasks error: " + err.Error())
		return
	}
	if n > 0 {
		common.SysLog(fmt.Sprintf("recovered %d interrupted image task(s) on startup", n))
	}
}
