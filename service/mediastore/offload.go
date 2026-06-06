package mediastore

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/object_storage_setting"
)

// maxRehostBytes caps how much we download when re-hosting a remote image URL,
// guarding against a malicious/oversized upstream payload.
const maxRehostBytes = 32 << 20 // 32 MiB

// rehostHTTPClient fetches remote images for re-hosting. It is bounded so an
// unreachable/slow upstream URL can't hang the caller (history read / task finish).
var rehostHTTPClient = &http.Client{Timeout: 60 * time.Second}

// EnsureCOSURL makes sure an image — given its inline base64 and/or current url —
// is hosted on our COS bucket, and returns the COS url. It returns
// (url, changed, err):
//   - changed=true when a NEW upload happened (the caller should persist the
//     returned url and drop any base64 fallback);
//   - changed=false with no error when nothing was done: COS is disabled, the url
//     is already ours, or there's nothing to host. The original url is returned;
//   - on a real download/upload failure it returns the original url, changed=false
//     and the error so the caller keeps the base64/url fallback for a later retry.
func EnsureCOSURL(ctx context.Context, b64, rawURL string) (string, bool, error) {
	if !object_storage_setting.IsCOSEnabled() {
		return rawURL, false, nil
	}
	cfg := object_storage_setting.GetCOSConfig()
	// Already served from our bucket/domain: nothing to do.
	if cfg.OwnsURL(rawURL) {
		return rawURL, false, nil
	}
	// Prefer the inline base64 payload (no extra round trip).
	if b64 != "" {
		url, err := uploadBase64(ctx, b64)
		if err != nil {
			return rawURL, false, err
		}
		return url, true, nil
	}
	// Otherwise re-host a remote (e.g. expiring upstream) http(s) url to COS.
	if strings.HasPrefix(rawURL, "http://") || strings.HasPrefix(rawURL, "https://") {
		data, mime, err := fetchRemoteImage(ctx, rawURL)
		if err != nil {
			return rawURL, false, err
		}
		url, err := uploader.Upload(ctx, data, mime)
		if err != nil {
			return rawURL, false, err
		}
		return url, true, nil
	}
	return rawURL, false, nil
}

// OffloadImageResponseBody rewrites a full image response so every image is hosted
// on COS: base64 payloads are uploaded and expiring/non-COS upstream urls are
// re-hosted, each replaced with the COS url (and the base64 cleared). Unlike
// RewriteImageResponseBody (relay path, base64-only, gated on response_format),
// this runs unconditionally at task finish so the stored result is durable
// regardless of channel pass-through / response_format. Returns (body, changed);
// the original body is returned unchanged when nothing was offloaded.
func OffloadImageResponseBody(ctx context.Context, body []byte) ([]byte, bool) {
	var resp dto.ImageResponse
	if err := common.Unmarshal(body, &resp); err != nil {
		return body, false
	}
	if !object_storage_setting.IsCOSEnabled() {
		for i := range resp.Data {
			if resp.Data[i].B64Json != "" || resp.Data[i].Url != "" {
				common.SysLog("cos disabled: generated image not offloaded (configure 腾讯云 COS to store urls instead of base64)")
				break
			}
		}
		return body, false
	}
	changed := false
	for i := range resp.Data {
		d := &resp.Data[i]
		if d.B64Json == "" && d.Url == "" {
			continue
		}
		url, did, err := EnsureCOSURL(ctx, d.B64Json, d.Url)
		if err != nil {
			common.SysError("offload image to cos failed: " + err.Error())
			continue
		}
		if did {
			d.Url = url
			d.B64Json = ""
			changed = true
		}
	}
	if !changed {
		return body, false
	}
	out, err := common.Marshal(resp)
	if err != nil {
		return body, false
	}
	return out, true
}

// fetchRemoteImage downloads an image url, capped at maxRehostBytes, returning the
// raw bytes and a detected image MIME type.
func fetchRemoteImage(ctx context.Context, rawURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := rehostHTTPClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("fetch image url failed: status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxRehostBytes+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) > maxRehostBytes {
		return nil, "", fmt.Errorf("remote image exceeds %d bytes", maxRehostBytes)
	}
	mime := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(mime, "image/") {
		mime = http.DetectContentType(data)
	}
	return data, mime, nil
}
