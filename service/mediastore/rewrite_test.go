package mediastore

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// onePxPNG is a 1x1 PNG so http.DetectContentType returns image/png.
var onePxPNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

type fakeUploader struct {
	url string
	err error
}

func (f *fakeUploader) Upload(_ context.Context, _ []byte, _ string) (string, error) {
	return f.url, f.err
}

func swapUploader(t *testing.T, u Uploader) {
	t.Helper()
	prev := uploader
	uploader = u
	t.Cleanup(func() { uploader = prev })
}

func TestRewriteImageResponseBody_ReplacesB64WithURL(t *testing.T) {
	swapUploader(t, &fakeUploader{url: "https://cdn.test/x.png"})
	resp := dto.ImageResponse{Data: []dto.ImageData{{B64Json: onePxPNG}}}
	body, _ := common.Marshal(resp)

	out := RewriteImageResponseBody(context.Background(), body)

	var got dto.ImageResponse
	if err := common.Unmarshal(out, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Data[0].Url != "https://cdn.test/x.png" {
		t.Fatalf("url = %q, want cdn url", got.Data[0].Url)
	}
	if got.Data[0].B64Json != "" {
		t.Fatalf("b64_json should be cleared, got %d bytes", len(got.Data[0].B64Json))
	}
}

func TestRewriteImageResponseBody_KeepsB64OnUploadFailure(t *testing.T) {
	swapUploader(t, &fakeUploader{err: errors.New("cos down")})
	resp := dto.ImageResponse{Data: []dto.ImageData{{B64Json: onePxPNG}}}
	body, _ := common.Marshal(resp)

	out := RewriteImageResponseBody(context.Background(), body)

	var got dto.ImageResponse
	_ = common.Unmarshal(out, &got)
	if got.Data[0].B64Json == "" || got.Data[0].Url != "" {
		t.Fatalf("on failure must keep b64 and no url, got url=%q b64len=%d", got.Data[0].Url, len(got.Data[0].B64Json))
	}
}

func TestRewriteImageResponseBody_SkipsWhenUrlAlreadyPresent(t *testing.T) {
	swapUploader(t, &fakeUploader{url: "https://should.not/be/used.png"})
	resp := dto.ImageResponse{Data: []dto.ImageData{{Url: "https://upstream/u.png"}}}
	body, _ := common.Marshal(resp)

	out := RewriteImageResponseBody(context.Background(), body)
	if !strings.Contains(string(out), "https://upstream/u.png") {
		t.Fatalf("existing url must be preserved")
	}
	if strings.Contains(string(out), "should.not") {
		t.Fatalf("uploader must not run when url already present")
	}
}

func TestRewriteImageStreamEvent_RewritesCompletedEvent(t *testing.T) {
	swapUploader(t, &fakeUploader{url: "https://cdn.test/final.png"})
	in := `{"type":"image_generation.completed","b64_json":"` + onePxPNG + `","usage":{"input_tokens":1}}`

	out := RewriteImageStreamEvent(context.Background(), in)

	var m map[string]any
	if err := common.UnmarshalJsonStr(out, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if m["url"] != "https://cdn.test/final.png" {
		t.Fatalf("url = %v, want cdn url", m["url"])
	}
	if _, ok := m["b64_json"]; ok {
		t.Fatalf("b64_json must be removed from completed event")
	}
	if _, ok := m["usage"]; !ok {
		t.Fatalf("usage must be preserved")
	}
}

func TestRewriteImageStreamEvent_IgnoresPartialEvent(t *testing.T) {
	swapUploader(t, &fakeUploader{url: "https://cdn.test/should-not.png"})
	in := `{"type":"image_generation.partial_image","b64_json":"AAA","partial_image_index":0}`

	out := RewriteImageStreamEvent(context.Background(), in)
	if out != in {
		t.Fatalf("partial event must pass through unchanged")
	}
}

func TestRewriteImageStreamEvent_IgnoresDone(t *testing.T) {
	if got := RewriteImageStreamEvent(context.Background(), "[DONE]"); got != "[DONE]" {
		t.Fatalf("[DONE] must pass through")
	}
}

// guard so the test file's base64 import is always used even if onePxPNG is inlined.
var _ = base64.StdEncoding
