package setting

import (
	"strings"
	"testing"
)

func TestSensitiveWordsFromStringJSON(t *testing.T) {
	SensitiveWordsFromString(`[{"name":"暴恐词库","enabled":true,"words":[" 词1 ","","词2"]},{"name":"政治类型","enabled":false,"words":["词3"]}]`)
	groups := GetSensitiveWordGroups()
	if len(groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(groups))
	}
	g := groups[0]
	if g.Name != "暴恐词库" || !g.Enabled {
		t.Fatalf("unexpected group[0]: %+v", g)
	}
	// 词应 trim 且去掉空串
	if len(g.Words) != 2 || g.Words[0] != "词1" || g.Words[1] != "词2" {
		t.Fatalf("words not normalized: %+v", g.Words)
	}
	if groups[1].Enabled {
		t.Fatal("group[1] should be disabled")
	}
}

func TestSensitiveWordsFromStringLegacy(t *testing.T) {
	SensitiveWordsFromString("word1\n  word2  \n\nword3")
	groups := GetSensitiveWordGroups()
	if len(groups) != 1 {
		t.Fatalf("expected 1 legacy group, got %d", len(groups))
	}
	g := groups[0]
	if g.Name != "默认分组" || !g.Enabled {
		t.Fatalf("unexpected legacy group: %+v", g)
	}
	if len(g.Words) != 3 || g.Words[1] != "word2" {
		t.Fatalf("unexpected legacy words: %+v", g.Words)
	}
}

func TestSensitiveWordsFromStringEmpty(t *testing.T) {
	SensitiveWordsFromString("   \n  ")
	if groups := GetSensitiveWordGroups(); len(groups) != 0 {
		t.Fatalf("expected 0 groups, got %+v", groups)
	}
}

func TestSensitiveWordsFromStringInvalidJSONFallsBackToLegacy(t *testing.T) {
	// 以 [ 开头但不是合法分组 JSON → 当作 legacy 单组(整行作为一个词)
	SensitiveWordsFromString("[not json\nword2")
	groups := GetSensitiveWordGroups()
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if len(groups[0].Words) != 2 {
		t.Fatalf("unexpected words: %+v", groups[0].Words)
	}
}

func TestSensitiveWordsToStringRoundTrip(t *testing.T) {
	in := `[{"name":"A","enabled":true,"words":["x"]},{"name":"B","enabled":false,"words":[]}]`
	SensitiveWordsFromString(in)
	out := SensitiveWordsToString()
	if !strings.HasPrefix(strings.TrimSpace(out), "[") {
		t.Fatalf("ToString should emit JSON, got: %s", out)
	}
	SensitiveWordsFromString(out)
	groups := GetSensitiveWordGroups()
	if len(groups) != 2 || groups[0].Name != "A" || groups[1].Enabled {
		t.Fatalf("round trip mismatch: %+v", groups)
	}
}

func TestSensitiveWordsVersionIncrements(t *testing.T) {
	v0 := SensitiveWordsVersion()
	SensitiveWordsFromString("a")
	if SensitiveWordsVersion() != v0+1 {
		t.Fatalf("version should increment: %d -> %d", v0, SensitiveWordsVersion())
	}
}

func TestSensitiveWordsToStringEmptyRoundTrip(t *testing.T) {
	SensitiveWordsFromString("")
	out := SensitiveWordsToString()
	if strings.TrimSpace(out) != "[]" {
		t.Fatalf("empty groups should serialize to [], got %q", out)
	}
	SensitiveWordsFromString(out)
	if groups := GetSensitiveWordGroups(); len(groups) != 0 {
		t.Fatalf("round trip of empty should stay empty, got %+v", groups)
	}
}
