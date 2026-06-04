package mediastore

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// head returns the first up-to-200 bytes of b as a string, for diagnostic logs.
func head(b []byte) string {
	if len(b) > 200 {
		return string(b[:200])
	}
	return string(b)
}

// RewriteImageResponseBody parses a non-streaming image response body, uploads
// every base64 image that has no url yet to object storage, and replaces the
// b64_json with the returned url. On any per-image failure it keeps the original
// base64 (generation must never fail because of storage). Returns the original
// body unchanged when nothing was rewritten.
func RewriteImageResponseBody(ctx context.Context, body []byte) []byte {
	var resp dto.ImageResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		common.SysLog(fmt.Sprintf("[cos-diag] RewriteImageResponseBody: unmarshal failed (%v), bodyLen=%d, head=%q", err, len(body), head(body)))
		return body
	}
	common.SysLog(fmt.Sprintf("[cos-diag] RewriteImageResponseBody: dataLen=%d", len(resp.Data)))
	changed := false
	for i := range resp.Data {
		d := &resp.Data[i]
		if d.B64Json == "" || d.Url != "" {
			common.SysLog(fmt.Sprintf("[cos-diag] image[%d] skipped: b64Len=%d urlPresent=%v", i, len(d.B64Json), d.Url != ""))
			continue
		}
		url, err := uploadBase64(ctx, d.B64Json)
		if err != nil {
			common.SysError("cos upload image failed: " + err.Error())
			continue
		}
		common.SysLog(fmt.Sprintf("[cos-diag] image[%d] uploaded -> %s", i, url))
		d.Url = url
		d.B64Json = ""
		changed = true
	}
	if !changed {
		return body
	}
	out, err := common.Marshal(resp)
	if err != nil {
		return body
	}
	return out
}

// RewriteImageStreamEvent rewrites a single SSE image event payload. Only the
// final "completed" event carrying a b64_json is rewritten: the image is
// uploaded and the event is rewritten to carry a url instead. All other events
// (partial frames, [DONE], non-JSON) pass through unchanged. Unknown fields
// (usage, revised_prompt, ...) are preserved.
func RewriteImageStreamEvent(ctx context.Context, data string) string {
	trimmed := strings.TrimSpace(data)
	if trimmed == "" || trimmed == "[DONE]" {
		return data
	}
	var m map[string]json.RawMessage
	if err := common.UnmarshalJsonStr(trimmed, &m); err != nil {
		return data
	}
	var typ string
	if raw, ok := m["type"]; ok {
		_ = common.Unmarshal(raw, &typ)
	}
	if !strings.HasSuffix(typ, "completed") {
		return data
	}
	var b64 string
	if raw, ok := m["b64_json"]; ok {
		_ = common.Unmarshal(raw, &b64)
	}
	_, hasURL := m["url"]
	common.SysLog(fmt.Sprintf("[cos-diag] stream completed event: type=%q b64Len=%d hasURL=%v", typ, len(b64), hasURL))
	if b64 == "" {
		return data
	}
	url, err := uploadBase64(ctx, b64)
	if err != nil {
		common.SysError("cos upload stream image failed: " + err.Error())
		return data
	}
	common.SysLog(fmt.Sprintf("[cos-diag] stream completed uploaded -> %s", url))
	urlRaw, err := common.Marshal(url)
	if err != nil {
		return data
	}
	m["url"] = urlRaw
	delete(m, "b64_json")
	out, err := common.Marshal(m)
	if err != nil {
		return data
	}
	return string(out)
}
