package controller

import (
	"encoding/json"

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
	ctx := c.Request.Context()
	items := make([]json.RawMessage, 0, len(rows))
	for _, r := range rows {
		// Fallback: migrate any base64 / expiring upstream urls left in this row to
		// COS, persisting the row so the migration is one-time. Returns the original
		// data unchanged when there's nothing to offload (or COS is disabled).
		items = append(items, json.RawMessage(migrateHistoryRowImages(ctx, userId, r)))
	}
	common.ApiSuccess(c, items)
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
