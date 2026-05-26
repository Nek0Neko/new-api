package controller

import (
	"net/http"

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
