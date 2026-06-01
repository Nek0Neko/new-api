package model

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// SyncConsumptionGroupsToOptions re-derives the consumption-side Option blobs
// (GroupRatio / UserUsableGroups / AutoGroups) from the full consumption_groups
// table and persists them via UpdateOption. Call after every consumption-group
// write. Note UserUsableGroups meta intentionally omits AutoUpgrade/UpgradeThreshold
// now — those live on the recharge side (RechargeGroupMeta).
func SyncConsumptionGroupsToOptions() error {
	groups, err := GetAllConsumptionGroups()
	if err != nil {
		return err
	}

	groupRatio := map[string]float64{}
	usable := map[string]setting.GroupMeta{}

	type autoEntry struct {
		name  string
		order int
	}
	var autoList []autoEntry

	for _, g := range groups {
		groupRatio[g.Name] = g.ConsumptionRatio
		usable[g.Name] = setting.GroupMeta{
			Description: g.Description,
			Visibility:  g.Visibility,
			AdminOnly:   g.AdminOnly,
		}
		if g.InAutoRotation {
			autoList = append(autoList, autoEntry{g.Name, g.AutoOrder})
		}
	}

	sort.SliceStable(autoList, func(i, j int) bool { return autoList[i].order < autoList[j].order })
	autoNames := make([]string, 0, len(autoList))
	for _, e := range autoList {
		autoNames = append(autoNames, e.name)
	}

	groupRatioJSON, err := common.Marshal(groupRatio)
	if err != nil {
		return err
	}
	usableJSON, err := common.Marshal(usable)
	if err != nil {
		return err
	}
	autoJSON, err := common.Marshal(autoNames)
	if err != nil {
		return err
	}

	if err := UpdateOption("GroupRatio", string(groupRatioJSON)); err != nil {
		return err
	}
	if err := UpdateOption("UserUsableGroups", string(usableJSON)); err != nil {
		return err
	}
	if err := UpdateOption("AutoGroups", string(autoJSON)); err != nil {
		return err
	}
	return nil
}
