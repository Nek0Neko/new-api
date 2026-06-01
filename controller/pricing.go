package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	pricing := model.GetPricing()
	userId, exists := c.Get("id")

	// channel-group → ratio, the only billing multiplier that applies at request time.
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}

	// User tier (default/vip/svip/enterprise) — purely a badge that affects
	// recharge price via common.TopupGroupRatio. Never multiplied into request
	// billing.
	var userTier string
	var topupRatio float64 = 1
	var tierDesc string
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			userTier = user.Group
			topupRatio = common.GetTopupGroupRatio(userTier)
			if meta, ok := setting.GetRechargeGroupMeta(userTier); ok {
				tierDesc = meta.Description
			}
		}
	}

	// Channel groups visible to this tier. Tiers can be granted or denied
	// access to channel groups via GroupSpecialUsableGroup.
	usableGroup := service.GetUserUsableGroups(userTier)
	pricing = filterPricingByUsableGroups(pricing, usableGroup)
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	tierMeta := gin.H{
		"name":        userTier,
		"description": tierDesc,
		"topup_ratio": topupRatio,
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        service.GetUserAutoGroup(userTier),
		"user_tier":          userTier,
		"user_tier_meta":     tierMeta,
		"topup_ratio":        topupRatio,
		"pricing_version":    "b91e4ad8fe7f23c5d20f7ee8c4a91234",
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
