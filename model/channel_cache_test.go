package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestGetRandomSatisfiedChannelWithExclusionsFallsThroughPriority(t *testing.T) {
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalGroup2Model2Channels := group2model2channels
	originalChannelsIDM := channelsIDM
	defer func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		group2model2channels = originalGroup2Model2Channels
		channelsIDM = originalChannelsIDM
	}()

	common.MemoryCacheEnabled = true
	priorityHigh := int64(10)
	priorityLow := int64(2)
	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-test": {1, 3, 10},
		},
	}
	channelsIDM = map[int]*Channel{
		1:  {Id: 1, Priority: &priorityHigh},
		3:  {Id: 3, Priority: &priorityLow},
		10: {Id: 10, Priority: &priorityLow},
	}

	channel, err := GetRandomSatisfiedChannelWithExclusions("default", "gpt-test", 0, "", map[int]bool{1: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if channel == nil {
		t.Fatal("expected fallback channel")
	}
	if channel.Id != 3 && channel.Id != 10 {
		t.Fatalf("expected priority 2 fallback channel, got #%d", channel.Id)
	}
}
