package controller

import (
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// ConsumptionGroupItem extends ConsumptionGroup with the derived channel count.
type ConsumptionGroupItem struct {
	model.ConsumptionGroup
	ChannelCount int `json:"channel_count"`
}

// GetConsumptionGroupList returns all consumption groups with per-group channel counts.
func GetConsumptionGroupList(c *gin.Context) {
	groups, err := model.GetAllConsumptionGroups()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	counts, err := model.CountChannelsByGroup()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]ConsumptionGroupItem, 0, len(groups))
	for _, g := range groups {
		items = append(items, ConsumptionGroupItem{ConsumptionGroup: *g, ChannelCount: counts[g.Name]})
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

// CreateConsumptionGroup inserts a new consumption group.
func CreateConsumptionGroup(c *gin.Context) {
	var g model.ConsumptionGroup
	if err := c.ShouldBindJSON(&g); err != nil {
		common.ApiError(c, err)
		return
	}
	if g.Name == "" {
		common.ApiErrorMsg(c, "分组名称不能为空")
		return
	}
	if dup, err := model.IsConsumptionGroupNameDuplicated(0, g.Name); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "分组名称已存在")
		return
	}
	if g.ConsumptionRatio < 0 {
		common.ApiErrorMsg(c, "消费倍率不能为负")
		return
	}
	if g.ConsumptionRatio == 0 {
		g.ConsumptionRatio = 1
	}
	if g.Visibility == "" {
		g.Visibility = setting.GroupVisibilityPublic
	}
	if err := g.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncConsumptionGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &g)
}

// UpdateConsumptionGroup patches an existing consumption group by name.
func UpdateConsumptionGroup(c *gin.Context) {
	name := c.Param("name")
	existing, err := model.GetConsumptionGroupByName(name)
	if err != nil {
		common.ApiErrorMsg(c, "分组不存在")
		return
	}
	var in model.ConsumptionGroup
	if err := c.ShouldBindJSON(&in); err != nil {
		common.ApiError(c, err)
		return
	}
	if in.ConsumptionRatio < 0 {
		common.ApiErrorMsg(c, "消费倍率不能为负")
		return
	}
	existing.Description = in.Description
	existing.ConsumptionRatio = in.ConsumptionRatio
	if existing.ConsumptionRatio == 0 {
		existing.ConsumptionRatio = 1
	}
	existing.Visibility = in.Visibility
	if existing.Visibility == "" {
		existing.Visibility = setting.GroupVisibilityPublic
	}
	existing.AdminOnly = in.AdminOnly
	existing.InAutoRotation = in.InAutoRotation
	existing.AutoOrder = in.AutoOrder
	if err := existing.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncConsumptionGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, existing)
}

// DeleteConsumptionGroup removes a consumption group by name, refusing if channels are still attached.
func DeleteConsumptionGroup(c *gin.Context) {
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
	if err := model.DeleteConsumptionGroupByName(name); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncConsumptionGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"name": name})
}

// GetConsumptionGroupChannels mirrors the Phase 1 GetGroupChannels projection,
// listing channels attached to the given consumption group via the Ability table.
func GetConsumptionGroupChannels(c *gin.Context) {
	name := c.Param("name")
	var channelIds []int
	// Use a map condition so GORM quotes the reserved-word "group" column
	// correctly across SQLite/MySQL/PostgreSQL.
	if err := model.DB.Model(&model.Ability{}).
		Where(map[string]interface{}{"group": name}).
		Distinct("channel_id").
		Pluck("channel_id", &channelIds).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	var channels []model.Channel
	if len(channelIds) > 0 {
		// Project only display columns — never select "key" to avoid leaking secrets.
		// Passing columns as a slice lets GORM quote "group" per-dialect.
		if err := model.DB.
			Select([]string{"id", "name", "status", "type", "group", "tag", "setting"}).
			Where("id IN ?", channelIds).
			Find(&channels).Error; err != nil {
			common.ApiError(c, err)
			return
		}
	}

	// groupChannel is a lightweight projection for the management UI.
	// "setting" is not forwarded to the client; only the derived has_override flag is.
	type groupChannel struct {
		Id          int    `json:"id"`
		Name        string `json:"name"`
		Status      int    `json:"status"`
		Type        int    `json:"type"`
		Group       string `json:"group"`
		Tag         string `json:"tag"`
		HasOverride bool   `json:"has_override"`
	}
	result := make([]groupChannel, 0, len(channels))
	for _, ch := range channels {
		cs := dto.ChannelSettings{}
		if ch.Setting != nil && *ch.Setting != "" {
			// Ignore parse errors: a malformed setting simply yields no overrides.
			_ = common.Unmarshal([]byte(*ch.Setting), &cs)
		}
		hasOverride := len(cs.ModelRatioOverride)+
			len(cs.CompletionRatioOverride)+
			len(cs.ModelPriceOverride) > 0
		result = append(result, groupChannel{
			Id:          ch.Id,
			Name:        ch.Name,
			Status:      ch.Status,
			Type:        ch.Type,
			Group:       ch.Group,
			Tag:         ch.GetTag(),
			HasOverride: hasOverride,
		})
	}
	common.ApiSuccess(c, result)
}

// MutateConsumptionGroupChannel attaches or detaches a single channel to/from a consumption group.
func MutateConsumptionGroupChannel(c *gin.Context) {
	name := c.Param("name")
	var req struct {
		ChannelId int    `json:"channel_id"`
		Action    string `json:"action"` // "attach" | "detach"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	ch, err := model.GetChannelById(req.ChannelId, true)
	if err != nil {
		common.ApiErrorMsg(c, "渠道不存在")
		return
	}
	set := map[string]struct{}{}
	for _, g := range ch.GetGroups() {
		set[g] = struct{}{}
	}
	switch req.Action {
	case "attach":
		// Only attach to a group that actually exists in the table, so we never
		// create a channel tag for an undefined group.
		if _, err := model.GetConsumptionGroupByName(name); err != nil {
			common.ApiErrorMsg(c, "分组不存在，请先在消费分组页面创建")
			return
		}
		set[name] = struct{}{}
	case "detach":
		delete(set, name)
	default:
		common.ApiErrorMsg(c, "无效的 action")
		return
	}
	newGroups := make([]string, 0, len(set))
	for g := range set {
		newGroups = append(newGroups, g)
	}
	sort.Strings(newGroups)
	ch.Group = strings.Join(newGroups, ",")
	if err := ch.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"channel_id": req.ChannelId, "group": ch.Group})
}
