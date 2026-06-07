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
	for _, group := range setting.SensitiveWordGroups {
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
	checkText := strings.ToLower(text)
	matched := snap.machine.MultiPatternSearch([]rune(checkText), true)
	if len(matched) == 0 {
		return false, nil
	}
	hits := make([]SensitiveWordHit, 0, len(matched))
	for _, hit := range matched {
		word := string(hit.Word)
		hits = append(hits, SensitiveWordHit{GroupName: snap.wordGroup[word], Word: word})
	}
	return true, hits
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
	checkText := strings.ToLower(text)
	hits := snap.machine.MultiPatternSearch([]rune(checkText), returnImmediately)
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
