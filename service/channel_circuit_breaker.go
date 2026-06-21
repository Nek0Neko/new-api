package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

type ChannelProbeFunc func(channel *model.Channel) *types.NewAPIError

type channelCircuitState struct {
	Open         bool
	FailureCount int
	SuccessCount int
	OpenedAt     time.Time
	OpenUntil    time.Time
	LastFailure  time.Time
	LastSuccess  time.Time
	LastProbe    time.Time
	ProbeRunning bool
	Cooldown     time.Duration
	Reason       string
}

type ChannelCircuitSnapshot struct {
	ChannelID    int       `json:"channel_id"`
	Open         bool      `json:"open"`
	FailureCount int       `json:"failure_count"`
	SuccessCount int       `json:"success_count"`
	OpenedAt     time.Time `json:"opened_at"`
	OpenUntil    time.Time `json:"open_until"`
	LastFailure  time.Time `json:"last_failure"`
	LastSuccess  time.Time `json:"last_success"`
	LastProbe    time.Time `json:"last_probe"`
	ProbeRunning bool      `json:"probe_running"`
	Reason       string    `json:"reason"`
}

var channelCircuitBreaker = struct {
	sync.RWMutex
	states map[int]*channelCircuitState
	probe  ChannelProbeFunc
}{
	states: make(map[int]*channelCircuitState),
}

func SetChannelCircuitBreakerProbeFunc(fn ChannelProbeFunc) {
	channelCircuitBreaker.Lock()
	defer channelCircuitBreaker.Unlock()
	channelCircuitBreaker.probe = fn
}

func RecordChannelSuccess(channelID int) {
	if channelID <= 0 {
		return
	}
	setting := operation_setting.GetChannelCircuitBreakerSetting()
	if setting == nil || !setting.Enabled {
		return
	}

	now := time.Now()
	successThreshold := setting.SuccessThreshold
	if successThreshold <= 0 {
		successThreshold = 1
	}

	channelCircuitBreaker.Lock()
	defer channelCircuitBreaker.Unlock()

	state := channelCircuitBreaker.states[channelID]
	if state == nil {
		return
	}
	state.LastSuccess = now
	state.FailureCount = 0
	if state.Open {
		state.SuccessCount++
		if state.SuccessCount < successThreshold {
			return
		}
	}
	delete(channelCircuitBreaker.states, channelID)
	logger.LogInfo(nil, fmt.Sprintf("channel circuit breaker closed: channel #%d recovered", channelID))
}

func RecordChannelFailure(channelID int, err *types.NewAPIError) bool {
	if channelID <= 0 || err == nil {
		return false
	}
	setting := operation_setting.GetChannelCircuitBreakerSetting()
	if setting == nil || !setting.Enabled {
		return false
	}
	if !shouldTripChannelCircuitBreaker(setting, err) {
		return false
	}

	now := time.Now()
	failureThreshold := setting.FailureThreshold
	if failureThreshold <= 0 {
		failureThreshold = 3
	}
	window := time.Duration(setting.FailureWindowSeconds) * time.Second
	if window <= 0 {
		window = 5 * time.Minute
	}
	cooldown := time.Duration(setting.CooldownSeconds) * time.Second
	if cooldown <= 0 {
		cooldown = time.Minute
	}
	maxCooldown := time.Duration(setting.MaxCooldownSeconds) * time.Second
	if maxCooldown <= 0 {
		maxCooldown = 10 * time.Minute
	}

	channelCircuitBreaker.Lock()
	defer channelCircuitBreaker.Unlock()

	state := channelCircuitBreaker.states[channelID]
	if state == nil {
		state = &channelCircuitState{}
		channelCircuitBreaker.states[channelID] = state
	}

	if !state.LastFailure.IsZero() && now.Sub(state.LastFailure) > window && !state.OpenUntil.After(now) {
		state.FailureCount = 0
		state.SuccessCount = 0
		state.Cooldown = 0
	}

	state.LastFailure = now
	state.LastSuccess = time.Time{}
	state.SuccessCount = 0
	state.FailureCount++
	state.Reason = err.ErrorWithStatusCode()

	if state.FailureCount < failureThreshold && !state.Open {
		return false
	}

	nextCooldown := cooldown
	if state.Cooldown > 0 {
		nextCooldown = state.Cooldown * 2
	}
	if nextCooldown > maxCooldown {
		nextCooldown = maxCooldown
	}
	state.Open = true
	state.Cooldown = nextCooldown
	state.OpenedAt = now
	state.OpenUntil = now.Add(nextCooldown)

	logger.LogWarn(nil, fmt.Sprintf("channel circuit breaker opened: channel #%d skipped for %.0fs after %d failures, reason: %s",
		channelID, nextCooldown.Seconds(), state.FailureCount, common.LocalLogPreview(state.Reason)))
	return true
}

func GetOpenCircuitChannelIDs() map[int]bool {
	setting := operation_setting.GetChannelCircuitBreakerSetting()
	if setting == nil || !setting.Enabled {
		return nil
	}
	channelCircuitBreaker.RLock()
	defer channelCircuitBreaker.RUnlock()

	ids := make(map[int]bool)
	for id, state := range channelCircuitBreaker.states {
		if state != nil && state.Open {
			ids[id] = true
		}
	}
	if len(ids) == 0 {
		return nil
	}
	return ids
}

