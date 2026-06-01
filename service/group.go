package service

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
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

// GetUserUsableGroupsForUser returns the channel groups a specific user may
// currently use. Resolution rules:
//
//  1. If user.ConsumptionGroups holds an explicit allowlist (non-empty JSON
//     array), only those groups are returned, further intersected with the
//     current ratio_setting.GroupRatio so groups deleted by an admin since
//     the allowlist was saved are silently dropped.
//  2. Otherwise, fall back to tier-based resolution via GetUserUsableGroups
//     so legacy users (and users the admin has not explicitly scoped)
//     continue to inherit GroupSpecialUsableGroup rules.
//
// Description values are best-effort:
//   - For groups present in the tier-based map, the tier description wins.
//   - For groups in the explicit allowlist but absent from the tier map, the
//     group name is used as the description placeholder (the admin opted in
//     to that group by name, so we don't synthesize a fake label).
func GetUserUsableGroupsForUser(user *model.User) map[string]string {
	if user == nil {
		return map[string]string{}
	}
	return resolveUsableGroups(user.Group, user.GetConsumptionGroupsList())
}

// GetUserUsableGroupsForUserCache mirrors GetUserUsableGroupsForUser but
// operates on the cached UserBase surface so request-time middleware can
// avoid a DB round-trip.
func GetUserUsableGroupsForUserCache(cache *model.UserBase) map[string]string {
	if cache == nil {
		return map[string]string{}
	}
	return resolveUsableGroups(cache.Group, cache.GetConsumptionGroupsList())
}

// GroupInUserUsableGroupsForUserCache is the cache-friendly equivalent of
// GroupInUserUsableGroups for middleware hot paths.
func GroupInUserUsableGroupsForUserCache(cache *model.UserBase, groupName string) bool {
	if cache == nil {
		return false
	}
	_, ok := resolveUsableGroups(cache.Group, cache.GetConsumptionGroupsList())[groupName]
	return ok
}

// resolveUsableGroups is the shared core for the per-user resolvers above.
// Splitting it out avoids duplicating the allowlist-vs-fallback decision in
// two call sites and keeps both helpers byte-for-byte consistent.
func resolveUsableGroups(tier string, explicitAllowlist []string) map[string]string {
	tierMap := GetUserUsableGroups(tier)
	if len(explicitAllowlist) == 0 {
		out := make(map[string]string, len(tierMap))
		for name, desc := range tierMap {
			// admin-only / private groups are not auto-granted when the user has
			// no explicit allowlist; they must be assigned explicitly.
			if meta, ok := setting.GetUserUsableGroupMeta(name); ok && !meta.IsPublic() {
				continue
			}
			out[name] = desc
		}
		return out
	}

	channelGroups := ratio_setting.GetGroupRatioCopy()
	out := make(map[string]string, len(explicitAllowlist))
	for _, name := range explicitAllowlist {
		if _, valid := channelGroups[name]; !valid {
			// Group was deleted from GroupRatio after the allowlist was
			// saved; silently drop it so callers see a coherent picture.
			continue
		}
		if desc, ok := tierMap[name]; ok {
			out[name] = desc
		} else {
			out[name] = name
		}
	}
	return out
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
