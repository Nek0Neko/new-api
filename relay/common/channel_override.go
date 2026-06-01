package common

import "github.com/QuantumNous/new-api/dto"

// ChannelOverrideResult is the effective set of billing rates for one model on one
// channel, after applying any per-channel override on top of the global rates.
type ChannelOverrideResult struct {
	ModelRatio      float64
	CompletionRatio float64
	ModelPrice      float64
	RatioOverridden bool
	PriceOverridden bool
}

// ApplyChannelModelOverride returns the effective rates for modelName given the
// channel's settings. A present entry replaces the corresponding global rate; an
// absent entry leaves it unchanged. The group ratio is applied by the caller, so
// this function never touches it. Pure and side-effect free for easy testing.
//
// Replacement (not multiplication) makes it idempotent: applying it twice yields
// the same result, which is relied on by RelayInfo.refreshChannelBillingOverride.
func ApplyChannelModelOverride(cs dto.ChannelSettings, modelName string, modelRatio, completionRatio, modelPrice float64) ChannelOverrideResult {
	out := ChannelOverrideResult{ModelRatio: modelRatio, CompletionRatio: completionRatio, ModelPrice: modelPrice}
	if v, ok := cs.ModelRatioOverride[modelName]; ok {
		out.ModelRatio = v
		out.RatioOverridden = true
	}
	if v, ok := cs.CompletionRatioOverride[modelName]; ok {
		out.CompletionRatio = v
		out.RatioOverridden = true
	}
	if v, ok := cs.ModelPriceOverride[modelName]; ok {
		out.ModelPrice = v
		out.PriceOverridden = true
	}
	return out
}
