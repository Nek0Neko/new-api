package model

import "testing"

func TestBackfillSplitGroups(t *testing.T) {
	setupGroupTestDB(t)
	// A dual old row that is both a recharge tier and a consumption group.
	if err := (&Group{Name: "vip", ConsumptionRatio: 2, TopupRatio: 0.8, Visibility: "public",
		AutoUpgrade: true, UpgradeThreshold: 15000, InAutoRotation: true, AutoOrder: 1}).Insert(); err != nil {
		t.Fatal(err)
	}
	// A consumption-only row (no topup ratio).
	if err := (&Group{Name: "free", ConsumptionRatio: 1, Visibility: "public"}).Insert(); err != nil {
		t.Fatal(err)
	}

	if err := BackfillSplitGroups(); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	rg, err := GetRechargeGroupByName("vip")
	if err != nil || rg.TopupRatio != 0.8 || !rg.AutoUpgrade {
		t.Fatalf("recharge vip wrong: %+v err=%v", rg, err)
	}
	if _, err := GetRechargeGroupByName("free"); err == nil {
		t.Fatalf("free must NOT become a recharge group")
	}
	cg, err := GetConsumptionGroupByName("vip")
	if err != nil || cg.ConsumptionRatio != 2 || !cg.InAutoRotation {
		t.Fatalf("consumption vip wrong: %+v err=%v", cg, err)
	}
	if _, err := GetConsumptionGroupByName("free"); err != nil {
		t.Fatalf("free must become a consumption group: %v", err)
	}

	// Idempotent: second run inserts nothing new.
	if err := BackfillSplitGroups(); err != nil {
		t.Fatalf("re-run: %v", err)
	}
	all, _ := GetAllConsumptionGroups()
	if len(all) != 2 {
		t.Fatalf("expected 2 consumption groups after re-run, got %d", len(all))
	}
}

// A user pointing at a tier absent from every settings-derived group row must
// still get a recharge_groups row (spec §6), so it has neutral topup metadata.
func TestBackfillSplitGroups_CoversUserGroup(t *testing.T) {
	setupGroupTestDB(t)
	if err := (&Group{Name: "free", ConsumptionRatio: 1, Visibility: "public"}).Insert(); err != nil {
		t.Fatal(err)
	}
	// A user whose recharge tier "legacy_tier" exists in no group row.
	if err := DB.Create(&User{Username: "u1", Group: "legacy_tier"}).Error; err != nil {
		t.Fatal(err)
	}

	if err := BackfillSplitGroups(); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	if _, err := GetRechargeGroupByName("legacy_tier"); err != nil {
		t.Fatalf("user tier legacy_tier must become a recharge group: %v", err)
	}
}
