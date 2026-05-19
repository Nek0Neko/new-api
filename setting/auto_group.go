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

func GetNewUserDefaultGroup() string {
	if NewUserDefaultGroup == "" {
		return "default"
	}
	return NewUserDefaultGroup
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
