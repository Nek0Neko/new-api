package controller

import (
	"encoding/json"
	"errors"
	"io"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetImageHistoryList returns the user's image-playground history, newest first.
// Each entry is the raw stored JSON document (the slimmed item) passed through
// untouched.
func GetImageHistoryList(c *gin.Context) {
	userId := c.GetInt("id")
	rows, err := model.GetImageHistory(userId, model.MaxImageHistory)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]json.RawMessage, 0, len(rows))
	for _, r := range rows {
		items = append(items, json.RawMessage(r.Data))
	}
	common.ApiSuccess(c, items)
}

// maxImageHistoryBodyBytes bounds the stored item document. A slimmed item is
// only params plus a handful of COS image URLs (well under a few KB); this cap
// is the server-side guard that keeps multi-MB base64 blobs out of the DB even
// if a client bypasses the frontend gate.
const maxImageHistoryBodyBytes = 256 * 1024 // 256 KB

type imageHistoryImage struct {
	Url     string `json:"url"`
	B64Json string `json:"b64_json"`
}

// validateImageHistoryItem guards an upsert payload. base64 is never stored
// (keeps multi-MB blobs out of the DB). A success must carry at least one
// url-backed image; a terminal error needs no image — its status/reason is what
// the user wants to keep. Anything else is not a persistable terminal state.
func validateImageHistoryItem(status string, images []imageHistoryImage) error {
	for _, img := range images {
		if img.B64Json != "" {
			return errors.New("base64 images cannot be synced")
		}
	}
	switch status {
	case "success":
		if len(images) == 0 {
			return errors.New("successful item has no images")
		}
		for _, img := range images {
			if img.Url == "" {
				return errors.New("image is missing a url")
			}
		}
		return nil
	case "error":
		return nil
	default:
		return errors.New("only success or error items can be synced")
	}
}

// UpsertImageHistoryItem stores one slimmed history item for the user. The
// request body is the item JSON; its `id` and `createdAt` fields key the row.
// Defense in depth (the frontend already gates this): the payload is size-
// capped, base64 images are rejected (no blobs in the DB), and only terminal
// items are persisted — a success must carry URL images, a failure may have
// none so its status still syncs across devices.
func UpsertImageHistoryItem(c *gin.Context) {
	userId := c.GetInt("id")
	// Read one byte past the cap so an over-limit body is detectable.
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxImageHistoryBodyBytes+1))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(body) > maxImageHistoryBodyBytes {
		common.ApiErrorMsg(c, "item payload too large")
		return
	}
	var meta struct {
		Id        string              `json:"id"`
		CreatedAt int64               `json:"createdAt"`
		Status    string              `json:"status"`
		Images    []imageHistoryImage `json:"images"`
	}
	if err := common.Unmarshal(body, &meta); err != nil {
		common.ApiErrorMsg(c, "invalid item payload")
		return
	}
	if meta.Id == "" {
		common.ApiErrorMsg(c, "item id is required")
		return
	}
	if err := validateImageHistoryItem(meta.Status, meta.Images); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if err := model.UpsertImageHistory(userId, meta.Id, meta.CreatedAt, string(body)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// DeleteImageHistoryItem removes a single history item by its client id.
func DeleteImageHistoryItem(c *gin.Context) {
	userId := c.GetInt("id")
	itemId := c.Param("itemId")
	if itemId == "" {
		common.ApiErrorMsg(c, "item id is required")
		return
	}
	if err := model.DeleteImageHistory(userId, itemId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ClearImageHistoryList removes all of the user's image history.
func ClearImageHistoryList(c *gin.Context) {
	userId := c.GetInt("id")
	if err := model.ClearImageHistory(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
