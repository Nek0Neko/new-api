package mediastore

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/object_storage_setting"

	"github.com/tencentyun/cos-go-sdk-v5"
)

type cosUploader struct{}

func (u *cosUploader) Upload(ctx context.Context, data []byte, mime string) (string, error) {
	if !object_storage_setting.IsCOSEnabled() {
		return "", fmt.Errorf("tencent cos is not configured")
	}
	cfg := object_storage_setting.GetCOSConfig()
	// Upload endpoint: the regional bucket host, or the global-acceleration host
	// when enabled. Acceleration uses the nearest edge POP + optimized backbone,
	// which is the fix for slow cross-region/cross-border upload throughput that
	// otherwise makes multi-MB image PUTs exceed the client timeout.
	uploadURL := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Bucket, cfg.Region)
	if cfg.Accelerate {
		uploadURL = fmt.Sprintf("https://%s.cos.accelerate.myqcloud.com", cfg.Bucket)
	}
	bu, err := url.Parse(uploadURL)
	if err != nil {
		return "", err
	}
	client := cos.NewClient(&cos.BaseURL{BucketURL: bu}, &http.Client{
		// Bound the upload: it runs synchronously inside the image stream
		// handler, so an unreachable/slow COS must not hang stream completion.
		Timeout: 60 * time.Second,
		Transport: &cos.AuthorizationTransport{
			SecretID:  cfg.SecretID,
			SecretKey: cfg.SecretKey,
		},
	})
	key := buildObjectKey(cfg.PathPrefix, mime)
	_, err = client.Object.Put(ctx, key, bytes.NewReader(data), &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{ContentType: mime},
		ACLHeaderOptions:       &cos.ACLHeaderOptions{XCosACL: "public-read"},
	})
	if err != nil {
		return "", err
	}
	// Download base: prefer the custom/CDN domain; otherwise fall back to the
	// regional bucket host (not the acceleration host, which is upload-oriented).
	base := strings.TrimRight(cfg.CustomDomain, "/")
	if base == "" {
		base = fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Bucket, cfg.Region)
	}
	return base + "/" + key, nil
}

func buildObjectKey(prefix, mime string) string {
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		prefix = "images"
	}
	now := time.Now()
	return fmt.Sprintf("%s/%04d/%02d/%02d/%s.%s",
		prefix, now.Year(), int(now.Month()), now.Day(), common.GetUUID(), extFromMime(mime))
}

func extFromMime(mime string) string {
	switch {
	case strings.Contains(mime, "jpeg"), strings.Contains(mime, "jpg"):
		return "jpg"
	case strings.Contains(mime, "webp"):
		return "webp"
	case strings.Contains(mime, "gif"):
		return "gif"
	default:
		return "png"
	}
}
