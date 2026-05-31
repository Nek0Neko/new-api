package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
		// default_channel_group is the channel-group pre-selected when admins
		// create a new channel; new_user_default_group is the user-tier
		// assigned to newly registered users (drives TopupGroupRatio).
		// Both are independent so the UI can render the two pickers separately.
		"default_channel_group":  setting.GetDefaultChannelGroup(),
		"new_user_default_group": setting.GetNewUserDefaultGroup(),
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userId := c.GetInt("id")
	// Load the full user so per-user ConsumptionGroups allowlist is honored.
	// Falls through to tier-based resolution when ConsumptionGroups is empty.
	user, err := model.GetUserById(userId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	userUsableGroups := service.GetUserUsableGroupsForUser(user)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		desc, ok := userUsableGroups[groupName]
		if !ok {
			continue
		}
		usableGroups[groupName] = map[string]interface{}{
			"ratio": service.GetUserGroupRatio(user.Group, groupName),
			"desc":  desc,
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]interface{}{
			"ratio": "自动",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}

// GroupManageItem is the wire shape for the unified group-management page.
type GroupManageItem struct {
	model.Group
	ChannelCount int `json:"channel_count"`
}

// GetGroupManageList returns every group with its distinct-channel count, plus the
// global scalars rendered in the page header.
func GetGroupManageList(c *gin.Context) {
	groups, err := model.GetAllGroups()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	counts, err := model.CountChannelsByGroup()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]GroupManageItem, 0, len(groups))
	for _, g := range groups {
		items = append(items, GroupManageItem{Group: *g, ChannelCount: counts[g.Name]})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"groups":                 items,
			"default_channel_group":  setting.GetDefaultChannelGroup(),
			"new_user_default_group": setting.GetNewUserDefaultGroup(),
			"default_use_auto_group": setting.DefaultUseAutoGroup,
		},
	})
}

// CreateGroupManage creates a new group then syncs settings.
func CreateGroupManage(c *gin.Context) {
	var g model.Group
	if err := c.ShouldBindJSON(&g); err != nil {
		common.ApiError(c, err)
		return
	}
	if g.Name == "" {
		common.ApiErrorMsg(c, "分组名称不能为空")
		return
	}
	if dup, err := model.IsGroupNameDuplicated(0, g.Name); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "分组名称已存在")
		return
	}
	if g.ConsumptionRatio == 0 {
		g.ConsumptionRatio = 1
	}
	if g.Visibility == "" {
		g.Visibility = "public"
	}
	if err := g.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &g)
}

// UpdateGroupManage updates an existing group (looked up by :name) then syncs.
// Renames are not supported here to keep Channel.Group / User.Group references
// coherent; deleting + recreating is the explicit path for a rename.
func UpdateGroupManage(c *gin.Context) {
	name := c.Param("name")
	existing, err := model.GetGroupByName(name)
	if err != nil {
		common.ApiErrorMsg(c, "分组不存在")
		return
	}
	var in model.Group
	if err := c.ShouldBindJSON(&in); err != nil {
		common.ApiError(c, err)
		return
	}
	existing.Description = in.Description
	existing.ConsumptionRatio = in.ConsumptionRatio
	existing.TopupRatio = in.TopupRatio
	existing.Visibility = in.Visibility
	existing.AdminOnly = in.AdminOnly
	existing.AutoUpgrade = in.AutoUpgrade
	existing.UpgradeThreshold = in.UpgradeThreshold
	existing.InAutoRotation = in.InAutoRotation
	existing.AutoOrder = in.AutoOrder
	if existing.ConsumptionRatio == 0 {
		existing.ConsumptionRatio = 1
	}
	if existing.Visibility == "" {
		existing.Visibility = "public"
	}
	if err := existing.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, existing)
}

// DeleteGroupManage refuses to delete a group still referenced by any channel.
func DeleteGroupManage(c *gin.Context) {
	name := c.Param("name")
	counts, err := model.CountChannelsByGroup()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if counts[name] > 0 {
		common.ApiErrorMsg(c, "该分组仍被 "+strconv.Itoa(counts[name])+" 个渠道使用，请先解除关联")
		return
	}
	if err := model.DeleteGroupByName(name); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"name": name})
}
