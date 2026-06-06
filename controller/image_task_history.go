package controller

import (
	"context"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/mediastore"
)

// historyImage is one slimmed output image. The happy path stores only a COS URL
// (plus the upstream's revised prompt). B64Json is a degraded-mode fallback: it
// is kept only when COS offload was skipped/failed (e.g. COS disabled), so the
// image is never lost and can be migrated to COS lazily on the next history read.
type historyImage struct {
	Url           string `json:"url,omitempty"`
	B64Json       string `json:"b64_json,omitempty"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

// imageHistoryItem is the server-owned, slimmed playground history document.
// Its shape mirrors the frontend ImageGenerationItem (minus heavy/base64
// fields) so GetImageHistoryList can pass the stored JSON straight through.
type imageHistoryItem struct {
	Id           string         `json:"id"`
	Prompt       string         `json:"prompt"`
	Model        string         `json:"model"`
	Size         string         `json:"size,omitempty"`
	Quality      string         `json:"quality,omitempty"`
	Mode         string         `json:"mode"`
	CreatedAt    int64          `json:"createdAt"`
	Status       string         `json:"status"`
	TaskId       string         `json:"taskId,omitempty"`
	Images       []historyImage `json:"images"`
	ErrorMessage string         `json:"errorMessage,omitempty"`
}

// fallbackHistoryFields rebuilds a terminal item when the loading row was
// trimmed away (or never written) before the task finished.
type fallbackHistoryFields struct {
	Id        string
	TaskId    string
	Prompt    string
	Model     string
	Mode      string
	CreatedAt int64
}

// buildLoadingHistoryItem produces the JSON document written when a task is
// submitted: status "loading", empty (non-nil) images, params for display.
func buildLoadingHistoryItem(itemId, taskId, prompt, modelName, size, quality, mode string, createdAt int64) string {
	item := imageHistoryItem{
		Id:        itemId,
		Prompt:    prompt,
		Model:     modelName,
		Size:      size,
		Quality:   quality,
		Mode:      mode,
		CreatedAt: createdAt,
		Status:    "loading",
		TaskId:    taskId,
		Images:    []historyImage{},
	}
	b, err := common.Marshal(item)
	if err != nil {
		return ""
	}
	return string(b)
}

// extractHistoryImages parses an OpenAI image response into history images,
// capturing both url- and base64-backed images. Callers run offloadHistoryImages
// to push base64 / expiring upstream urls to COS before persisting.
func extractHistoryImages(respBody []byte) []historyImage {
	out := []historyImage{}
	if len(respBody) == 0 {
		return out
	}
	var parsed struct {
		Data []struct {
			Url           string `json:"url"`
			B64Json       string `json:"b64_json"`
			RevisedPrompt string `json:"revised_prompt"`
		} `json:"data"`
	}
	if err := common.Unmarshal(respBody, &parsed); err != nil {
		return out
	}
	for _, d := range parsed.Data {
		if d.Url == "" && d.B64Json == "" {
			continue
		}
		out = append(out, historyImage{Url: d.Url, B64Json: d.B64Json, RevisedPrompt: d.RevisedPrompt})
	}
	return out
}

// offloadHistoryImages ensures every image is hosted on COS: base64 payloads are
// uploaded and expiring/non-COS upstream urls are re-hosted, replacing each with
// the COS url and dropping the heavy base64 fallback. Images that can't be
// offloaded (COS disabled, upload/download error) are left untouched so nothing
// is lost — a later history read retries them. Returns the (possibly mutated)
// slice and whether anything changed.
func offloadHistoryImages(ctx context.Context, imgs []historyImage) ([]historyImage, bool) {
	changed := false
	for i := range imgs {
		url, did, err := mediastore.EnsureCOSURL(ctx, imgs[i].B64Json, imgs[i].Url)
		if err != nil {
			common.SysError("offload history image to cos failed: " + err.Error())
			continue
		}
		if did {
			imgs[i].Url = url
			imgs[i].B64Json = ""
			changed = true
		}
	}
	return imgs, changed
}

// applyTerminalHistoryItem merges a terminal state onto the existing loading
// document (preserving its params and createdAt). If existing is empty/unparseable
// it rebuilds from fallback. Returns the new JSON and the createdAt to key the row.
func applyTerminalHistoryItem(existing string, fb fallbackHistoryFields, status string, images []historyImage, errMsg string) (string, int64) {
	var item imageHistoryItem
	if existing == "" || common.UnmarshalJsonStr(existing, &item) != nil || item.Id == "" {
		item = imageHistoryItem{
			Id:        fb.Id,
			Prompt:    fb.Prompt,
			Model:     fb.Model,
			Mode:      fb.Mode,
			CreatedAt: fb.CreatedAt,
			TaskId:    fb.TaskId,
		}
	}
	item.Status = status
	if images == nil {
		images = []historyImage{}
	}
	item.Images = images
	item.ErrorMessage = errMsg
	b, err := common.Marshal(item)
	if err != nil {
		return existing, item.CreatedAt
	}
	return string(b), item.CreatedAt
}

// migrateHistoryRowImages is the read-path fallback: if a stored row still holds
// base64 / expiring upstream urls, it offloads them to COS and persists the row
// (one-time), returning the updated JSON. When there's nothing to offload (or COS
// is disabled / a parse fails) the original Data is returned unchanged.
func migrateHistoryRowImages(ctx context.Context, userId int, r model.ImageHistory) string {
	var item imageHistoryItem
	if common.UnmarshalJsonStr(r.Data, &item) != nil || len(item.Images) == 0 {
		return r.Data
	}
	imgs, changed := offloadHistoryImages(ctx, item.Images)
	if !changed {
		return r.Data
	}
	item.Images = imgs
	b, err := common.Marshal(item)
	if err != nil {
		return r.Data
	}
	newData := string(b)
	if err := model.UpsertImageHistory(userId, r.ItemId, r.CreatedAt, newData); err != nil {
		common.SysError("persist migrated image history error: " + err.Error())
	}
	return newData
}

// --- DB write orchestration (called from the task lifecycle) ---

// writeLoadingHistory records the loading row for a submitted task. Best-effort:
// a history failure must not abort the task, so errors are only logged.
func writeLoadingHistory(userId int, itemId, taskId, prompt, modelName, size, quality, mode string, createdAt int64) {
	data := buildLoadingHistoryItem(itemId, taskId, prompt, modelName, size, quality, mode, createdAt)
	if data == "" {
		return
	}
	if err := model.UpsertImageHistory(userId, itemId, createdAt, data); err != nil {
		common.SysError("write loading image history error: " + err.Error())
	}
}

// writeTerminalHistory patches the item to success/error, preserving its params.
func writeTerminalHistory(userId int, itemId string, fb fallbackHistoryFields, status string, images []historyImage, errMsg string) {
	existing, _, err := model.GetImageHistoryItem(userId, itemId)
	if err != nil {
		common.SysError("read image history for terminal patch error: " + err.Error())
	}
	data, createdAt := applyTerminalHistoryItem(existing, fb, status, images, errMsg)
	if data == "" {
		return
	}
	if err := model.UpsertImageHistory(userId, itemId, createdAt, data); err != nil {
		common.SysError("write terminal image history error: " + err.Error())
	}
}
