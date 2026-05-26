package service

import (
	"reflect"
	"sort"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// seedGroupRatio replaces the live GroupRatio map for the duration of a test
// and restores it on cleanup. Tests run sequentially within a package by
// default but we still snapshot to avoid bleeding state across siblings.
func seedGroupRatio(t *testing.T, ratios map[string]float64) {
	t.Helper()
	snapshot := ratio_setting.GroupRatio2JSONString()
	jsonBytes, _ := jsonMarshal(ratios)
	if err := ratio_setting.UpdateGroupRatioByJSONString(string(jsonBytes)); err != nil {
		t.Fatalf("seed: %v", err)
	}
	t.Cleanup(func() {
		_ = ratio_setting.UpdateGroupRatioByJSONString(snapshot)
	})
}

func jsonMarshal(m map[string]float64) ([]byte, error) {
	// Inline trivial encoder to dodge the project's mandatory common.Marshal
	// helper (which lives in a package that drags Redis init at import time).
	out := []byte{'{'}
	first := true
	for k, v := range m {
		if !first {
			out = append(out, ',')
		}
		first = false
		out = append(out, '"')
		out = append(out, k...)
		out = append(out, '"', ':')
		// rough float formatting; tests use integer-valued ratios
		out = append(out, []byte(formatFloat(v))...)
	}
	out = append(out, '}')
	return out, nil
}

func formatFloat(v float64) string {
	// Simple integer-or-decimal printer good enough for test fixtures.
	if v == float64(int64(v)) {
		return itoa(int64(v))
	}
	return "1"
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func TestGetUserUsableGroupsForUser_EmptyAllowlistFallsBack(t *testing.T) {
	seedGroupRatio(t, map[string]float64{
		"default": 1,
		"premium": 2,
	})

	user := &model.User{Group: "default"}
	got := GetUserUsableGroupsForUser(user)

	// Empty allowlist → tier-based resolver returns every GroupRatio entry.
	want := []string{"default", "premium"}
	if !reflect.DeepEqual(sortedKeys(got), want) {
		t.Fatalf("expected fallback to surface all GroupRatio entries %v, got %v", want, sortedKeys(got))
	}
}

func TestGetUserUsableGroupsForUser_ExplicitAllowlistOverrides(t *testing.T) {
	seedGroupRatio(t, map[string]float64{
		"default": 1,
		"premium": 2,
		"vip":     3,
	})

	user := &model.User{Group: "default"}
	user.SetConsumptionGroupsList([]string{"premium"})
	got := GetUserUsableGroupsForUser(user)

	want := []string{"premium"}
	if !reflect.DeepEqual(sortedKeys(got), want) {
		t.Fatalf("explicit allowlist should narrow output. want %v, got %v", want, sortedKeys(got))
	}
}

func TestGetUserUsableGroupsForUser_DeprecatedGroupsDropped(t *testing.T) {
	seedGroupRatio(t, map[string]float64{
		"default": 1,
		"premium": 2,
		// "vip" was removed from GroupRatio after the admin saved the user.
	})

	user := &model.User{Group: "default"}
	user.SetConsumptionGroupsList([]string{"premium", "vip"})
	got := GetUserUsableGroupsForUser(user)

	want := []string{"premium"}
	if !reflect.DeepEqual(sortedKeys(got), want) {
		t.Fatalf("deprecated groups must be filtered out. want %v, got %v", want, sortedKeys(got))
	}
}

func TestGetUserUsableGroupsForUser_AllowlistDedupsAndTrims(t *testing.T) {
	seedGroupRatio(t, map[string]float64{
		"default": 1,
		"premium": 2,
	})

	user := &model.User{Group: "default"}
	user.SetConsumptionGroupsList([]string{" premium ", "premium", "", "default"})
	got := GetUserUsableGroupsForUser(user)

	want := []string{"default", "premium"}
	if !reflect.DeepEqual(sortedKeys(got), want) {
		t.Fatalf("allowlist sanitization broken. want %v, got %v", want, sortedKeys(got))
	}
}

func TestGetUserUsableGroupsForUser_NilUserReturnsEmpty(t *testing.T) {
	got := GetUserUsableGroupsForUser(nil)
	if len(got) != 0 {
		t.Fatalf("nil user must return empty map, got %v", got)
	}
}

func TestGroupInUserUsableGroupsForUserCache(t *testing.T) {
	seedGroupRatio(t, map[string]float64{
		"default": 1,
		"premium": 2,
	})

	cache := &model.UserBase{Group: "default"}
	// No allowlist → falls back to tier-based map (which includes default+premium).
	if !GroupInUserUsableGroupsForUserCache(cache, "premium") {
		t.Fatal("cache fallback should permit premium when no allowlist is set")
	}

	// With explicit allowlist restricting to "default" only.
	tmp := &model.User{}
	tmp.SetConsumptionGroupsList([]string{"default"})
	cache.ConsumptionGroups = tmp.ConsumptionGroups
	if GroupInUserUsableGroupsForUserCache(cache, "premium") {
		t.Fatal("explicit allowlist excluding premium should deny it")
	}
	if !GroupInUserUsableGroupsForUserCache(cache, "default") {
		t.Fatal("explicit allowlist including default should still permit it")
	}
}
