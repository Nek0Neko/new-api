package common

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/types"
)

func TestApplyChannelModelOverride(t *testing.T) {
	cs := dto.ChannelSettings{
		ModelRatioOverride:      map[string]float64{"gpt-4o": 3},
		CompletionRatioOverride: map[string]float64{"gpt-4o": 4},
		ModelPriceOverride:      map[string]float64{"dall-e-3": 0.08},
	}
	o := ApplyChannelModelOverride(cs, "gpt-4o", 1.5, 2, 0)
	if o.ModelRatio != 3 {
		t.Errorf("ModelRatio = %v, want 3", o.ModelRatio)
	}
	if o.CompletionRatio != 4 {
		t.Errorf("CompletionRatio = %v, want 4", o.CompletionRatio)
	}
	if !o.RatioOverridden {
		t.Errorf("RatioOverridden should be true")
	}
	p := ApplyChannelModelOverride(cs, "dall-e-3", 0, 0, 0.02)
	if p.ModelPrice != 0.08 {
		t.Errorf("ModelPrice = %v, want 0.08", p.ModelPrice)
	}
	if !p.PriceOverridden {
		t.Errorf("PriceOverridden should be true")
	}
	n := ApplyChannelModelOverride(cs, "claude-3", 1.1, 1.2, 0.01)
	if n.ModelRatio != 1.1 || n.CompletionRatio != 1.2 || n.ModelPrice != 0.01 {
		t.Errorf("unexpected fallthrough: %+v", n)
	}
	if n.RatioOverridden || n.PriceOverridden {
		t.Errorf("no override flags should be set for claude-3")
	}
	empty := ApplyChannelModelOverride(dto.ChannelSettings{}, "gpt-4o", 1.5, 2, 0.02)
	if empty.ModelRatio != 1.5 || empty.CompletionRatio != 2 || empty.ModelPrice != 0.02 {
		t.Errorf("nil maps should be no-op: %+v", empty)
	}
}

func TestApplyChannelModelOverride_ComposesWithGroupRatio(t *testing.T) {
	cs := dto.ChannelSettings{ModelRatioOverride: map[string]float64{"gpt-4o": 3}}
	o := ApplyChannelModelOverride(cs, "gpt-4o", 1.5, 0, 0)
	const groupRatio = 2.0
	if o.ModelRatio*groupRatio != 6 {
		t.Errorf("final = %v, want 6 (override 3 × group 2)", o.ModelRatio*groupRatio)
	}
	o2 := ApplyChannelModelOverride(dto.ChannelSettings{}, "gpt-4o", 1.5, 0, 0)
	if o2.ModelRatio*groupRatio != 3 {
		t.Errorf("fallthrough final = %v, want 3", o2.ModelRatio*groupRatio)
	}
}