func IsChannelCircuitOpen(channelID int) bool {
	if channelID <= 0 {
		return false
	}
	setting := operation_setting.GetChannelCircuitBreakerSetting()
	if setting == nil || !setting.Enabled {
		return false
	}
	channelCircuitBreaker.RLock()
	defer channelCircuitBreaker.RUnlock()
	state := channelCircuitBreaker.states[channelID]
	return state != nil && state.Open
}

func GetChannelCircuitBreakerSnapshots() []ChannelCircuitSnapshot {
	channelCircuitBreaker.RLock()
	defer channelCircuitBreaker.RUnlock()

	snapshots := make([]ChannelCircuitSnapshot, 0, len(channelCircuitBreaker.states))
	for id, state := range channelCircuitBreaker.states {
		if state == nil {
			continue
		}
		snapshots = append(snapshots, ChannelCircuitSnapshot{
			ChannelID:    id,
			Open:         state.Open,
			FailureCount: state.FailureCount,
			SuccessCount: state.SuccessCount,
			OpenedAt:     state.OpenedAt,
			OpenUntil:    state.OpenUntil,
			LastFailure:  state.LastFailure,
			LastSuccess:  state.LastSuccess,
			LastProbe:    state.LastProbe,
			ProbeRunning: state.ProbeRunning,
			Reason:       state.Reason,
		})
	}
	return snapshots
}

func StartChannelCircuitBreakerProbeLoop(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ProbeDueChannelCircuits()
			}
		}
	}()
}

func ProbeDueChannelCircuits() {
	setting := operation_setting.GetChannelCircuitBreakerSetting()
	if setting == nil || !setting.Enabled {
		return
	}
	interval := time.Duration(setting.ProbeIntervalSeconds) * time.Second
	if interval <= 0 {
		interval = 10 * time.Second
	}
	now := time.Now()

	type dueProbe struct {
		channelID int
		probe     ChannelProbeFunc
	}
	due := make([]dueProbe, 0)

	channelCircuitBreaker.Lock()
	for id, state := range channelCircuitBreaker.states {
		if state == nil {
			continue
		}
		if !state.Open {
			continue
		}
		if state.ProbeRunning {
			continue
		}
		if now.Before(state.OpenUntil) {
			continue
		}
		if !state.LastProbe.IsZero() && now.Sub(state.LastProbe) < interval {
			continue
		}
		if channelCircuitBreaker.probe == nil {
			continue
		}
		state.ProbeRunning = true
		state.LastProbe = now
		due = append(due, dueProbe{channelID: id, probe: channelCircuitBreaker.probe})
	}
	channelCircuitBreaker.Unlock()

	for _, item := range due {
		go runChannelCircuitProbe(item.channelID, item.probe)
	}
}

func runChannelCircuitProbe(channelID int, probe ChannelProbeFunc) {
	channel, err := model.CacheGetChannel(channelID)
	if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled {
		finishChannelCircuitProbe(channelID)
		return
	}

	probeErr := probe(channel)
	if probeErr == nil {
		RecordChannelSuccess(channelID)
		finishChannelCircuitProbe(channelID)
		return
	}
	RecordChannelFailure(channelID, probeErr)
	finishChannelCircuitProbe(channelID)
}

func finishChannelCircuitProbe(channelID int) {
	channelCircuitBreaker.Lock()
	defer channelCircuitBreaker.Unlock()
	if state := channelCircuitBreaker.states[channelID]; state != nil {
		state.ProbeRunning = false
	}
}

func shouldTripChannelCircuitBreaker(setting *operation_setting.ChannelCircuitBreakerSetting, err *types.NewAPIError) bool {
	if setting.TripOnChannelError && types.IsChannelError(err) {
		return true
	}
	if statusCodeInList(err.StatusCode, setting.TripStatusCodes) {
		return true
	}
	if setting.TripOnNetworkError && looksLikeNetworkFailure(err) {
		return true
	}
	return false
}

func statusCodeInList(code int, codes []int) bool {
	if code <= 0 || len(codes) == 0 {
		return false
	}
	for _, candidate := range codes {
		if code == candidate {
			return true
		}
	}
	return false
}

func looksLikeNetworkFailure(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	if err.GetErrorCode() == types.ErrorCodeDoRequestFailed {
		return true
	}
	msg := strings.ToLower(err.Error())
	needles := []string{
		"timeout",
		"deadline exceeded",
		"connection refused",
		"connection reset",
		"connection reset by peer",
		"no such host",
		"tls handshake timeout",
		"server closed",
		"unexpected eof",
	}
	for _, needle := range needles {
		if strings.Contains(msg, needle) {
			return true
		}
	}
	return err.StatusCode == http.StatusRequestTimeout
}

func buildChannelCircuitBreakerAdminInfo(channelID int) map[string]interface{} {
	if channelID <= 0 {
		return nil
	}
	channelCircuitBreaker.RLock()
	defer channelCircuitBreaker.RUnlock()
	state := channelCircuitBreaker.states[channelID]
	if state == nil {
		return nil
	}
	return map[string]interface{}{
		"open":          state.Open,
		"failure_count": state.FailureCount,
		"open_until":    state.OpenUntil.Unix(),
		"reason":        state.Reason,
	}
}

func GetChannelCircuitBreakerInfo(channelID int) map[string]interface{} {
	return buildChannelCircuitBreakerAdminInfo(channelID)
}

func AppendChannelCircuitBreakerAdminInfo(channelID int, adminInfo map[string]interface{}) {
	if adminInfo == nil {
		return
	}
	info := buildChannelCircuitBreakerAdminInfo(channelID)
	if info == nil {
		return
	}
	adminInfo["channel_circuit_breaker"] = info
}
