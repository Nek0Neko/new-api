package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting"
	goahocorasick "github.com/anknown/ahocorasick"
)

// SensitiveWordHit 命中的敏感词及其所属分组
type SensitiveWordHit struct {
	GroupName string
	Word      string
}

// sensitiveSnapshot 由启用分组构建的不可变匹配快照
// 通过 setting.SensitiveWordsVersion() 判断是否过期,过期时加锁重建
type sensitiveSnapshot struct {
	version   int64
	machine   *goahocorasick.Machine
	wordGroup map[string]string // 词(小写) → 组名;重复词归属首个启用组
}

var (
	sensitiveSnapshotValue atomic.Value // *sensitiveSnapshot
	sensitiveSnapshotMu    sync.Mutex
)

func getSensitiveSnapshot() *sensitiveSnapshot {
	version := setting.SensitiveWordsVersion()
	if v, ok := sensitiveSnapshotValue.Load().(*sensitiveSnapshot); ok && v.version == version {
		return v
	}
	sensitiveSnapshotMu.Lock()
	defer sensitiveSnapshotMu.Unlock()
	if v, ok := sensitiveSnapshotValue.Load().(*sensitiveSnapshot); ok && v.version == version {
		return v
	}
	snap := buildSensitiveSnapshot(version)
	sensitiveSnapshotValue.Store(snap)
	return snap
}

func buildSensitiveSnapshot(version int64) *sensitiveSnapshot {
	wordGroup := make(map[string]string)
	dict := make([]string, 0)
	for _, group := range setting.GetSensitiveWordGroups() {
		if !group.Enabled {
			continue
		}
		for _, w := range group.Words {
			lw := strings.ToLower(strings.TrimSpace(w))
			if lw == "" {
				continue
			}
			if _, exists := wordGroup[lw]; exists {
				continue
			}
			wordGroup[lw] = group.Name
			dict = append(dict, lw)
		}
	}
	snap := &sensitiveSnapshot{version: version, wordGroup: wordGroup}
	if len(dict) > 0 {
		snap.machine = InitAc(dict)
	}
	return snap
}

func CheckSensitiveMessages(messages []dto.Message) ([]SensitiveWordHit, error) {
	if len(messages) == 0 {
		return nil, nil
	}

	for _, message := range messages {
		arrayContent := message.ParseContent()
		for _, m := range arrayContent {
			if m.Type == "image_url" {
				// TODO: check image url
				continue
			}
			// 检查 text 是否为空
			if m.Text == "" {
				continue
			}
			if ok, hits := SensitiveWordContains(m.Text); ok {
				return hits, errors.New("sensitive words detected")
			}
		}
	}
	return nil, nil
}

func CheckSensitiveText(text string) (bool, []SensitiveWordHit) {
	return SensitiveWordContains(text)
}

// SensitiveWordContains 是否包含敏感词，返回是否包含及命中详情(含组名)
func SensitiveWordContains(text string) (bool, []SensitiveWordHit) {
	if len(text) == 0 {
		return false, nil
	}
	snap := getSensitiveSnapshot()
	if snap.machine == nil {
		return false, nil
	}
	runes := []rune(strings.ToLower(text))
	// returnImmediately=false:需拿到全部原始命中后再做词边界过滤,
	// 否则第一个命中若是无效子串(如 "analysis" 里的 "anal")会提前返回并漏掉后续有效命中。
	matched := snap.machine.MultiPatternSearch(runes, false)
	if len(matched) == 0 {
		return false, nil
	}
	hits := make([]SensitiveWordHit, 0, len(matched))
	for _, hit := range matched {
		if !isBoundaryValidHit(runes, hit) {
			continue
		}
		word := string(hit.Word)
		hits = append(hits, SensitiveWordHit{GroupName: snap.wordGroup[word], Word: word})
	}
	if len(hits) == 0 {
		return false, nil
	}
	return true, hits
}

// isASCIIWordRune 报告 r 是否为构成英文单词的 ASCII 字符(字母或数字)。
func isASCIIWordRune(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
}

// isASCIIWord 报告 s 是否完全由 ASCII 字母/数字组成。
func isASCIIWord(s []rune) bool {
	if len(s) == 0 {
		return false
	}
	for _, r := range s {
		if !isASCIIWordRune(r) {
			return false
		}
	}
	return true
}

// isBoundaryValidHit 对纯 ASCII 词施加词边界约束:命中片段紧邻的前/后字符若仍是
// ASCII 词字符,说明它只是更大单词的一部分(如 "anal" ∈ "analysis"),判为无效命中。
// 含 CJK 等非 ASCII 字符的词没有空格分隔概念,保持原子串匹配语义,始终有效。
func isBoundaryValidHit(runes []rune, hit *goahocorasick.Term) bool {
	if !isASCIIWord(hit.Word) {
		return true
	}
	start := hit.Pos
	end := hit.Pos + len(hit.Word)
	if start > 0 && isASCIIWordRune(runes[start-1]) {
		return false
	}
	if end < len(runes) && isASCIIWordRune(runes[end]) {
		return false
	}
	return true
}

// FormatSensitiveHits 格式化命中详情用于日志: [组名]词, [组名]词
func FormatSensitiveHits(hits []SensitiveWordHit) string {
	parts := make([]string, 0, len(hits))
	for _, h := range hits {
		if h.GroupName != "" {
			parts = append(parts, fmt.Sprintf("[%s]%s", h.GroupName, h.Word))
		} else {
			parts = append(parts, h.Word)
		}
	}
	return strings.Join(parts, ", ")
}

// SensitiveWordReplace 敏感词替换，返回是否包含敏感词和替换后的文本
func SensitiveWordReplace(text string, returnImmediately bool) (bool, []string, string) {
	snap := getSensitiveSnapshot()
	if snap.machine == nil {
		return false, nil, text
	}
	runes := []rune(strings.ToLower(text))
	// 始终全量搜索,过滤掉未通过词边界约束的 ASCII 子串命中(如 "anal" ∈ "analysis"),
	// 再按 returnImmediately 决定是否只保留首个有效命中。
	rawHits := snap.machine.MultiPatternSearch(runes, false)
	hits := make([]*goahocorasick.Term, 0, len(rawHits))
	for _, hit := range rawHits {
		if !isBoundaryValidHit(runes, hit) {
			continue
		}
		hits = append(hits, hit)
		if returnImmediately {
			break
		}
	}
	if len(hits) > 0 {
		words := make([]string, 0, len(hits))
		var builder strings.Builder
		builder.Grow(len(text))
		lastPos := 0

		for _, hit := range hits {
			pos := hit.Pos
			word := string(hit.Word)
			builder.WriteString(text[lastPos:pos])
			builder.WriteString("**###**")
			lastPos = pos + len(word)
			words = append(words, word)
		}
		builder.WriteString(text[lastPos:])
		return true, words, builder.String()
	}
	return false, nil, text
}
