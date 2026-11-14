//go:build unit

package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestResolveAccountStatsCost_DeepSeekNominalCard(t *testing.T) {
	offPeak := time.Date(2026, time.August, 24, 12, 0, 0, 0, time.UTC)
	for _, model := range []struct {
		name                            string
		input, output, cacheRead, mixed float64
	}{
		{"deepseek-flash", 1, 4, 0.02, 5.02},
		{"deepseek-v4.1-flash", 1, 4, 0.02, 5.02},
		{"deepseek-v4-flash", 1, 4, 0.02, 5.02},
		{"deepseek-v4-flash-0731", 1, 4, 0.02, 5.02},
		{"deepseek-v4-flash-vision-exp", 1, 4, 0.02, 5.02},
		{"deepseek-chat", 1, 4, 0.02, 5.02},
		{"deepseek-reasoner", 1, 4, 0.02, 5.02},
		{"deepseek-foo", 1, 4, 0.02, 5.02},
		{"deepseek-v4-pro", 4.5, 13.5, 0.15, 18.15},
		{"  DeepSeek-V4-Pro-0813  ", 4.5, 13.5, 0.15, 18.15},
	} {
		for _, usage := range []struct {
			name   string
			tokens UsageTokens
			want   float64
		}{
			{"input", UsageTokens{InputTokens: 1_000_000}, model.input},
			{"output", UsageTokens{OutputTokens: 1_000_000}, model.output},
			{"cache_hit", UsageTokens{CacheReadTokens: 1_000_000}, model.cacheRead},
			{"mixed", UsageTokens{InputTokens: 1_000_000, OutputTokens: 1_000_000, CacheReadTokens: 1_000_000}, model.mixed},
		} {
			t.Run(model.name+"/"+usage.name, func(t *testing.T) {
				// The official account default needs neither a channel nor a catalog.
				cost := resolveAccountStatsCost(context.Background(), nil, nil,
					1, 10, model.name, usage.tokens, 1, 999, "", offPeak, true)
				require.NotNil(t, cost)
				require.InDelta(t, usage.want, *cost, 1e-12)
			})
		}
	}
}

func TestResolveAccountStatsCost_DeepSeekNominalPeakBoundaries(t *testing.T) {
	weekday := func(hour, minute int) time.Time {
		return time.Date(2026, time.August, 24, hour, minute, 0, 0, time.UTC)
	}
	cs := newTestChannelServiceForStats(t, &Channel{ID: 1, Status: StatusActive}, 10, PlatformDeepseek)
	for _, model := range []struct {
		name          string
		offPeak, peak float64
	}{
		{"deepseek-flash", 5.02, 10.04},
		{"deepseek-v4-pro-0813", 18.15, 36.30},
	} {
		for _, slot := range []struct {
			name string
			at   time.Time
			peak bool
		}{
			{"before_morning_peak", weekday(0, 59), false},
			{"morning_start", weekday(1, 0), true},
			{"morning_last_minute", weekday(3, 59), true},
			{"morning_end", weekday(4, 0), false},
			{"afternoon_start", weekday(6, 0), true},
			{"afternoon_last_minute", weekday(9, 59), true},
			{"afternoon_end", weekday(10, 0), false},
			{"saturday", time.Date(2026, time.August, 22, 2, 0, 0, 0, time.UTC), false},
			{"sunday", time.Date(2026, time.August, 23, 7, 0, 0, 0, time.UTC), false},
		} {
			t.Run(model.name+"/"+slot.name, func(t *testing.T) {
				cost := resolveAccountStatsCost(context.Background(), cs, nil,
					1, 10, model.name, UsageTokens{InputTokens: 1_000_000, OutputTokens: 1_000_000, CacheReadTokens: 1_000_000},
					1, 999, "", slot.at, true)
				want := model.offPeak
				if slot.peak {
					want = model.peak
				}
				require.NotNil(t, cost)
				require.InDelta(t, want, *cost, 1e-12)
			})
		}
	}
}

func TestResolveAccountStatsCost_DeepSeekIgnoresCatalogTierMetadata(t *testing.T) {
	cs := newTestChannelServiceForStats(t, &Channel{ID: 1, Status: StatusActive}, 10, PlatformOpenAI)
	for _, model := range []struct {
		name string
		want float64
	}{
		{"deepseek-flash", 5.02},
		{"deepseek-v4-pro-0813", 18.15},
	} {
		catalog := &ModelPricing{
			InputPricePerToken: 9e-6, OutputPricePerToken: 8e-6, CacheReadPricePerToken: 7e-6,
			InputPricePerTokenPriority: 6e-6, OutputPricePerTokenPriority: 5e-6, CacheReadPricePerTokenPriority: 4e-6,
			CacheCreationPricePerToken: 3e-6, ImageInputPricePerToken: 2e-6, ImageOutputPricePerToken: 1e-6,
			LongContextInputThreshold: 100, LongContextInputMultiplier: 3, LongContextOutputMultiplier: 2,
			ReasoningEffortMultipliers: map[string]float64{"high": 4},
		}
		before := *catalog
		bs := newTestBillingServiceWithPrices(map[string]*ModelPricing{model.name: catalog})
		for _, tier := range []string{"", "priority", "fast", "flex"} {
			t.Run(model.name+"/"+tier, func(t *testing.T) {
				usageLog := &UsageLog{ServiceTier: &tier, ReasoningEffort: testPtrString("high")}
				applyAccountStatsCost(context.Background(), usageLog, cs, bs,
					1, 10, model.name, "gpt-5.6-sol",
					UsageTokens{
						InputTokens: 1_000_000, OutputTokens: 1_000_000, CacheReadTokens: 1_000_000,
						ImageInputTokens: 100, ImageOutputTokens: 100, CacheCreationTokens: 100,
					}, 999, time.Date(2026, time.August, 24, 12, 0, 0, 0, time.UTC), true)
				require.NotNil(t, usageLog.AccountStatsCost)
				require.InDelta(t, model.want, *usageLog.AccountStatsCost, 1e-12)
				require.Equal(t, before, *catalog, "the account default must not mutate shared customer pricing")
			})
		}
	}
}

