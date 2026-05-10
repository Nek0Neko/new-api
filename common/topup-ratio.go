package common

import (
	"encoding/json"
	"sync"
)

// topupGroupRatio is a per-group multiplier applied to the recharge price.
// Convention: a user in this group pays (USD desired) * (platform unit price) *
// topupGroupRatio. A ratio > 1 means this group pays a premium; < 1 a discount.
// Defaults below realise the "1.5 RMB:1 USD" → VIP/SVIP/enterprise ladder;
// admins may override via UpdateTopupGroupRatioByJSONString.
var topupGroupRatio = map[string]float64{
	"default":    1.5,
	"vip":        1.35,
	"svip":       1.2,
	"enterprise": 1,
}
var topupGroupRatioMutex sync.RWMutex

func TopupGroupRatio2JSONString() string {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	jsonBytes, err := json.Marshal(topupGroupRatio)
	if err != nil {
		SysError("error marshalling topup group ratio: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateTopupGroupRatioByJSONString(jsonStr string) error {
	topupGroupRatioMutex.Lock()
	defer topupGroupRatioMutex.Unlock()
	topupGroupRatio = make(map[string]float64)
	return json.Unmarshal([]byte(jsonStr), &topupGroupRatio)
}

func GetTopupGroupRatio(name string) float64 {
	topupGroupRatioMutex.RLock()
	defer topupGroupRatioMutex.RUnlock()
	ratio, ok := topupGroupRatio[name]
	if !ok {
		SysError("topup group ratio not found: " + name)
		return 1
	}
	return ratio
}
