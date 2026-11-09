package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/usagestats"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAdminUsageExactTimeRange(t *testing.T) {
	start := time.Date(2026, 11, 8, 7, 30, 45, 123000000, time.UTC)
	end := start.Add(24 * time.Hour)
	query := url.Values{
		"start_date": {start.Format(time.RFC3339Nano)},
		"end_date":   {end.Format(time.RFC3339Nano)},
		"timezone":   {"Asia/Shanghai"},
	}.Encode()
	for _, path := range []string{"/admin/usage", "/admin/usage/stats"} {
		t.Run(path, func(t *testing.T) {
			repo := &adminUsageRepoCapture{}
			usageStatsCache = newSnapshotCache(30 * time.Second)
			t.Cleanup(func() { usageStatsCache = newSnapshotCache(30 * time.Second) })
			router := newAdminUsageRequestTypeTestRouter(repo)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path+"?"+query, nil))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			filters := repo.listFilters
			if path == "/admin/usage/stats" {
				filters = repo.statsFilters
			}
			require.NotNil(t, filters.StartTime)
			require.NotNil(t, filters.EndTime)
			require.True(t, start.Equal(*filters.StartTime))
			require.True(t, end.Equal(*filters.EndTime))
			require.Equal(t, 24*time.Hour, filters.EndTime.Sub(*filters.StartTime))
		})
	}
}

func TestDashboardExactTimeRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	start := time.Date(2026, 11, 8, 7, 30, 45, 123000000, time.UTC)
	end := start.Add(24 * time.Hour)
	query := url.Values{"start_date": {start.Format(time.RFC3339Nano)}, "end_date": {end.Format(time.RFC3339Nano)}}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/?"+query.Encode(), nil)
	gotStart, gotEnd, ok := parseTimeRange(c)
	require.True(t, ok)
	require.True(t, start.Equal(gotStart), "start %s should remain exact, got %s", start, gotStart)
	require.True(t, end.Equal(gotEnd), "end %s should remain exact, got %s", end, gotEnd)
}

func TestUsageStatsCacheKeyPreservesSubseconds(t *testing.T) {
	start := time.Date(2026, 11, 8, 7, 30, 45, 123000000, time.UTC)
	end := start.Add(24 * time.Hour)
	base := usagestats.UsageLogFilters{StartTime: &start, EndTime: &end}
	otherEnd := end.Add(time.Millisecond)
	other := base
	other.EndTime = &otherEnd
	require.NotEqual(t, usageStatsCacheKey(base), usageStatsCacheKey(other))
}

func TestDashboardTrendCachePreservesSubseconds(t *testing.T) {
	resetDashboardReadCachesForTest()
	t.Cleanup(resetDashboardReadCachesForTest)
	repo := &dashboardUsageRepoCacheProbe{}
	handler := NewDashboardHandler(service.NewDashboardService(repo, nil, nil, nil), nil)
	router := gin.New()
	router.GET("/trend", handler.GetUsageTrend)
	for _, start := range []string{"2026-11-08T07:30:45.123Z", "2026-11-08T07:30:45.124Z"} {
		query := url.Values{"start_date": {start}, "end_date": {"2026-11-09T07:30:45.123Z"}}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/trend?"+query.Encode(), nil))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.Equal(t, "miss", rec.Header().Get("X-Snapshot-Cache"))
	}
	require.Equal(t, int32(2), repo.trendCalls.Load())
}

func TestDashboardRejectsMalformedTimeRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewDashboardHandler(nil, nil)
	for _, endpoint := range []gin.HandlerFunc{
		handler.GetUsageTrend, handler.GetModelStats, handler.GetGroupStats,
		handler.GetAPIKeyUsageTrend, handler.GetUserUsageTrend,
		handler.GetUserSpendingRanking, handler.GetUserBreakdown, handler.GetSnapshotV2,
	} {
		for _, query := range []string{"start_date=2026-11-09Tbad", "end_date=2026-11-09T12:00:00"} {
			rec := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(rec)
			c.Request = httptest.NewRequest(http.MethodGet, "/?"+query, nil)
			endpoint(c)
			require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
		}
	}
}

func TestDashboardCacheSeparatesExactRangeMetadata(t *testing.T) {
	resetDashboardReadCachesForTest()
	dashboardUsersRankingCache = newSnapshotCache(5 * time.Minute)
	t.Cleanup(func() {
		resetDashboardReadCachesForTest()
		dashboardUsersRankingCache = newSnapshotCache(5 * time.Minute)
	})
	repo := &dashboardUsageRepoCapture{}
	handler := NewDashboardHandler(service.NewDashboardService(repo, nil, nil, nil), nil)
	router := gin.New()
	router.GET("/snapshot", handler.GetSnapshotV2)
	router.GET("/ranking", handler.GetUserSpendingRanking)
	for _, path := range []string{"/snapshot", "/ranking"} {
		for _, tc := range []struct{ start, end string }{
			{"2026-11-08", "2026-11-08"},
			{"2026-11-08T00:00:00Z", "2026-11-09T00:00:00Z"},
			{"2026-11-08T00:00:00.001Z", "2026-11-09T00:00:00.001Z"},
		} {
			query := url.Values{
				"start_date": {tc.start}, "end_date": {tc.end}, "timezone": {"UTC"},
				"include_stats": {"false"}, "include_trend": {"false"}, "include_model_stats": {"false"},
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path+"?"+query.Encode(), nil))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			require.Equal(t, "miss", rec.Header().Get("X-Snapshot-Cache"))
			var result struct {
				Data struct {
					Start string `json:"start_date"`
					End   string `json:"end_date"`
				} `json:"data"`
			}
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
			require.Equal(t, tc.start, result.Data.Start)
			require.Equal(t, tc.end, result.Data.End)
		}
	}
}

func TestCleanupExactTimeRangeStaysBelowExclusiveEnd(t *testing.T) {
	for _, endValue := range []string{"2026-11-09T07:30:45.123Z", "2026-11-09T07:30:45.123456789Z"} {
		t.Run(endValue, func(t *testing.T) {
			repo := &cleanupRepoStub{}
			cfg := &config.Config{UsageCleanup: config.UsageCleanupConfig{Enabled: true, MaxRangeDays: 31}}
			router := setupCleanupRouter(service.NewUsageCleanupService(repo, nil, nil, cfg), 88)
			start, err := time.Parse(time.RFC3339Nano, "2026-11-08T07:30:45.123Z")
			require.NoError(t, err)
			end, err := time.Parse(time.RFC3339Nano, endValue)
			require.NoError(t, err)
			body, err := json.Marshal(map[string]string{"start_date": start.Format(time.RFC3339Nano), "end_date": endValue})
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/usage/cleanup-tasks", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			require.Len(t, repo.created, 1)
			filters := repo.created[0].Filters
			require.True(t, filters.StartTime.Equal(start))
			require.True(t, filters.EndTime.Before(end))
			require.Equal(t, filters.EndTime, filters.EndTime.Truncate(time.Microsecond))
			require.False(t, filters.EndTime.Add(time.Microsecond).Before(end))
		})
	}
}
