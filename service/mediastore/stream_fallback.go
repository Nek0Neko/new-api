package mediastore

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ImageStreamEventType returns the "type" field of an SSE image event payload,
// or "" when it cannot be determined (blank, [DONE], non-JSON, or no type).
func ImageStreamEventType(data string) string {
	trimmed := strings.TrimSpace(data)
	if trimmed == "" || trimmed == "[DONE]" {
		return ""
	}
	var payload struct {
		Type string `json:"type"`
	}
	if err := common.UnmarshalJsonStr(trimmed, &payload); err != nil {
		return ""
	}
	return payload.Type
}

// SynthesizeCompletedImageEvent builds a terminal "completed" image event from a
// "partial_image" event. Some upstreams stream only partial frames and end with
// [DONE] without ever emitting a completed event, which leaves clients that
// require a terminal completed frame waiting forever. Promoting the last partial
// gives them the final image.
//
// The type suffix partial_image is rewritten to completed (preserving the
// namespace, e.g. image_generation / image_edit), partial_image_index is
// dropped, and the image payload (b64_json / url) plus revised_prompt are kept.
// Returns ("", false) when data is not a partial frame carrying an image.
func SynthesizeCompletedImageEvent(data string) (string, bool) {
	trimmed := strings.TrimSpace(data)
	if trimmed == "" || trimmed == "[DONE]" {
		return "", false
	}
	var m map[string]json.RawMessage
	if err := common.UnmarshalJsonStr(trimmed, &m); err != nil {
		return "", false
	}
	var typ string
	if raw, ok := m["type"]; ok {
		_ = common.Unmarshal(raw, &typ)
	}
	if !strings.HasSuffix(typ, "partial_image") {
		return "", false
	}
	if !hasNonEmptyString(m, "b64_json") && !hasNonEmptyString(m, "url") {
		return "", false
	}

	completedType := strings.TrimSuffix(typ, "partial_image") + "completed"
	typeRaw, err := common.Marshal(completedType)
	if err != nil {
		return "", false
	}
	m["type"] = typeRaw
	delete(m, "partial_image_index")

	out, err := common.Marshal(m)
	if err != nil {
		return "", false
	}
	return string(out), true
}

func hasNonEmptyString(m map[string]json.RawMessage, key string) bool {
	raw, ok := m[key]
	if !ok {
		return false
	}
	var s string
	if err := common.Unmarshal(raw, &s); err != nil {
		return false
	}
	return s != ""
}
