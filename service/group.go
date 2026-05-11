package service

import (
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// GetUserUsableGroups returns the channel groups accessible to a user of the
// given tier. The result maps channel-group name -> display description.
//
// Source of truth for channel groups is ratio_setting.GroupRatio. Tier-specific
// access overlays live in ratio_setting.GroupSpecialUsableGroup, where the
// inner map keys may be prefixed:
//   - "+:name"  grant access (with description)
//   - "-:name"  deny access
//   - "name"    grant access (with description)
//
// Tiers are independent of channel groups; a tier name will never be returned
// here unless an admin has explicitly created a channel group with the same
// name.
func GetUserUsableGroups(userTier string) map[string]string {
	channelGroups := ratio_setting.GetGroupRatioCopy()
	out := make(map[string]string, len(channelGroups))
	for name := range channelGroups {
		out[name] = name
	}

	if userTier != "" {
		if special, ok := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userTier); ok {
			for spec, desc := range special {
				switch {
				case strings.HasPrefix(spec, "-:"):
					delete(out, strings.TrimPrefix(spec, "-:"))
				case strings.HasPrefix(spec, "+:"):
					out[strings.TrimPrefix(spec, "+:")] = desc
				default:
					out[spec] = desc
				}
			}
		}
	}
	return out
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	groups := GetUserUsableGroups(userGroup)
	autoGroups := make([]string, 0)
	for _, group := range setting.GetAutoGroups() {
		if _, ok := groups[group]; ok {
			autoGroups = append(autoGroups, group)
		}
	}
	return autoGroups
}

// GetUserGroupRatio 返回某个 channel group 的倍率。
//
// userGroup 仅作为参数保留以维持调用方签名稳定；用户等级 (tier) 已不再影响
// 计费倍率，倍率完全由 channel group 决定。等级折扣只用于充值优惠，见
// common.TopupGroupRatio。
func GetUserGroupRatio(userGroup, group string) float64 {
	_ = userGroup
	return ratio_setting.GetGroupRatio(group)
}
