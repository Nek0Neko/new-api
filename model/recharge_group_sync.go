package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// SyncRechargeGroupsToOptions re-derives the recharge-side Option blobs
// (TopupGroupRatio + RechargeGroupMeta) from the full recharge_groups table and
// persists them via UpdateOption. Call after every recharge-group write.
func SyncRechargeGroupsToOptions() error {
	groups, err := GetAllRechargeGroups()
	if err != nil {
		return err
	}

	topupRatio := map[string]float64{}
	meta := map[string]setting.RechargeGroupMeta{}
	for _, g := range groups {
		topupRatio[g.Name] = g.TopupRatio
		meta[g.Name] = setting.RechargeGroupMeta{
			Description:      g.Description,
			TopupRatio:       g.TopupRatio,
			AutoUpgrade:      g.AutoUpgrade,
			UpgradeThreshold: g.UpgradeThreshold,
			AdminOnly:        g.AdminOnly,
		}
	}

	topupJSON, err := common.Marshal(topupRatio)
	if err != nil {
		return err
	}
	metaJSON, err := common.Marshal(meta)
	if err != nil {
		return err
	}
	if err := UpdateOption("TopupGroupRatio", string(topupJSON)); err != nil {
		return err
	}
	if err := UpdateOption("RechargeGroupMeta", string(metaJSON)); err != nil {
		return err
	}
	return nil
}
