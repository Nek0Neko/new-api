package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestSyncConsumptionGroupsToOptions(t *testing.T) {
	setupGroupTestDB(t)
	_ = DB.AutoMigrate(&Option{})

	if err := (&ConsumptionGroup{Name: "default", ConsumptionRatio: 1, Visibility: "public", InAutoRotation: true, AutoOrder: 1}).Insert(); err != nil {
		t.Fatal(err)
	}
	if err := (&ConsumptionGroup{Name: "premium", ConsumptionRatio: 2, Visibility: "private", AdminOnly: true}).Insert(); err != nil {
		t.Fatal(err)
	}
	if err := SyncConsumptionGroupsToOptions(); err != nil {
		t.Fatalf("sync: %v", err)
	}
	if got := ratio_setting.GetGroupRatio("premium"); got != 2 {
		t.Fatalf("group ratio premium = %v, want 2", got)
	}
	meta, ok := setting.GetUserUsableGroupMeta("premium")
	if !ok || !meta.AdminOnly {
		t.Fatalf("premium meta wrong: %+v ok=%v", meta, ok)
	}
	autos := setting.GetAutoGroups()
	if len(autos) != 1 || autos[0] != "default" {
		t.Fatalf("auto groups wrong: %v", autos)
	}
}
