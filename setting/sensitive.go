package setting

import (
	"strings"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
)

var CheckSensitiveEnabled = true
var CheckSensitiveOnPromptEnabled = true

//var CheckSensitiveOnCompletionEnabled = true

// StopOnSensitiveEnabled 如果检测到敏感词，是否立刻停止生成，否则替换敏感词
var StopOnSensitiveEnabled = true

// StreamCacheQueueLength 流模式缓存队列长度，0表示无缓存
var StreamCacheQueueLength = 0

// LegacySensitiveGroupName 旧版换行格式词库迁移后的默认组名(前端 legacy 解析需保持一致)
const LegacySensitiveGroupName = "默认分组"

// SensitiveWordGroup 敏感词分组
type SensitiveWordGroup struct {
	Name    string   `json:"name"`
	Enabled bool     `json:"enabled"`
	Words   []string `json:"words"`
}

// SensitiveWordGroups 敏感词分组词库
var SensitiveWordGroups = []SensitiveWordGroup{
	{Name: LegacySensitiveGroupName, Enabled: true, Words: []string{"test_sensitive"}},
}

// sensitiveWordsVersion 词库版本号，每次更新自增；service 层用其判断快照是否过期
var sensitiveWordsVersion atomic.Int64

func SensitiveWordsVersion() int64 {
	return sensitiveWordsVersion.Load()
}

func SensitiveWordsToString() string {
	data, err := common.Marshal(SensitiveWordGroups)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func SensitiveWordsFromString(s string) {
	// 先更新词库再自增版本号，保证读到新版本号时词库已就绪
	defer sensitiveWordsVersion.Add(1)

	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		SensitiveWordGroups = []SensitiveWordGroup{}
		return
	}

	if strings.HasPrefix(trimmed, "[") {
		var groups []SensitiveWordGroup
		if err := common.UnmarshalJsonStr(trimmed, &groups); err == nil {
			for i := range groups {
				groups[i].Words = normalizeSensitiveWords(groups[i].Words)
			}
			SensitiveWordGroups = groups
			return
		}
	}

	// legacy 换行格式 → 单个默认分组
	SensitiveWordGroups = []SensitiveWordGroup{{
		Name:    LegacySensitiveGroupName,
		Enabled: true,
		Words:   normalizeSensitiveWords(strings.Split(s, "\n")),
	}}
}

func normalizeSensitiveWords(words []string) []string {
	result := make([]string, 0, len(words))
	for _, w := range words {
		w = strings.TrimSpace(w)
		if w != "" {
			result = append(result, w)
		}
	}
	return result
}

func ShouldCheckPromptSensitive() bool {
	return CheckSensitiveEnabled && CheckSensitiveOnPromptEnabled
}

//func ShouldCheckCompletionSensitive() bool {
//	return CheckSensitiveEnabled && CheckSensitiveOnCompletionEnabled
//}
