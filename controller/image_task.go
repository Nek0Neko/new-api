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

	var modelName, prompt string
	workBody := bodyBytes
	if isJSON {
		var m map[string]json.RawMessage
		if e := common.Unmarshal(bodyBytes, &m); e == nil {
			// 异步任务无法流式（结果走轮询），强制去掉 stream 相关字段。
			delete(m, "stream")
			delete(m, "partial_images")
			_ = json.Unmarshal(m["model"], &modelName)
			_ = json.Unmarshal(m["prompt"], &prompt)
			if nb, e2 := common.Marshal(m); e2 == nil {
				workBody = nb
			}
		}
	} else {
		// multipart（图生图）：原样透传 body，仅尽力提取元信息用于展示/日志。
		modelName = c.PostForm("model")
		prompt = c.PostForm("prompt")
	}

	channelId := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)

	taskID := model.GenerateTaskID()
	now := time.Now().Unix()
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
		},
	}
	if err := task.Insert(); err != nil {
		common.SysError("insert image task error: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": "create image task failed"}})
		return
	}

	// c.Copy() 返回可在 goroutine 中安全使用的上下文副本（脱离原请求生命周期）。
	cc := c.Copy()
	gopool.Go(func() {
		runImageTask(cc, workBody, canonicalPath, taskID, userId)
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
func runImageTask(cc *gin.Context, body []byte, canonicalPath, taskID string, userId int) {
	acquireImageTaskSlot()
	defer releaseImageTaskSlot()

	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("image task %s panic: %v", taskID, r))
			finishImageTask(taskID, userId, model.TaskStatusFailure, "internal error", nil)
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

	if w.Code == http.StatusOK {
		finishImageTask(taskID, userId, model.TaskStatusSuccess, "", w.Body.Bytes())
	} else {
		finishImageTask(taskID, userId, model.TaskStatusFailure, extractImageTaskError(w.Body.Bytes(), w.Code), nil)
	}
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

func finishImageTask(taskID string, userId int, status model.TaskStatus, failReason string, data []byte) {
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
	if len(data) > 0 {
		task.Data = json.RawMessage(data)
	}
	if e := task.Update(); e != nil {
		common.SysError("update image task error: " + e.Error())
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
	n, err := model.FailUnfinishedImageTasks("服务重启，图片任务已中断，请重新提交")
	if err != nil {
		common.SysError("recover interrupted image tasks error: " + err.Error())
		return
	}
	if n > 0 {
		common.SysLog(fmt.Sprintf("recovered %d interrupted image task(s) on startup", n))
	}
}
