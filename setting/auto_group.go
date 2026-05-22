package setting

import (
	"github.com/QuantumNous/new-api/common"
)

var autoGroups = []string{
	"default",
}

var DefaultUseAutoGroup = false

// NewUserDefaultGroup is the group assigned to new users at registration time.
// It is the lookup key for both consumption (GroupRatio) and recharge
// (TopupGroupRatio) pricing — they share the user's Group field.
// Empty falls back to the GORM column default "default".
var NewUserDefaultGroup = "default"

// DefaultChannelGroup is the channel-group assigned to a newly created channel
// when no group is supplied in the request. It is the lookup key for the
// channel-side GroupRatio (request-time billing multiplier) and is independent
// of user tiers (NewUserDefaultGroup / TopupGroupRatio).
//
// An empty value falls back to the literal "default" so legacy channels are not
// silently orphaned during the transition; admins who renamed the default
// channel-group should set this to the new name.
var DefaultChannelGroup = "default"

func GetNewUserDefaultGroup() string {
	if NewUserDefaultGroup == "" {
		return "default"
	}
	return NewUserDefaultGroup
}

// GetDefaultChannelGroup returns the channel-group used for new channels when
// the caller did not specify one. Falls back to "default" if unset.
func GetDefaultChannelGroup() string {
	if DefaultChannelGroup == "" {
		return "default"
	}
	return DefaultChannelGroup
}

func ContainsAutoGroup(group string) bool {
	for _, autoGroup := range autoGroups {
		if autoGroup == group {
			return true
		}
	}
	return false
}

func UpdateAutoGroupsByJsonString(jsonString string) error {
	autoGroups = make([]string, 0)
	return common.Unmarshal([]byte(jsonString), &autoGroups)
}

func AutoGroups2JsonString() string {
	jsonBytes, err := common.Marshal(autoGroups)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

func GetAutoGroups() []string {
	return autoGroups
}
