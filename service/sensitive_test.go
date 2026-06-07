package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
)

func setGroups(t *testing.T, jsonStr string) {
	t.Helper()
	setting.SensitiveWordsFromString(jsonStr)
}

func TestSensitiveWordContainsHitWithGroupName(t *testing.T) {
	setGroups(t, `[{"name":"政治类型","enabled":true,"words":["badword"]}]`)
	contains, hits := SensitiveWordContains("this has BadWord inside")
	if !contains {
		t.Fatal("expected hit")
	}
	if len(hits) != 1 || hits[0].Word != "badword" || hits[0].GroupName != "政治类型" {
		t.Fatalf("unexpected hits: %+v", hits)
	}
}

func TestSensitiveWordContainsDisabledGroupNoHit(t *testing.T) {
	setGroups(t, `[{"name":"政治类型","enabled":false,"words":["badword"]}]`)
	contains, _ := SensitiveWordContains("this has badword inside")
	if contains {
		t.Fatal("disabled group should not match")
	}
}

func TestSensitiveWordContainsEmptyDict(t *testing.T) {
	setGroups(t, ``)
	contains, hits := SensitiveWordContains("anything")
	if contains || hits != nil {
		t.Fatalf("empty dict should not match: %v %+v", contains, hits)
	}
}

func TestSensitiveWordContainsDuplicateWordFirstEnabledGroupWins(t *testing.T) {
	setGroups(t, `[{"name":"A","enabled":true,"words":["dup"]},{"name":"B","enabled":true,"words":["dup"]}]`)
	contains, hits := SensitiveWordContains("xx dup yy")
	if !contains || hits[0].GroupName != "A" {
		t.Fatalf("expected group A, got %+v", hits)
	}
}

func TestSnapshotRebuildsOnUpdate(t *testing.T) {
	setGroups(t, `[{"name":"A","enabled":true,"words":["oldword"]}]`)
	if c, _ := SensitiveWordContains("has oldword"); !c {
		t.Fatal("expected oldword hit")
	}
	// 更新词库:删 oldword 加 newword,应立即生效
	setGroups(t, `[{"name":"A","enabled":true,"words":["newword"]}]`)
	if c, _ := SensitiveWordContains("has oldword"); c {
		t.Fatal("oldword should be stale after update")
	}
	if c, _ := SensitiveWordContains("has newword"); !c {
		t.Fatal("newword should match after update")
	}
}

func TestCheckSensitiveMessagesAdapted(t *testing.T) {
	setGroups(t, `[{"name":"A","enabled":true,"words":["secret"]}]`)
	hits, err := CheckSensitiveMessages(nil)
	if hits != nil || err != nil {
		t.Fatalf("nil messages should pass: %+v %v", hits, err)
	}
}

func TestFormatSensitiveHits(t *testing.T) {
	s := FormatSensitiveHits([]SensitiveWordHit{
		{GroupName: "政治类型", Word: "xxx"},
		{GroupName: "", Word: "yyy"},
	})
	if s != "[政治类型]xxx, yyy" {
		t.Fatalf("unexpected format: %s", s)
	}
}
