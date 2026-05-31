package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
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
