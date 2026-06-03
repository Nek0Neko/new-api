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
	bucketURL := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.Bucket, cfg.Region)
	bu, err := url.Parse(bucketURL)
	if err != nil {
		return "", err
	}
	client := cos.NewClient(&cos.BaseURL{BucketURL: bu}, &http.Client{
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
	base := strings.TrimRight(cfg.CustomDomain, "/")
	if base == "" {
		base = bucketURL
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
