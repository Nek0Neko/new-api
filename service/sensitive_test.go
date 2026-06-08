package service

import (
	"fmt"
	"sync"
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

func TestSensitiveWordBoundaryASCIINoSubstringMatch(t *testing.T) {
	setGroups(t, `[{"name":"色情词库","enabled":true,"words":["anal"]}]`)
	// 纯 ASCII 词要求词边界:不得命中更大单词的子串(这正是 codex 全站 500 的根因)。
	for _, s := range []string{
		"please run static analysis on this",
		"let me analyze the data",
		"open the analytics dashboard",
		"walk along the canal",
	} {
		if c, hits := SensitiveWordContains(s); c {
			t.Fatalf("ASCII substring should not match for %q, got %+v", s, hits)
		}
	}
}

func TestSensitiveWordBoundaryASCIIWholeWordMatches(t *testing.T) {
	setGroups(t, `[{"name":"色情词库","enabled":true,"words":["anal"]}]`)
	for _, s := range []string{
		"anal",
		"this is anal sex",
		"anal.",
		"(anal)",
		"ANAL content",
	} {
		if c, _ := SensitiveWordContains(s); !c {
			t.Fatalf("whole-word should match for %q", s)
		}
	}
}

func TestSensitiveWordBoundaryDigitAdjacency(t *testing.T) {
	setGroups(t, `[{"name":"A","enabled":true,"words":["ass"]}]`)
	if c, hits := SensitiveWordContains("class assertion bass"); c {
		t.Fatalf("ass should not match inside class/assertion/bass, got %+v", hits)
	}
	if c, _ := SensitiveWordContains("dumb ass"); !c {
		t.Fatal("standalone ass should match")
	}
}

func TestSensitiveWordCJKStillSubstring(t *testing.T) {
	setGroups(t, `[{"name":"政治","enabled":true,"words":["敏感"]}]`)
	// CJK 无空格分隔,保持子串匹配:夹在其他汉字中仍应命中。
	if c, _ := SensitiveWordContains("这是敏感词测试"); !c {
		t.Fatal("CJK word should still match as substring")
	}
}

func TestSnapshotConcurrentReadDuringUpdate(t *testing.T) {
	setGroups(t, `[{"name":"A","enabled":true,"words":["word0"]}]`)
	stop := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
					SensitiveWordContains("some text with word3 inside")
				}
			}
		}()
	}
	for i := 0; i < 50; i++ {
		setGroups(t, fmt.Sprintf(`[{"name":"A","enabled":true,"words":["word%d"]}]`, i))
	}
	close(stop)
	wg.Wait()
	// 收敛性:最终词库为 word49,旧词不再命中
	if c, _ := SensitiveWordContains("has word49"); !c {
		t.Fatal("final word should match after updates settle")
	}
	if c, _ := SensitiveWordContains("has word0"); c {
		t.Fatal("stale word should not match after updates settle")
	}
}
