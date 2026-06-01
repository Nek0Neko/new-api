package model

import "testing"

func TestRechargeGroupInsertAndGet(t *testing.T) {
	setupGroupTestDB(t)
	g := &RechargeGroup{Name: "vip", TopupRatio: 0.8, AutoUpgrade: true, UpgradeThreshold: 15000}
	if err := g.Insert(); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := GetRechargeGroupByName("vip")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.TopupRatio != 0.8 || !got.AutoUpgrade || got.UpgradeThreshold != 15000 {
		t.Fatalf("unexpected row: %+v", got)
	}
	if got.CreatedTime == 0 || got.UpdatedTime == 0 {
		t.Fatalf("timestamps not set: %+v", got)
	}
}
