// Package controller: maintenance.go
//
// HTTP handlers that back the System Maintenance "image status / upgrade"
// section of the admin UI. All routes registered under this controller MUST
// require RootAuth — they touch the docker socket and can restart the
// running container.
package controller

import (
	"context"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetImageStatus handles GET /api/maintenance/image-status. It returns the
// current container image reference, the digest we are currently running,
// and the latest digest published by the registry, along with whether the
// watchtower sidecar is reachable.
func GetImageStatus(c *gin.Context) {
	// Bound the total time so a slow registry doesn't block the admin UI.
	// Slightly longer than service.registryRequestTimeout (30s) so a single
	// in-flight registry call has room to fail naturally before we cancel.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 40*time.Second)
	defer cancel()

	status := service.GetImageStatus(ctx)
	common.ApiSuccess(c, status)
}

// TriggerUpgrade handles POST /api/maintenance/upgrade. It tells the
// watchtower sidecar to pull the latest image and recreate this container.
//
// The handler is split into two phases so the HTTP response can be flushed
// BEFORE watchtower kills this container:
//  1. Pre-flight: probe watchtower reachability under a tight timeout. If
//     the sidecar is down or misconfigured the user gets immediate feedback
//     instead of a fake success that hangs the UI.
//  2. Fire the actual /v1/update call in a detached goroutine and respond
//     200 immediately. The UI polls /api/status to detect when the new
//     container is back up.
//
// Without this split, the synchronous /v1/update call holds the request
// open while watchtower stops the container mid-response, and the client
// sees "empty reply from server" instead of a clean success.
func TriggerUpgrade(c *gin.Context) {
	preCtx, preCancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer preCancel()
	if !service.WatchtowerReachable(preCtx) {
		common.ApiError(c, errWatchtowerUnreachable)
		return
	}

	// Detached background context: this container is about to be killed by
	// watchtower, and we want the HTTP response delivered first. The 2-minute
	// cap bounds the goroutine so a hung watchtower doesn't leak resources.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		_ = service.TriggerUpgrade(ctx)
	}()

	common.ApiSuccess(c, gin.H{
		"triggered_at": time.Now().Unix(),
		// Caller should display "this only affects the node serving the
		// request"; multi-host deployments must trigger per-node.
		"scope": "current_node",
	})
}

var errWatchtowerUnreachable = errors.New("watchtower service is unreachable; check the sidecar container is running")
