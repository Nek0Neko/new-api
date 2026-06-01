package setting

import "testing"

func TestRechargeGroupMetaRoundTrip(t *testing.T) {
	in := `{"vip":{"auto_upgrade":true,"upgrade_threshold":15000},"enterprise":{"admin_only":true}}`
	if err := UpdateRechargeGroupMetaByJSONString(in); err != nil {
		t.Fatalf("update: %v", err)
	}
	m, ok := GetRechargeGroupMeta("vip")
	if !ok || !m.AutoUpgrade || m.UpgradeThreshold != 15000 {
		t.Fatalf("vip meta wrong: %+v ok=%v", m, ok)
	}
	ent, ok := GetRechargeGroupMeta("enterprise")
	if !ok || !ent.AdminOnly {
		t.Fatalf("enterprise meta wrong: %+v", ent)
	}
	if _, ok := GetRechargeGroupMeta("missing"); ok {
		t.Fatalf("missing should be absent")
	}
}
