package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type iqUserRepoStub struct {
	cfg        service.IQDetectionConfig
	runs       []service.IQDetectionRun
	listCalls  int
	lastFilter service.IQDetectionRunFilter
}

func (r *iqUserRepoStub) GetConfig(_ context.Context) (*service.IQDetectionConfig, error) {
	c := r.cfg
	c.GroupIDs = append([]int64(nil), r.cfg.GroupIDs...)
	return &c, nil
}

func (r *iqUserRepoStub) UpdateConfig(_ context.Context, _ service.IQDetectionConfig, _ int64) (*service.IQDetectionConfig, error) {
	panic("user handler must never update iq detection config")
}

func (r *iqUserRepoStub) ClaimScheduledWindow(_ context.Context, _ time.Time) (*service.IQDetectionConfig, bool, error) {
	return nil, false, nil
}

func (r *iqUserRepoStub) CreateRun(_ context.Context, _ *service.IQDetectionRun) error {
	panic("user handler must never create iq detection runs")
}

func (r *iqUserRepoStub) GetLatestRunsByGroupIDs(_ context.Context, _ []int64) (map[int64]*service.IQDetectionRun, error) {
	return map[int64]*service.IQDetectionRun{}, nil
}

func (r *iqUserRepoStub) GetLatestRunsByGroupAndBenchmark(_ context.Context, groupIDs []int64) (map[int64]map[string]*service.IQDetectionRun, error) {
	wanted := map[int64]bool{}
	for _, id := range groupIDs {
		wanted[id] = true
	}
	out := map[int64]map[string]*service.IQDetectionRun{}
	for i := range r.runs {
		run := r.runs[i]
		if !wanted[run.GroupID] {
			continue
		}
		if out[run.GroupID] == nil {
			out[run.GroupID] = map[string]*service.IQDetectionRun{}
		}
		if _, ok := out[run.GroupID][run.BenchmarkType]; !ok {
			out[run.GroupID][run.BenchmarkType] = &run
		}
	}
	return out, nil
}

func (r *iqUserRepoStub) ListRuns(_ context.Context, filter service.IQDetectionRunFilter) ([]service.IQDetectionRun, int64, error) {
	r.listCalls++
	r.lastFilter = filter
	scope := map[int64]bool{}
	for _, id := range filter.GroupIDs {
		scope[id] = true
	}
	out := []service.IQDetectionRun{}
	for _, run := range r.runs {
		if filter.GroupIDs != nil && !scope[run.GroupID] {
			continue
		}
		if filter.GroupID > 0 && run.GroupID != filter.GroupID {
			continue
		}
		if filter.BenchmarkType != "" && run.BenchmarkType != filter.BenchmarkType {
			continue
		}
		out = append(out, run)
	}
	return out, int64(len(out)), nil
}

func (r *iqUserRepoStub) PruneGroupRuns(_ context.Context, _ int64, _ int) error { return nil }

type iqUserGroupAuthorizerStub struct {
	groups []service.Group
	calls  []int64
}

func (s *iqUserGroupAuthorizerStub) GetAvailableGroups(_ context.Context, userID int64) ([]service.Group, error) {
	s.calls = append(s.calls, userID)
	return s.groups, nil
}

func newIQUserTestRouter(t *testing.T, userVisible bool) (*gin.Engine, *iqUserRepoStub, *iqUserGroupAuthorizerStub) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := service.DefaultIQDetectionConfig()
	cfg.UserVisible = userVisible
	cfg.GroupIDs = []int64{10, 30}
	cfg.BenchmarkTypes = []string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG}
	now := time.Date(2026, time.November, 20, 8, 0, 0, 0, time.UTC)
	mk := func(id, gid int64, bt string) service.IQDetectionRun {
		run := service.IQDetectionRun{
			ID: id, GroupID: gid, GroupName: "g", Platform: service.PlatformOpenAI,
			TriggerType: service.IQDetectionTriggerManual, BenchmarkType: bt,
			RequestedModel: "gpt-5.4", ReasoningEffort: "medium",
			TestsCount: 1, GradedCount: 1, CorrectCount: 1, AvgScore: 100, Verdict: service.IQVerdictNormal,
			AvgInputTokens: 11, AvgOutputTokens: 22, AvgReasoningTokens: 33,
			ResponseModel: "leak-model", AnswerPreview: "LEAK_PREVIEW", ErrorMessage: "LEAK_ERROR",
			StartedAt: now, CompletedAt: now, CreatedAt: now,
			Samples: []service.IQDetectionSample{{AccountID: 777, AccountName: "LEAK_ACCOUNT", AnswerText: "LEAK_ANSWER", ErrorMessage: "LEAK_SAMPLE_ERROR"}},
		}
		if bt == service.IQBenchmarkPelicanSVG {
			run.Samples[0].ArtifactHTML = "<svg></svg>"
			run.Samples[0].Score = 88
			run.Samples[0].PelicanEval = &service.IQDetectionPelicanEval{Score: 88, OfflineCompliant: true}
		}
		return run
	}
	repo := &iqUserRepoStub{cfg: cfg, runs: []service.IQDetectionRun{
		mk(3, 30, service.IQBenchmarkCandyLogic),
		mk(2, 10, service.IQBenchmarkPelicanSVG),
		mk(1, 10, service.IQBenchmarkCandyLogic),
	}}
	authorizer := &iqUserGroupAuthorizerStub{groups: []service.Group{{ID: 10, Name: "Visible", Platform: service.PlatformOpenAI}, {ID: 20, Name: "Other", Platform: service.PlatformOpenAI}}}
	h := &IQDetectionUserHandler{svc: service.NewIQDetectionService(repo, nil, nil, nil), apiKeyService: authorizer}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 42})
		c.Set(string(middleware.ContextKeyUserRole), service.RoleUser)
		c.Next()
	})
	grp := r.Group("/api/v1/iq-detection")
	grp.GET("/visibility", h.GetVisibility)
	grp.GET("/overview", h.GetOverview)
	grp.GET("/runs", h.ListRuns)
	return r, repo, authorizer
}

