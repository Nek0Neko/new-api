package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

func TestSyncRechargeGroupsToOptions(t *testing.T) {
	setupGroupTestDB(t)
	_ = DB.AutoMigrate(&Option{})

	if err := (&RechargeGroup{Name: "default", TopupRatio: 1}).Insert(); err != nil {
		t.Fatal(err)
	}
	if err := (&RechargeGroup{Name: "vip", TopupRatio: 0.8, AutoUpgrade: true, UpgradeThreshold: 15000}).Insert(); err != nil {
		t.Fatal(err)
	}
	if err := SyncRechargeGroupsToOptions(); err != nil {
		t.Fatalf("sync: %v", err)
	}
	if got := common.GetTopupGroupRatio("vip"); got != 0.8 {
		t.Fatalf("topup ratio vip = %v, want 0.8", got)
	}
	m, ok := setting.GetRechargeGroupMeta("vip")
	if !ok || !m.AutoUpgrade || m.UpgradeThreshold != 15000 {
		t.Fatalf("recharge meta vip wrong: %+v ok=%v", m, ok)
	}
}