// refreshChannelBillingOverride is the mechanism that makes per-channel overrides
// take effect for chat/claude/gemini, where pricing runs at pre-consume (before a
// channel exists) and only PriceData carries the rates into settlement.
func TestRefreshChannelBillingOverride(t *testing.T) {
	newInfo := func() *RelayInfo {
		return &RelayInfo{
			OriginModelName: "gpt-4o",
			PriceComputed:   true,
			PriceData: types.PriceData{
				ModelRatio:      1.5,
				CompletionRatio: 2,
				ModelPrice:      0.01,
			},
			ChannelMeta: &ChannelMeta{
				ChannelSetting: dto.ChannelSettings{
					ModelRatioOverride:      map[string]float64{"gpt-4o": 3},
					CompletionRatioOverride: map[string]float64{"gpt-4o": 4},
				},
			},
		}
	}

	t.Run("applies override into PriceData", func(t *testing.T) {
		info := newInfo()
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 3 || info.PriceData.CompletionRatio != 4 {
			t.Errorf("got ModelRatio=%v CompletionRatio=%v, want 3 and 4", info.PriceData.ModelRatio, info.PriceData.CompletionRatio)
		}
	})

	t.Run("idempotent", func(t *testing.T) {
		info := newInfo()
		info.refreshChannelBillingOverride()
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 3 || info.PriceData.CompletionRatio != 4 {
			t.Errorf("re-applying changed result: ModelRatio=%v CompletionRatio=%v", info.PriceData.ModelRatio, info.PriceData.CompletionRatio)
		}
	})

	t.Run("no-op when pricing not yet computed", func(t *testing.T) {
		info := newInfo()
		info.PriceComputed = false
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 1.5 {
			t.Errorf("ModelRatio = %v, want 1.5 (untouched before pricing)", info.PriceData.ModelRatio)
		}
	})

	t.Run("no-op for tiered-expr models", func(t *testing.T) {
		info := newInfo()
		info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{}
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 1.5 {
			t.Errorf("ModelRatio = %v, want 1.5 (tiered models skip override)", info.PriceData.ModelRatio)
		}
	})

	t.Run("no-op when channel has no override for the model", func(t *testing.T) {
		info := newInfo()
		info.ChannelSetting = dto.ChannelSettings{ModelRatioOverride: map[string]float64{"other-model": 9}}
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 1.5 || info.PriceData.CompletionRatio != 2 {
			t.Errorf("rates changed for a non-matching override: %+v", info.PriceData)
		}
	})

	// Retry that switches from an overridden channel to one without an override for
	// the model must revert to the global base, not stick at the previous override.
	t.Run("retry to non-override channel reverts to global base", func(t *testing.T) {
		info := newInfo() // base global: ModelRatio 1.5, CompletionRatio 2
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 3 || info.PriceData.CompletionRatio != 4 {
			t.Fatalf("first channel override not applied: %+v", info.PriceData)
		}
		// Simulate retry: re-init with a channel that has no override for this model.
		info.ChannelSetting = dto.ChannelSettings{ModelRatioOverride: map[string]float64{"other": 9}}
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 1.5 || info.PriceData.CompletionRatio != 2 {
			t.Errorf("did not revert to global base: ModelRatio=%v CompletionRatio=%v, want 1.5 and 2", info.PriceData.ModelRatio, info.PriceData.CompletionRatio)
		}
	})

	// Retry that switches to a channel with a different override applies the new one.
	t.Run("retry to different override channel applies new override", func(t *testing.T) {
		info := newInfo()
		info.refreshChannelBillingOverride() // -> 3 / 4
		info.ChannelSetting = dto.ChannelSettings{ModelRatioOverride: map[string]float64{"gpt-4o": 7}}
		info.refreshChannelBillingOverride()
		if info.PriceData.ModelRatio != 7 {
			t.Errorf("ModelRatio = %v, want 7 (new channel override)", info.PriceData.ModelRatio)
		}
		if info.PriceData.CompletionRatio != 2 {
			t.Errorf("CompletionRatio = %v, want 2 (reverted to base, new channel has no completion override)", info.PriceData.CompletionRatio)
		}
	})

	t.Run("no-op when channel meta is nil", func(t *testing.T) {
		info := newInfo()
		info.ChannelMeta = nil
		info.refreshChannelBillingOverride() // must not panic
		if info.PriceComputed != true {
			t.Errorf("unexpected mutation")
		}
	})
}

// An explicit 0 override must replace the global rate (and flag the override), so
// downstream billing treats the model as free on this channel. Guards against a
// future "0 means unset" regression in the helper.
func TestApplyChannelModelOverride_ZeroMeansFree(t *testing.T) {
	cs := dto.ChannelSettings{ModelRatioOverride: map[string]float64{"m": 0}}
	o := ApplyChannelModelOverride(cs, "m", 5, 0, 0)
	if o.ModelRatio != 0 {
		t.Errorf("ModelRatio = %v, want 0 (explicit zero override)", o.ModelRatio)
	}
	if !o.RatioOverridden {
		t.Errorf("RatioOverridden should be true for an explicit 0 override")
	}
}
