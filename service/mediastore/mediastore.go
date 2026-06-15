package mediastore

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
)

// Uploader uploads raw image bytes and returns a publicly accessible URL.
type Uploader interface {
	Upload(ctx context.Context, data []byte, mime string) (string, error)
}

// uploader is the active implementation; overridable in tests.
var uploader Uploader = &cosUploader{}

// uploadBase64 decodes a (possibly data-URL-prefixed) base64 image and uploads
// it, returning the public URL.
func uploadBase64(ctx context.Context, b64 string) (string, error) {
	if idx := strings.Index(b64, ","); idx != -1 {
		b64 = b64[idx+1:]
	}
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}
	mime := http.DetectContentType(raw)
	return uploader.Upload(ctx, raw, mime)
}
