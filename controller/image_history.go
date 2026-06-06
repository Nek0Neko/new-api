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
	items := make([]json.RawMessage, 0, len(rows))
	for _, r := range rows {
		items = append(items, json.RawMessage(r.Data))
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
