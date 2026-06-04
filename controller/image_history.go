package controller

import (
	"encoding/json"
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

// UpsertImageHistoryItem stores one slimmed history item for the user. The
// request body is the item JSON; its `id` and `createdAt` fields key the row.
// Defense in depth (the frontend already gates this): the payload is size-
// capped and every output image must be a URL with no base64 — base64/oversized
// payloads are rejected rather than persisted.
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
		Id        string `json:"id"`
		CreatedAt int64  `json:"createdAt"`
		Images    []struct {
			Url     string `json:"url"`
			B64Json string `json:"b64_json"`
		} `json:"images"`
	}
	if err := common.Unmarshal(body, &meta); err != nil {
		common.ApiErrorMsg(c, "invalid item payload")
		return
	}
	if meta.Id == "" {
		common.ApiErrorMsg(c, "item id is required")
		return
	}
	if len(meta.Images) == 0 {
		common.ApiErrorMsg(c, "item has no images")
		return
	}
	for _, img := range meta.Images {
		if img.Url == "" || img.B64Json != "" {
			common.ApiErrorMsg(c, "only URL-backed images can be synced")
			return
		}
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
