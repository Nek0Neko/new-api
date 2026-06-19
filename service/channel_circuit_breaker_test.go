package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

func resetChannelCircuitBreakerForTest() {
	channelCircuitBreaker.Lock()
	defer channelCircuitBreaker.Unlock()
	channelCircuitBreaker.states = make(map[int]*channelCircuitState)
	channelCircuitBreaker.probe = nil
}

func TestChannelCircuitBreakerOpensAndCloses(t *testing.T) {
	resetChannelCircuitBreakerForTest()
	setting := operation_setting.GetChannelCircuitBreakerSetting()
	original := *setting
	*setting = operation_setting.ChannelCircuitBreakerSetting{
		Enabled:              true,
		FailureThreshold:     2,
		SuccessThreshold:     1,
		CooldownSeconds:      60,
		MaxCooldownSeconds:   60,
		FailureWindowSeconds: 300,
		TripStatusCodes:      []int{http.StatusBadGateway},
	}
	defer func() {
		*setting = original
		resetChannelCircuitBreakerForTest()
	}()

	err := types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
	if RecordChannelFailure(1, err) {
		t.Fatal("first failure should not open circuit")
	}
	if IsChannelCircuitOpen(1) {
		t.Fatal("circuit should still be closed after first failure")
	}

	if !RecordChannelFailure(1, err) {
		t.Fatal("second failure should open circuit")
	}
	if !IsChannelCircuitOpen(1) {
		t.Fatal("circuit should be open")
	}

	RecordChannelSuccess(1)
	if IsChannelCircuitOpen(1) {
		t.Fatal("successful probe/request should close circuit")
	}
}
