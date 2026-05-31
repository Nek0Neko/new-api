package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupGroupTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Group{}, &Channel{}, &Ability{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	DB = db
	common.UsingSQLite = true
}

func TestBackfillGroupsFromSettings(t *testing.T) {
	setupGroupTestDB(t)

	_ = ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2}`)
	_ = setting.UpdateUserUsableGroupsByJSONString(`{"vip":{"description":"VIP","visibility":"public","auto_upgrade":true,"upgrade_threshold":15000}}`)
	_ = common.UpdateTopupGroupRatioByJSONString(`{"vip":1.35}`)
	_ = setting.UpdateAutoGroupsByJsonString(`["default"]`)

	if err := BackfillGroupsFromSettings(); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	groups, _ := GetAllGroups()
	if len(groups) != 2 {
		t.Fatalf("expected 2 groups (default,vip), got %d", len(groups))
	}

	vip, err := GetGroupByName("vip")
	if err != nil {
		t.Fatalf("get vip: %v", err)
	}
	if vip.ConsumptionRatio != 2 {
		t.Errorf("vip consumption ratio = %v, want 2", vip.ConsumptionRatio)
	}
	if vip.TopupRatio != 1.35 {
		t.Errorf("vip topup ratio = %v, want 1.35", vip.TopupRatio)
	}
	if vip.Description != "VIP" || !vip.AutoUpgrade || vip.UpgradeThreshold != 15000 {
		t.Errorf("vip meta mismatch: %+v", vip)
	}

	def, _ := GetGroupByName("default")
	if !def.InAutoRotation {
		t.Errorf("default should be in auto rotation")
	}

	if err := BackfillGroupsFromSettings(); err != nil {
		t.Fatalf("backfill 2: %v", err)
	}
	groups2, _ := GetAllGroups()
	if len(groups2) != 2 {
		t.Fatalf("backfill not idempotent: got %d groups", len(groups2))
	}
}
