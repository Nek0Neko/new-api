package setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// RechargeGroupMeta holds the per-recharge-group attributes the auto-upgrade
// path needs. Stored via the Option table key "RechargeGroupMeta". Kept separate from
// UserUsableGroups (which is consumption-side) so the two concerns never alias.
type RechargeGroupMeta struct {
	Description      string  `json:"description,omitempty"`
	TopupRatio       float64 `json:"topup_ratio,omitempty"`
	AutoUpgrade      bool    `json:"auto_upgrade,omitempty"`
	UpgradeThreshold int64   `json:"upgrade_threshold,omitempty"`
	AdminOnly        bool    `json:"admin_only,omitempty"`
}

var rechargeGroupMeta = map[string]RechargeGroupMeta{}
var rechargeGroupMetaMutex sync.RWMutex

func GetRechargeGroupMeta(name string) (RechargeGroupMeta, bool) {
	rechargeGroupMetaMutex.RLock()
	defer rechargeGroupMetaMutex.RUnlock()
	m, ok := rechargeGroupMeta[name]
	return m, ok
}

func GetRechargeGroupMetaCopy() map[string]RechargeGroupMeta {
	rechargeGroupMetaMutex.RLock()
	defer rechargeGroupMetaMutex.RUnlock()
	out := make(map[string]RechargeGroupMeta, len(rechargeGroupMeta))
	for k, v := range rechargeGroupMeta {
		out[k] = v
	}
	return out
}

func RechargeGroupMeta2JSONString() string {
	rechargeGroupMetaMutex.RLock()
	defer rechargeGroupMetaMutex.RUnlock()
	b, err := common.Marshal(rechargeGroupMeta)
	if err != nil {
		common.SysLog("error marshalling recharge group meta: " + err.Error())
		return "{}"
	}
	return string(b)
}

func UpdateRechargeGroupMetaByJSONString(jsonStr string) error {
	parsed := map[string]RechargeGroupMeta{}
	if jsonStr != "" && jsonStr != "null" {
		if err := common.Unmarshal([]byte(jsonStr), &parsed); err != nil {
			return err
		}
	}
	rechargeGroupMetaMutex.Lock()
	defer rechargeGroupMetaMutex.Unlock()
	rechargeGroupMeta = parsed
	return nil
}

// GetRechargeGroupDescription returns the display label, falling back to the name.
func GetRechargeGroupDescription(name string) string {
	rechargeGroupMetaMutex.RLock()
	defer rechargeGroupMetaMutex.RUnlock()
	if m, ok := rechargeGroupMeta[name]; ok && m.Description != "" {
		return m.Description
	}
	return name
}
