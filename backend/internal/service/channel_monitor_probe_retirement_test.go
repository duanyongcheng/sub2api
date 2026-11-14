//go:build unit

package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type channelMonitorRuntimeStub struct {
	rt ChannelMonitorRuntime
}

func (s channelMonitorRuntimeStub) GetChannelMonitorRuntime(context.Context) ChannelMonitorRuntime {
	return s.rt
}

func TestRunCheck_ProbesDisabledRetiresActiveProbes(t *testing.T) {
	svc := NewChannelMonitorService(nil, nil)
	svc.SetRuntimeReader(channelMonitorRuntimeStub{rt: ChannelMonitorRuntime{
		Enabled: true,
		Mode:    ChannelMonitorModeV2,
		// Mode alone no longer decides: the dedicated switch does.
		ProbesEnabled: false,
	}})

	results, err := svc.RunCheck(context.Background(), 1)
	require.ErrorIs(t, err, ErrChannelMonitorActiveProbesRetired)
	require.Nil(t, results)
}

func TestRunCheck_DisabledReturnsDisabled(t *testing.T) {
	svc := NewChannelMonitorService(nil, nil)
	svc.SetRuntimeReader(channelMonitorRuntimeStub{rt: ChannelMonitorRuntime{
		Enabled: false,
		Mode:    ChannelMonitorModeV1,
	}})

	_, err := svc.RunCheck(context.Background(), 1)
	require.ErrorIs(t, err, ErrChannelMonitorDisabled)
}

func TestRunCheck_NilRuntimeReaderFailsClosedAsV2(t *testing.T) {
	svc := NewChannelMonitorService(nil, nil)
	// No SetRuntimeReader → probeRuntime defaults to mode=v2 (retired).
	_, err := svc.RunCheck(context.Background(), 1)
	require.ErrorIs(t, err, ErrChannelMonitorActiveProbesRetired)
}

func TestNormalizeChannelMonitorMode(t *testing.T) {
	require.Equal(t, ChannelMonitorModeV1, normalizeChannelMonitorMode(""))
	require.Equal(t, ChannelMonitorModeV1, normalizeChannelMonitorMode("v1"))
	require.Equal(t, ChannelMonitorModeV2, normalizeChannelMonitorMode("v2"))
	require.Equal(t, ChannelMonitorModeV1, normalizeChannelMonitorMode("invalid"))
	require.Equal(t, ChannelMonitorModeV1, normalizeChannelMonitorMode(" V1 "))
}

func TestChannelMonitorRuntimeActiveProbesAllowed(t *testing.T) {
	require.False(t, (ChannelMonitorRuntime{Enabled: false, ProbesEnabled: true}).ActiveProbesAllowed())
	require.True(t, (ChannelMonitorRuntime{Enabled: true, ProbesEnabled: true}).ActiveProbesAllowed())
	require.False(t, (ChannelMonitorRuntime{Enabled: true, ProbesEnabled: false}).ActiveProbesAllowed())
	// The probe switch is independent of the mode: v2 aggregation and probes can
	// run on the same site, so a cold group can be probed while traffic is still
	// aggregated for the groups that have real requests.
	probesAndAggregation := ChannelMonitorRuntime{Enabled: true, Mode: ChannelMonitorModeV2, ProbesEnabled: true}
	require.True(t, probesAndAggregation.ActiveProbesAllowed())
	require.True(t, probesAndAggregation.PassiveAggregationAllowed())
	// v1 mode with probes off stays fully quiet.
	require.False(t, (ChannelMonitorRuntime{Enabled: true, Mode: ChannelMonitorModeV1, ProbesEnabled: false}).ActiveProbesAllowed())
}

func TestResolveChannelMonitorProbesEnabled(t *testing.T) {
	// Unset keeps the legacy behaviour: only v1 mode probes.
	require.True(t, resolveChannelMonitorProbesEnabled(ChannelMonitorModeV1, ""))
	require.False(t, resolveChannelMonitorProbesEnabled(ChannelMonitorModeV2, ""))
	// An explicit value always wins, so a v2 site can opt into probes.
	require.True(t, resolveChannelMonitorProbesEnabled(ChannelMonitorModeV2, "true"))
	require.False(t, resolveChannelMonitorProbesEnabled(ChannelMonitorModeV1, "false"))
	require.True(t, resolveChannelMonitorProbesEnabled(ChannelMonitorModeV2, " TRUE "))
}
