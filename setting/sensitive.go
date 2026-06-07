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

// sensitiveWordGroupsValue 持有 []SensitiveWordGroup,原子发布;
// 取出的 slice 视为只读,不得原地修改
var sensitiveWordGroupsValue atomic.Value

func init() {
	sensitiveWordGroupsValue.Store([]SensitiveWordGroup{
		{Name: LegacySensitiveGroupName, Enabled: true, Words: []string{"test_sensitive"}},
	})
}

// GetSensitiveWordGroups 返回当前敏感词分组(只读快照,调用方不得修改)
func GetSensitiveWordGroups() []SensitiveWordGroup {
	return sensitiveWordGroupsValue.Load().([]SensitiveWordGroup)
}

func setSensitiveWordGroups(groups []SensitiveWordGroup) {
	// 先 Store 词库再自增版本号:atomic.Value 的 Store 为词库及其 Words
	// 内容提供 happens-before 边(所有写入在 Store 前完成)。
	// 注意:读者可能先看到旧版本号 + 新词库 → 用新数据构建带旧版本号的快照,
	// 下一次请求会再重建一次;此种情况无害。
	sensitiveWordGroupsValue.Store(groups)
	sensitiveWordsVersion.Add(1)
}

// sensitiveWordsVersion 词库版本号，每次更新自增；service 层用其判断快照是否过期
var sensitiveWordsVersion atomic.Int64

func SensitiveWordsVersion() int64 {
	return sensitiveWordsVersion.Load()
}

func SensitiveWordsToString() string {
	data, err := common.Marshal(GetSensitiveWordGroups())
	if err != nil {
		return "[]"
	}
	return string(data)
}

func SensitiveWordsFromString(s string) {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		setSensitiveWordGroups([]SensitiveWordGroup{})
		return
	}

	if strings.HasPrefix(trimmed, "[") {
		var groups []SensitiveWordGroup
		if err := common.UnmarshalJsonStr(trimmed, &groups); err == nil {
			for i := range groups {
				groups[i].Words = normalizeSensitiveWords(groups[i].Words)
			}
			setSensitiveWordGroups(groups)
			return
		}
	}

	// legacy 换行格式 → 单个默认分组
	setSensitiveWordGroups([]SensitiveWordGroup{{
		Name:    LegacySensitiveGroupName,
		Enabled: true,
		Words:   normalizeSensitiveWords(strings.Split(s, "\n")),
	}})
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
