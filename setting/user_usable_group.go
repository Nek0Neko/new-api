package setting

import (
	"encoding/json"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// GroupMeta describes a user group's display, visibility and upgrade rules.
//
// Storage is via the Option table key "UserUsableGroups". For backwards
// compatibility, legacy values shaped as map[string]string (name -> description)
// are still accepted and migrated on read; see parseUserUsableGroupsJSON.
type GroupMeta struct {
	Description      string `json:"description"`
	Visibility       string `json:"visibility,omitempty"`
	AdminOnly        bool   `json:"admin_only,omitempty"`
	AutoUpgrade      bool   `json:"auto_upgrade,omitempty"`
	UpgradeThreshold int64  `json:"upgrade_threshold,omitempty"`
}

const (
	GroupVisibilityPublic  = "public"
	GroupVisibilityPrivate = "private"
)

// IsAdminOnly reports whether only an administrator may assign users to this group.
func (m GroupMeta) IsAdminOnly() bool { return m.AdminOnly }

// IsPublic reports whether the group should appear in a regular user's group list.
func (m GroupMeta) IsPublic() bool {
	if m.AdminOnly {
		return false
	}
	return m.Visibility == "" || m.Visibility == GroupVisibilityPublic
}

var userUsableGroups = map[string]GroupMeta{
	"default": {
		Description: "默认分组",
		Visibility:  GroupVisibilityPublic,
	},
	"vip": {
		Description:      "VIP分组",
		Visibility:       GroupVisibilityPublic,
		AutoUpgrade:      true,
		UpgradeThreshold: 15000,
	},
	"svip": {
		Description:      "SVIP分组",
		Visibility:       GroupVisibilityPublic,
		AutoUpgrade:      true,
		UpgradeThreshold: 50000,
	},
	"enterprise": {
		Description: "企业分组",
		Visibility:  GroupVisibilityPrivate,
		AdminOnly:   true,
	},
}
var userUsableGroupsMutex sync.RWMutex

// GetUserUsableGroupsCopy returns a copy of all groups as name->description, for
// legacy callers that only care about the display label.
func GetUserUsableGroupsCopy() map[string]string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()
	out := make(map[string]string, len(userUsableGroups))
	for k, v := range userUsableGroups {
		out[k] = v.Description
	}
	return out
}

// GetUserUsableGroupMetaCopy returns a copy of the full metadata map.
func GetUserUsableGroupMetaCopy() map[string]GroupMeta {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()
	out := make(map[string]GroupMeta, len(userUsableGroups))
	for k, v := range userUsableGroups {
		out[k] = v
	}
	return out
}

// GetUserUsableGroupMeta returns the metadata for a single group.
func GetUserUsableGroupMeta(name string) (GroupMeta, bool) {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()
	m, ok := userUsableGroups[name]
	return m, ok
}

// IsAdminOnlyGroup reports whether the named group is configured as admin-only.
// Unknown groups are not admin-only.
func IsAdminOnlyGroup(name string) bool {
	m, ok := GetUserUsableGroupMeta(name)
	if !ok {
		return false
	}
	return m.AdminOnly
}

func UserUsableGroups2JSONString() string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()
	jsonBytes, err := json.Marshal(userUsableGroups)
	if err != nil {
		common.SysLog("error marshalling user groups: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

// UpdateUserUsableGroupsByJSONString accepts both the legacy string-valued
// format ({"default":"默认分组"}) and the GroupMeta format
// ({"default":{"description":"默认分组",...}}). Legacy entries are migrated
// in-memory to GroupMeta with default visibility=public.
func UpdateUserUsableGroupsByJSONString(jsonStr string) error {
	parsed, err := parseUserUsableGroupsJSON(jsonStr)
	if err != nil {
		return err
	}
	userUsableGroupsMutex.Lock()
	defer userUsableGroupsMutex.Unlock()
	userUsableGroups = parsed
	return nil
}

func parseUserUsableGroupsJSON(jsonStr string) (map[string]GroupMeta, error) {
	if jsonStr == "" || jsonStr == "null" {
		return map[string]GroupMeta{}, nil
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
		return nil, err
	}
	out := make(map[string]GroupMeta, len(raw))
	for k, v := range raw {
		var s string
		if err := json.Unmarshal(v, &s); err == nil {
			out[k] = GroupMeta{Description: s, Visibility: GroupVisibilityPublic}
			continue
		}
		var m GroupMeta
		if err := json.Unmarshal(v, &m); err != nil {
			return nil, err
		}
		if m.Visibility == "" && !m.AdminOnly {
			m.Visibility = GroupVisibilityPublic
		}
		out[k] = m
	}
	return out, nil
}

func GetUsableGroupDescription(groupName string) string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()
	if g, ok := userUsableGroups[groupName]; ok {
		return g.Description
	}
	return groupName
}
