package mediastore

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/object_storage_setting"
)

// enableCOS flips the live COS config on for the duration of a test (restored via
// Cleanup), so IsCOSEnabled passes and OwnsURL recognizes customDomain.
func enableCOS(t *testing.T, customDomain string) {
	t.Helper()
	cfg := object_storage_setting.GetCOSConfig()
	prev := *cfg
	cfg.Enabled = true
	cfg.SecretID = "id"
	cfg.SecretKey = "key"
	cfg.Bucket = "bucket-1250000000"
	cfg.Region = "ap-guangzhou"
	cfg.CustomDomain = customDomain
	t.Cleanup(func() { *cfg = prev })
}

func TestEnsureCOSURL_UploadsB64(t *testing.T) {
	enableCOS(t, "https://cdn.test")
	swapUploader(t, &fakeUploader{url: "https://cdn.test/x.png"})

	url, changed, err := EnsureCOSURL(context.Background(), onePxPNG, "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !changed || url != "https://cdn.test/x.png" {
		t.Fatalf("got url=%q changed=%v, want cdn url + changed", url, changed)
	}
}

func TestEnsureCOSURL_SkipsOwnURL(t *testing.T) {
	enableCOS(t, "https://cdn.test")
	swapUploader(t, &fakeUploader{url: "https://should-not-be-called"})

	url, changed, err := EnsureCOSURL(context.Background(), "", "https://cdn.test/existing.png")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if changed || url != "https://cdn.test/existing.png" {
		t.Fatalf("own url must be untouched, got url=%q changed=%v", url, changed)
	}
}

func TestEnsureCOSURL_DisabledIsNoop(t *testing.T) {
	// COS left disabled: the fallback must do nothing and report no change.
	url, changed, err := EnsureCOSURL(context.Background(), onePxPNG, "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if changed || url != "" {
		t.Fatalf("disabled COS should noop, got url=%q changed=%v", url, changed)
	}
}

func TestEnsureCOSURL_RehostsRemoteURL(t *testing.T) {
	enableCOS(t, "https://cdn.test")
	swapUploader(t, &fakeUploader{url: "https://cdn.test/rehosted.png"})

	// Stand in for an expiring upstream (dall-e) image url.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		raw, _ := base64.StdEncoding.DecodeString(onePxPNG)
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(raw)
	}))
	defer srv.Close()

	url, changed, err := EnsureCOSURL(context.Background(), "", srv.URL+"/upstream.png")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !changed || url != "https://cdn.test/rehosted.png" {
		t.Fatalf("remote url should be re-hosted, got url=%q changed=%v", url, changed)
	}
}

func TestOffloadImageResponseBody_UploadsB64(t *testing.T) {
	enableCOS(t, "https://cdn.test")
	swapUploader(t, &fakeUploader{url: "https://cdn.test/x.png"})

	body := []byte(`{"created":1,"data":[{"b64_json":"` + onePxPNG + `"}]}`)
	out, changed := OffloadImageResponseBody(context.Background(), body)
	if !changed {
		t.Fatalf("expected body to change")
	}
	if !strings.Contains(string(out), "https://cdn.test/x.png") || strings.Contains(string(out), onePxPNG) {
		t.Fatalf("b64 should be replaced by url, got: %s", out)
	}
}

func TestOffloadImageResponseBody_DisabledUnchanged(t *testing.T) {
	body := []byte(`{"created":1,"data":[{"b64_json":"` + onePxPNG + `"}]}`)
	out, changed := OffloadImageResponseBody(context.Background(), body)
	if changed || string(out) != string(body) {
		t.Fatalf("disabled COS must return body unchanged")
	}
}

func TestEnsureCOSURL_KeepsURLOnRemoteFailure(t *testing.T) {
	enableCOS(t, "https://cdn.test")
	swapUploader(t, &fakeUploader{url: "https://cdn.test/rehosted.png"})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	orig := srv.URL + "/gone.png"
	url, changed, err := EnsureCOSURL(context.Background(), "", orig)
	if err == nil {
		t.Fatalf("expected error on 404 fetch")
	}
	if changed || url != orig {
		t.Fatalf("on failure keep original url, got url=%q changed=%v", url, changed)
	}
}
