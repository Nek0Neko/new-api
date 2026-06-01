package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestValidateUserGroupAssignment(t *testing.T) {
	// Snapshot & restore the three global settings maps this test mutates so it
	// can't leak state into sibling controller tests.
	origRecharge := setting.RechargeGroupMeta2JSONString()
	origRatio := ratio_setting.GroupRatio2JSONString()
	origUsable := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		_ = setting.UpdateRechargeGroupMetaByJSONString(origRecharge)
		_ = ratio_setting.UpdateGroupRatioByJSONString(origRatio)
		_ = setting.UpdateUserUsableGroupsByJSONString(origUsable)
	})

	if err := setting.UpdateRechargeGroupMetaByJSONString(`{"default":{}}`); err != nil {
		t.Fatal(err)
	}
	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"free":1,"premium":2}`); err != nil {
		t.Fatal(err)
	}
	if err := setting.UpdateUserUsableGroupsByJSONString(`{"free":{"visibility":"public"},"premium":{"admin_only":true}}`); err != nil {
		t.Fatal(err)
	}

	if msg := validateUserGroupAssignment("nope", []string{"free"}, true); msg == "" {
		t.Fatal("expected unknown recharge group to fail")
	}
	if msg := validateUserGroupAssignment("default", []string{"ghost"}, true); msg == "" {
		t.Fatal("expected unknown consumption group to fail")
	}
	if msg := validateUserGroupAssignment("default", []string{"premium"}, false); msg == "" {
		t.Fatal("expected admin-only group to fail for non-admin")
	}
	if msg := validateUserGroupAssignment("default", []string{"premium"}, true); msg != "" {
		t.Fatalf("admin should assign admin-only: %s", msg)
	}
	if msg := validateUserGroupAssignment("default", nil, false); msg != "" {
		t.Fatalf("empty list should pass: %s", msg)
	}
}
