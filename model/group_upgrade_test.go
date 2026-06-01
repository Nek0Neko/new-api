package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
)

func TestPickUpgradeGroup_UsesRechargeMeta(t *testing.T) {
	if err := setting.UpdateRechargeGroupMetaByJSONString(
		`{"default":{},"vip":{"auto_upgrade":true,"upgrade_threshold":15000},"svip":{"auto_upgrade":true,"upgrade_threshold":50000},"enterprise":{"admin_only":true,"auto_upgrade":true,"upgrade_threshold":1}}`,
	); err != nil {
		t.Fatal(err)
	}
	// Drain the consumption-side meta so that, if pickUpgradeGroup still read it,
	// every assertion below would return "" — proving the repoint to RechargeGroupMeta.
	if err := setting.UpdateUserUsableGroupsByJSONString(`{}`); err != nil {
		t.Fatal(err)
	}
	// From default (threshold 0), 20000 cents -> eligible for vip (15000), not svip (50000).
	if got := pickUpgradeGroup("default", 0, 20000); got != "vip" {
		t.Fatalf("expected vip, got %q", got)
	}
	// 60000 -> svip (highest threshold <= total, > current).
	if got := pickUpgradeGroup("default", 0, 60000); got != "svip" {
		t.Fatalf("expected svip, got %q", got)
	}
	// admin_only enterprise must never be auto-picked even though threshold met.
	if got := pickUpgradeGroup("default", 0, 100000); got == "enterprise" {
		t.Fatalf("admin-only enterprise must not be auto-picked; got %q", got)
	}
	// No downgrade: already above all thresholds-> "".
	if got := pickUpgradeGroup("svip", 50000, 60000); got != "" {
		t.Fatalf("expected no upgrade target, got %q", got)
	}
}
