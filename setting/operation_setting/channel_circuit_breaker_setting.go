package operation_setting

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type ChannelCircuitBreakerSetting struct {
	Enabled              bool  `json:"enabled"`
	FailureThreshold     int   `json:"failure_threshold"`
	SuccessThreshold     int   `json:"success_threshold"`
	CooldownSeconds      int   `json:"cooldown_seconds"`
	MaxCooldownSeconds   int   `json:"max_cooldown_seconds"`
	FailureWindowSeconds int   `json:"failure_window_seconds"`
	ProbeIntervalSeconds int   `json:"probe_interval_seconds"`
	ProbeTimeoutSeconds  int   `json:"probe_timeout_seconds"`
	TripOnChannelError   bool  `json:"trip_on_channel_error"`
	TripOnNetworkError   bool  `json:"trip_on_network_error"`
	TripStatusCodes      []int `json:"trip_status_codes"`
}

var channelCircuitBreakerSetting = ChannelCircuitBreakerSetting{
	Enabled:              true,
	FailureThreshold:     3,
	SuccessThreshold:     1,
	CooldownSeconds:      60,
	MaxCooldownSeconds:   600,
	FailureWindowSeconds: 300,
	ProbeIntervalSeconds: 10,
	ProbeTimeoutSeconds:  30,
	TripOnChannelError:   true,
	TripOnNetworkError:   true,
	TripStatusCodes: []int{
		408,
		429,
		500,
		502,
		503,
		504,
	},
}

func init() {
	config.GlobalConfig.Register("channel_circuit_breaker", &channelCircuitBreakerSetting)
}

func GetChannelCircuitBreakerSetting() *ChannelCircuitBreakerSetting {
	return &channelCircuitBreakerSetting
}

func ValidateChannelCircuitBreakerOption(key, value string) error {
	trimmed := strings.TrimSpace(value)
	switch key {
	case "enabled", "trip_on_channel_error", "trip_on_network_error":
		if _, err := strconv.ParseBool(trimmed); err != nil {
			return fmt.Errorf("%s must be true or false", key)
		}
	case "failure_threshold", "success_threshold", "cooldown_seconds", "max_cooldown_seconds", "failure_window_seconds", "probe_interval_seconds", "probe_timeout_seconds":
		parsed, err := strconv.Atoi(trimmed)
		if err != nil {
			return fmt.Errorf("%s must be an integer", key)
		}
		if parsed < 1 {
			return fmt.Errorf("%s must be at least 1", key)
		}
	case "trip_status_codes":
		var codes []int
		if err := common.UnmarshalJsonStr(value, &codes); err != nil {
			return fmt.Errorf("trip_status_codes must be a JSON array: %w", err)
		}
		seen := make(map[int]struct{}, len(codes))
		for _, code := range codes {
			if code < 100 || code > 599 {
				return fmt.Errorf("invalid HTTP status code: %d", code)
			}
			if _, ok := seen[code]; ok {
				return fmt.Errorf("duplicate HTTP status code: %d", code)
			}
			seen[code] = struct{}{}
		}
	default:
		return errors.New("unknown channel circuit breaker option")
	}
	return nil
}
