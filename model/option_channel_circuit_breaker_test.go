package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupOptionTestDB(t *testing.T) {
	t.Helper()
	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&Option{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	prevDB := DB
	prevOptionMap := common.OptionMap
	prevSetting := *operation_setting.GetChannelCircuitBreakerSetting()
	DB = db
	common.OptionMap = make(map[string]string)
	t.Cleanup(func() {
		DB = prevDB
		common.OptionMap = prevOptionMap
		*operation_setting.GetChannelCircuitBreakerSetting() = prevSetting
	})
}

func TestUpdateOptionRejectsInvalidChannelCircuitBreakerValue(t *testing.T) {
	setupOptionTestDB(t)

	if err := UpdateOption("channel_circuit_breaker.failure_threshold", "0"); err == nil {
		t.Fatal("expected invalid threshold to be rejected")
	}

	if _, ok := common.OptionMap["channel_circuit_breaker.failure_threshold"]; ok {
		t.Fatal("invalid option should not be written to OptionMap")
	}

	var count int64
	if err := DB.Model(&Option{}).
		Where(&Option{Key: "channel_circuit_breaker.failure_threshold"}).
		Count(&count).Error; err != nil {
		t.Fatalf("count option: %v", err)
	}
	if count != 0 {
		t.Fatalf("invalid option should not be persisted, got %d rows", count)
	}
}

func TestUpdateOptionAppliesChannelCircuitBreakerValue(t *testing.T) {
	setupOptionTestDB(t)

	if err := UpdateOption("channel_circuit_breaker.failure_threshold", "5"); err != nil {
		t.Fatalf("update threshold: %v", err)
	}

	setting := operation_setting.GetChannelCircuitBreakerSetting()
	if setting.FailureThreshold != 5 {
		t.Fatalf("expected threshold 5, got %d", setting.FailureThreshold)
	}
	if common.OptionMap["channel_circuit_breaker.failure_threshold"] != "5" {
		t.Fatalf("expected OptionMap to be updated, got %q", common.OptionMap["channel_circuit_breaker.failure_threshold"])
	}
}

func TestValidateChannelCircuitBreakerStatusCodes(t *testing.T) {
	if err := operation_setting.ValidateChannelCircuitBreakerOption("trip_status_codes", "[408,429,503]"); err != nil {
		t.Fatalf("valid codes rejected: %v", err)
	}
	if err := operation_setting.ValidateChannelCircuitBreakerOption("trip_status_codes", "[99]"); err == nil {
		t.Fatal("expected out-of-range status code to be rejected")
	}
	if err := operation_setting.ValidateChannelCircuitBreakerOption("trip_status_codes", "[500,500]"); err == nil {
		t.Fatal("expected duplicate status code to be rejected")
	}
}
