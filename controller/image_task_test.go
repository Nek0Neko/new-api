package controller

import (
	"net/http"
	"testing"
)

func TestIsImageTaskSuccess(t *testing.T) {
	cases := []struct {
		name        string
		code        int
		noImage     bool
		body        string
		wantSuccess bool
	}{
		{
			name:        "200 with a valid image json body",
			code:        http.StatusOK,
			noImage:     false,
			body:        `{"created":1,"data":[{"url":"https://cos/x.png"}]}`,
			wantSuccess: true,
		},
		{
			// Streaming upstream delivered no image: handler flags no-content and
			// returns nil (200), but the body is SSE text, not an image. Failure.
			name:        "200 but no-image-content flag set",
			code:        http.StatusOK,
			noImage:     true,
			body:        `{"created":1,"data":[]}`,
			wantSuccess: false,
		},
		{
			// A non-JSON (SSE) body must never count as success — it would poison
			// task.Data and break the poll response / the row update.
			name:        "200 but non-JSON SSE body",
			code:        http.StatusOK,
			noImage:     false,
			body:        "data: {\"type\":\"image_generation.completed\"}\n\n",
			wantSuccess: false,
		},
		{
			name:        "200 but empty body",
			code:        http.StatusOK,
			noImage:     false,
			body:        "",
			wantSuccess: false,
		},
		{
			name:        "non-200 error",
			code:        http.StatusBadGateway,
			noImage:     false,
			body:        `{"error":{"message":"upstream returned no image content"}}`,
			wantSuccess: false,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := isImageTaskSuccess(c.code, c.noImage, []byte(c.body))
			if got != c.wantSuccess {
				t.Fatalf("isImageTaskSuccess(%d, %v, %q) = %v, want %v",
					c.code, c.noImage, c.body, got, c.wantSuccess)
			}
		})
	}
}