func doIQUserRequest(r *gin.Engine, path string) (*httptest.ResponseRecorder, map[string]any) {
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec, body
}

func TestIQDetectionUserHandler_DisabledGuard(t *testing.T) {
	r, repo, authorizer := newIQUserTestRouter(t, false)

	rec, body := doIQUserRequest(r, "/api/v1/iq-detection/visibility")
	require.Equal(t, http.StatusOK, rec.Code)
	data, ok := body["data"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, false, data["enabled"])

	for _, path := range []string{"/api/v1/iq-detection/overview", "/api/v1/iq-detection/runs", "/api/v1/iq-detection/runs?group_id=10"} {
		rec, body = doIQUserRequest(r, path)
		require.Equal(t, http.StatusForbidden, rec.Code, path)
		require.Equal(t, "IQ_DETECTION_NOT_PUBLIC", body["reason"], path)
		require.EqualValues(t, http.StatusForbidden, body["code"], path)
		require.Nil(t, body["data"], path)
	}
	require.Zero(t, repo.listCalls)
	require.Empty(t, authorizer.calls, "disabled guard must reject before resolving user groups")
}

func TestIQDetectionUserHandler_EnabledScopesAndHidesFields(t *testing.T) {
	r, repo, authorizer := newIQUserTestRouter(t, true)

	rec, body := doIQUserRequest(r, "/api/v1/iq-detection/visibility")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, true, body["data"].(map[string]any)["enabled"])

	rec, body = doIQUserRequest(r, "/api/v1/iq-detection/overview")
	require.Equal(t, http.StatusOK, rec.Code)
	data := body["data"].(map[string]any)
	groups := data["groups"].([]any)
	require.Len(t, groups, 1, "only configured ∩ available groups are visible")
	g := groups[0].(map[string]any)
	require.EqualValues(t, 10, g["group_id"])
	require.Equal(t, "Visible", g["group_name"])
	require.Equal(t, service.IQVerdictNormal, g["health"])
	latest := g["latest_runs_by_benchmark"].(map[string]any)
	pelican := latest[service.IQBenchmarkPelicanSVG].(map[string]any)
	artifacts := pelican["artifacts"].([]any)
	require.Len(t, artifacts, 1)
	require.Equal(t, "<svg></svg>", artifacts[0].(map[string]any)["html"])
	require.EqualValues(t, 88, artifacts[0].(map[string]any)["score"])
	require.Equal(t, true, artifacts[0].(map[string]any)["offline_compliant"])
	assertIQUserBodyHasNoHiddenFields(t, rec.Body.String())

	rec, body = doIQUserRequest(r, "/api/v1/iq-detection/runs?page=1&page_size=500")
	require.Equal(t, http.StatusOK, rec.Code)
	data = body["data"].(map[string]any)
	require.EqualValues(t, 2, data["total"])
	require.EqualValues(t, 100, data["page_size"], "page_size is capped at 100")
	for _, item := range data["items"].([]any) {
		require.EqualValues(t, 10, item.(map[string]any)["group_id"])
	}
	require.Equal(t, []int64{10}, repo.lastFilter.GroupIDs)
	assertIQUserBodyHasNoHiddenFields(t, rec.Body.String())

	// 已配置但用户不可用的分组 30 → 403，不泄露数据
	rec, body = doIQUserRequest(r, "/api/v1/iq-detection/runs?group_id=30")
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Equal(t, "IQ_DETECTION_GROUP_NOT_VISIBLE", body["reason"])
	require.Nil(t, body["data"])

	rec, _ = doIQUserRequest(r, "/api/v1/iq-detection/runs?group_id=abc")
	require.Equal(t, http.StatusBadRequest, rec.Code)
	rec, _ = doIQUserRequest(r, "/api/v1/iq-detection/runs?benchmark_type=bogus")
	require.Equal(t, http.StatusBadRequest, rec.Code)

	require.NotEmpty(t, authorizer.calls)
	for _, uid := range authorizer.calls {
		require.Equal(t, int64(42), uid)
	}
}

func TestIQDetectionUserHandler_RequiresAuthenticatedSubject(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := service.DefaultIQDetectionConfig()
	cfg.UserVisible = true
	repo := &iqUserRepoStub{cfg: cfg}
	h := &IQDetectionUserHandler{svc: service.NewIQDetectionService(repo, nil, nil, nil), apiKeyService: &iqUserGroupAuthorizerStub{}}
	r := gin.New()
	r.GET("/overview", h.GetOverview)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/overview", nil))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func assertIQUserBodyHasNoHiddenFields(t *testing.T, body string) {
	t.Helper()
	for _, forbidden := range []string{
		"account_id", "account_name", "error_message", "input_tokens", "output_tokens", "reasoning_tokens",
		"answer_preview", "answer_text", "samples", "response_model", "trigger_type", "updated_by",
		"LEAK_", "leak-model", "777",
	} {
		require.False(t, strings.Contains(body, forbidden), "response leaked %q: %s", forbidden, body)
	}
}
