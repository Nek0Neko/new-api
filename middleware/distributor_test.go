package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestGetModelRequestImageTaskFetchSkipsChannel verifies that polling an async
// image task status (GET /v1/images/generations/tasks/:task_id) does NOT trigger
// channel selection. FetchImageTask is a pure DB lookup with no upstream call, so
// requiring a "dall-e" channel here wrongly 503s when the user's group has none.
func TestGetModelRequestImageTaskFetchSkipsChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/v1/images/generations/tasks/task_abc123", nil)
	c.Request = req

	_, shouldSelectChannel, err := getModelRequest(c)
	require.NoError(t, err)
	require.False(t, shouldSelectChannel, "image task poll GET must not select a channel")
}
