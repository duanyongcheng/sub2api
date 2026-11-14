//go:build unit

package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUpdateSettingsChannelMonitorProbesRoundTrip(t *testing.T) {
	for _, tt := range []struct {
		name          string
		mode          string
		initial       string
		body          map[string]any
		expected      bool
		expectedStore string
	}{
		{"enable probes in v2", "v2", "false", map[string]any{"channel_monitor_probes_enabled": true}, true, "true"},
		{"disable probes in v1", "v1", "true", map[string]any{"channel_monitor_probes_enabled": false}, false, "false"},
		{"omitted keeps enabled", "v2", "true", map[string]any{"site_name": "Updated gateway"}, true, "true"},
		{"omitted keeps disabled", "v1", "false", map[string]any{"site_name": "Updated gateway"}, false, "false"},
		{"omitted keeps v1 legacy default", "v1", "", map[string]any{"site_name": "Updated gateway"}, true, "true"},
		{"omitted keeps v2 legacy default", "v2", "", map[string]any{"site_name": "Updated gateway"}, false, "false"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			stored := map[string]string{
				service.SettingKeyChannelMonitorEnabled: "true",
				service.SettingKeyChannelMonitorMode:    tt.mode,
			}
			if tt.initial != "" {
				stored[service.SettingKeyChannelMonitorProbesEnabled] = tt.initial
			}
			h, repo := newStepUpSwitchTestHandler(t, stored)

			rec := doUpdateSettings(t, h, tt.body, nil)

			require.Equal(t, tt.expectedStore, repo.values[service.SettingKeyChannelMonitorProbesEnabled])
			require.Equal(t, tt.expected, channelMonitorProbesResponseValue(t, rec))
			require.Equal(t, tt.expected, getChannelMonitorProbesSetting(t, h))
		})
	}
}

func TestUpdateSettingsChannelMonitorProbesSurviveResponseResubmission(t *testing.T) {
	h, repo := newStepUpSwitchTestHandler(t, map[string]string{
		service.SettingKeyChannelMonitorEnabled:       "true",
		service.SettingKeyChannelMonitorMode:          "v2",
		service.SettingKeyChannelMonitorProbesEnabled: "false",
	})

	first := doUpdateSettings(t, h, map[string]any{"channel_monitor_probes_enabled": true}, nil)
	require.Equal(t, "true", repo.values[service.SettingKeyChannelMonitorProbesEnabled])

	// The settings form uses the PUT response as the value for its next save.
	probesAfterSave := channelMonitorProbesResponseValue(t, first)
	second := doUpdateSettings(t, h, map[string]any{
		"site_name":                      "Updated gateway",
		"channel_monitor_probes_enabled": probesAfterSave,
	}, nil)

	require.Equal(t, "true", repo.values[service.SettingKeyChannelMonitorProbesEnabled])
	require.Equal(t, "Updated gateway", repo.values[service.SettingKeySiteName])
	require.True(t, channelMonitorProbesResponseValue(t, second))
	require.True(t, getChannelMonitorProbesSetting(t, h))
}

func channelMonitorProbesResponseValue(t *testing.T, rec *httptest.ResponseRecorder) bool {
	t.Helper()
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	value, ok := body.Data[service.SettingKeyChannelMonitorProbesEnabled].(bool)
	require.True(t, ok, "settings response must include the probe flag as a boolean")
	return value
}

func getChannelMonitorProbesSetting(t *testing.T, h *SettingHandler) bool {
	t.Helper()
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/admin/settings", nil)
	h.GetSettings(c)
	return channelMonitorProbesResponseValue(t, rec)
}
