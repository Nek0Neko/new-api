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

// UpsertImageHistoryItem stores one slimmed history item for the user. The
// request body is the item JSON; its `id` and `createdAt` fields key the row.
func UpsertImageHistoryItem(c *gin.Context) {
	userId := c.GetInt("id")
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var meta struct {
		Id        string `json:"id"`
		CreatedAt int64  `json:"createdAt"`
	}
	if err := common.Unmarshal(body, &meta); err != nil {
		common.ApiErrorMsg(c, "invalid item payload")
		return
	}
	if meta.Id == "" {
		common.ApiErrorMsg(c, "item id is required")
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