func TestResolveAccountStatsCost_DeepSeekMissingChannelBoundaries(t *testing.T) {
	offPeak := time.Date(2026, time.August, 24, 12, 0, 0, 0, time.UTC)
	active := newTestChannelServiceForStats(t, &Channel{ID: 1, Status: StatusActive}, 10, PlatformDeepseek)
	inactive := newTestChannelServiceForStats(t, &Channel{ID: 1, Status: StatusDisabled}, 10, PlatformDeepseek)
	for _, setup := range []struct {
		name    string
		cs      *ChannelService
		groupID int64
	}{
		{"nil_service", nil, 10},
		{"unbound_group", active, 99},
		{"inactive_channel", inactive, 10},
		// An uninitialized service would fail if group zero triggered a lookup.
		{"ungrouped", &ChannelService{}, 0},
	} {
		for _, model := range []string{"deepseek-flash", "deepseek-v4-pro-0813", "claude-sonnet-4", "gpt-5.6-sol", "deepseekcoder", ""} {
			t.Run(setup.name+"/"+model, func(t *testing.T) {
				cost := resolveAccountStatsCost(context.Background(), setup.cs, newTestBillingService(),
					1, setup.groupID, model, UsageTokens{InputTokens: 1_000_000}, 1, 999, "", offPeak, true)
				switch model {
				case "deepseek-flash":
					require.NotNil(t, cost)
					require.InDelta(t, 1, *cost, 1e-12)
				case "deepseek-v4-pro-0813":
					require.NotNil(t, cost)
					require.InDelta(t, 4.5, *cost, 1e-12)
				default:
					require.Nil(t, cost)
				}
			})
		}
	}
}

func TestResolveAccountStatsCost_DeepSeekChannelLookupErrorPreservesFallback(t *testing.T) {
	cs := newTestChannelService(&mockChannelRepository{
		listAllFn: func(context.Context) ([]Channel, error) {
			return nil, errors.New("channel lookup unavailable")
		},
	})
	cost := resolveAccountStatsCost(context.Background(), cs, newTestBillingService(),
		1, 10, "deepseek-flash", UsageTokens{InputTokens: 1_000_000}, 1, 999, "", time.Time{}, true)
	require.Nil(t, cost, "lookup errors may hide explicit account rules and must retain fallback semantics")
}

func TestResolveAccountStatsCost_DeepSeekNonpositiveUsage(t *testing.T) {
	for _, tokens := range []UsageTokens{{}, {InputTokens: -1}, {CacheCreationTokens: 100}, {ImageOutputTokens: 100}} {
		cost := resolveAccountStatsCost(context.Background(), nil, nil,
			1, 10, "deepseek-flash", tokens, 1, 999, "", time.Time{}, true)
		require.Nil(t, cost)
	}
}

func TestApplyAccountStatsCost_DeepSeekEffectiveUpstreamModel(t *testing.T) {
	cs := newTestChannelServiceForStats(t, &Channel{ID: 1, Status: StatusActive}, 10, PlatformOpenAI)
	bs := newTestBillingServiceWithPrices(map[string]*ModelPricing{
		"claude-sonnet-4": {InputPricePerToken: 1e-6, OutputPricePerToken: 2e-6, CacheReadPricePerToken: 1e-7},
	})
	for _, tt := range []struct {
		name, upstream, requested string
		want                      float64
	}{
		{"mapped_flash", "deepseek-flash", "gpt-5.6-sol", 5.02},
		{"mapped_pro", "deepseek-v4-pro-0813", "customer-chat", 18.15},
		{"missing_upstream", "", "deepseek-flash", 5.02},
		{"mapped_away_from_deepseek", "claude-sonnet-4", "deepseek-flash", 3.1},
	} {
		t.Run(tt.name, func(t *testing.T) {
			usageLog := &UsageLog{}
			applyAccountStatsCost(context.Background(), usageLog, cs, bs,
				1, 10, tt.upstream, tt.requested,
				UsageTokens{InputTokens: 1_000_000, OutputTokens: 1_000_000, CacheReadTokens: 1_000_000},
				999, time.Date(2026, time.August, 24, 12, 0, 0, 0, time.UTC), true)
			require.NotNil(t, usageLog.AccountStatsCost)
			require.InDelta(t, tt.want, *usageLog.AccountStatsCost, 1e-12)
		})
	}
}
