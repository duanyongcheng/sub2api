package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUserUsageExactTimeRange(t *testing.T) {
	start := time.Date(2026, 11, 8, 7, 30, 45, 123000000, time.UTC)
	end := start.Add(24 * time.Hour)
	query := url.Values{
		"start_date": {start.Format(time.RFC3339Nano)},
		"end_date":   {end.Format(time.RFC3339Nano)},
		"timezone":   {"Asia/Shanghai"},
	}.Encode()
	for _, path := range []string{"/usage", "/usage/stats"} {
		t.Run(path, func(t *testing.T) {
			repo := &userUsageRepoCapture{}
			router := newUserUsageRequestTypeTestRouter(repo)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path+"?"+query, nil))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			filters := repo.listFilters
			if path == "/usage/stats" {
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

func TestUserUsageDashboardPreservesExactRangeMetadata(t *testing.T) {
	start, end := "2026-11-08T07:30:45.123Z", "2026-11-09T07:30:45.123Z"
	query := url.Values{"start_date": {start}, "end_date": {end}, "include_trend": {"false"}, "include_model_stats": {"false"}}
	for _, path := range []string{"/usage/dashboard/models", "/usage/dashboard/snapshot-v2"} {
		t.Run(path, func(t *testing.T) {
			repo := &userUsageRepoCapture{}
			rec := httptest.NewRecorder()
			newUserUsageRequestTypeTestRouter(repo).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path+"?"+query.Encode(), nil))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			var result struct {
				Data struct {
					Start string `json:"start_date"`
					End   string `json:"end_date"`
				} `json:"data"`
			}
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
			require.Equal(t, start, result.Data.Start)
			require.Equal(t, end, result.Data.End)
		})
	}
}

type usageErrorRangeSettings struct{ service.SettingRepository }

func (usageErrorRangeSettings) GetMultiple(context.Context, []string) (map[string]string, error) {
	return map[string]string{service.SettingKeyAllowUserViewErrorRequests: "true"}, nil
}

type usageErrorRangeRepo struct {
	service.OpsRepository
	filter *service.OpsErrorLogFilter
}

func (r *usageErrorRangeRepo) ListErrorLogs(_ context.Context, filter *service.OpsErrorLogFilter) (*service.OpsErrorLogList, error) {
	r.filter = filter
	return &service.OpsErrorLogList{Page: 1, PageSize: 20}, nil
}

func TestUserUsageErrorsPreserveExactRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &usageErrorRangeRepo{}
	ops := service.NewOpsService(repo, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)
	handler := NewUsageHandler(nil, nil, ops, service.NewSettingService(usageErrorRangeSettings{}, nil))
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(string(middleware2.ContextKeyUser), middleware2.AuthSubject{UserID: 42})
	})
	router.GET("/usage/errors", handler.ListErrors)
	start := time.Date(2026, 11, 8, 7, 30, 45, 123000000, time.UTC)
	end := start.Add(24 * time.Hour)
	query := url.Values{"start_date": {start.Format(time.RFC3339Nano)}, "end_date": {end.Format(time.RFC3339Nano)}}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/usage/errors?"+query.Encode(), nil))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.NotNil(t, repo.filter)
	require.True(t, start.Equal(*repo.filter.StartTime))
	require.True(t, end.Equal(*repo.filter.EndTime))
	require.Equal(t, int64(42), *repo.filter.UserID)
}
