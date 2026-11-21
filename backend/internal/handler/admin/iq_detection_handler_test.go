package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type handlerIQRepoStub struct {
	cfg  service.IQDetectionConfig
	runs []service.IQDetectionRun
}

func (r *handlerIQRepoStub) GetConfig(_ context.Context) (*service.IQDetectionConfig, error) {
	c := r.cfg
	c.GroupIDs = append([]int64(nil), r.cfg.GroupIDs...)
	return &c, nil
}

func (r *handlerIQRepoStub) UpdateConfig(_ context.Context, cfg service.IQDetectionConfig, expectedVersion int64) (*service.IQDetectionConfig, error) {
	if r.cfg.Version != expectedVersion {
		return nil, service.ErrIQDetectionConfigConflict
	}
	cfg.Version = expectedVersion + 1
	cfg.UpdatedAt = time.Now().UTC()
	r.cfg = cfg
	c := r.cfg
	return &c, nil
}

func (r *handlerIQRepoStub) ClaimScheduledWindow(_ context.Context, _ time.Time) (*service.IQDetectionConfig, bool, error) {
	return nil, false, nil
}

func (r *handlerIQRepoStub) CreateRun(_ context.Context, run *service.IQDetectionRun) error {
	run.ID = int64(len(r.runs) + 1)
	r.runs = append([]service.IQDetectionRun{*run}, r.runs...)
	return nil
}

func (r *handlerIQRepoStub) GetLatestRunsByGroupIDs(_ context.Context, _ []int64) (map[int64]*service.IQDetectionRun, error) {
	out := make(map[int64]*service.IQDetectionRun)
	for i := range r.runs {
		gid := r.runs[i].GroupID
		if _, ok := out[gid]; !ok {
			cp := r.runs[i]
			out[gid] = &cp
		}
	}
	return out, nil
}

func (r *handlerIQRepoStub) GetLatestRunsByGroupAndBenchmark(_ context.Context, _ []int64) (map[int64]map[string]*service.IQDetectionRun, error) {
	out := make(map[int64]map[string]*service.IQDetectionRun)
	for i := range r.runs {
		gid := r.runs[i].GroupID
		bt := service.NormalizeIQBenchmarkType(r.runs[i].BenchmarkType)
		if out[gid] == nil {
			out[gid] = make(map[string]*service.IQDetectionRun)
		}
		if _, ok := out[gid][bt]; !ok {
			cp := r.runs[i]
			out[gid][bt] = &cp
		}
	}
	return out, nil
}

func (r *handlerIQRepoStub) ListRuns(_ context.Context, _ service.IQDetectionRunFilter) ([]service.IQDetectionRun, int64, error) {
	return r.runs, int64(len(r.runs)), nil
}

func (r *handlerIQRepoStub) PruneGroupRuns(_ context.Context, _ int64, _ int) error {
	return nil
}

type handlerIQGroupRepoStub struct {
	service.GroupRepository
	groups map[int64]*service.Group
}

func (g *handlerIQGroupRepoStub) GetByIDLite(_ context.Context, id int64) (*service.Group, error) {
	if grp, ok := g.groups[id]; ok {
		return grp, nil
	}
	return nil, errors.New("not found")
}

type handlerIQAccountRepoStub struct {
	service.AccountRepository
	accounts []service.Account
}

func (a *handlerIQAccountRepoStub) ListSchedulableByGroupIDAndPlatform(_ context.Context, _ int64, _ string) ([]service.Account, error) {
	return a.accounts, nil
}

type handlerIQProberStub struct{}

func (p *handlerIQProberStub) ProbeAccount(_ context.Context, _ *service.Account, model string, _ string, _ string) (*service.IQDetectionProbeResult, error) {
	return &service.IQDetectionProbeResult{
		Protocol:        "codex_oauth_responses",
		InputTokens:     120,
		OutputTokens:    410,
		ReasoningTokens: 380,
		ResponseModel:   model,
		AnswerText:      "答案是 21",
	}, nil
}

func setupIQDetectionTestRouter() (*gin.Engine, *handlerIQRepoStub) {
	gin.SetMode(gin.TestMode)
	repo := &handlerIQRepoStub{
		cfg:  service.DefaultIQDetectionConfig(),
		runs: []service.IQDetectionRun{},
	}
	groupRepo := &handlerIQGroupRepoStub{
		groups: map[int64]*service.Group{
			11: {ID: 11, Name: "codex-group", Platform: service.PlatformOpenAI, Status: service.StatusActive},
			22: {ID: 22, Name: "gemini-group", Platform: service.PlatformGemini, Status: service.StatusActive},
		},
	}
	accountRepo := &handlerIQAccountRepoStub{
		accounts: []service.Account{
			{ID: 1, Name: "codex-acc", Platform: service.PlatformOpenAI, Type: service.AccountTypeOAuth, Status: service.StatusActive, Schedulable: true},
		},
	}
	svc := service.NewIQDetectionService(repo, groupRepo, accountRepo, &handlerIQProberStub{})
	h := NewIQDetectionHandler(svc)

	r := gin.New()
	grp := r.Group("/api/v1/admin/iq-detection")
	grp.GET("/config", h.GetConfig)
	grp.PUT("/config", h.UpdateConfig)
	grp.GET("/overview", h.GetOverview)
	grp.GET("/runs", h.ListRuns)
	grp.POST("/run", h.RunNow)
	return r, repo
}

func TestIQDetectionHandler_ConfigOverviewRunsAndRunNow(t *testing.T) {
	router, _ := setupIQDetectionTestRouter()

	// 1. GET /config
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/config", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	// 2. POST /run without configured groups -> 400
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/admin/iq-detection/run", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// 3. PUT /config with non-openai group -> 400
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 1,
		"enabled": false,
		"interval_minutes": 720,
		"group_ids": [22],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// 3b. PUT /config with unsupported interval_minutes -> 400
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 1,
		"enabled": true,
		"interval_minutes": 45,
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// 4. PUT /config with valid openai group and 30-minute interval -> 200
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 1,
		"enabled": true,
		"interval_minutes": 30,
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"interval_minutes":30`)

	// 4b. PUT /config with 60-minute (1h) interval -> 200
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 2,
		"enabled": true,
		"interval_minutes": 60,
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"interval_minutes":60`)

	// 4c. PUT /config legacy interval_hours fallback -> 200
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 3,
		"enabled": true,
		"interval_hours": 6,
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"interval_minutes":360`)

	// 5. PUT /config with stale version -> 409
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 1,
		"enabled": false,
		"interval_minutes": 720,
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusConflict, rec.Code)

	// 6. POST /run -> 200 and creates run
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/admin/iq-detection/run", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var runResp struct {
		Data service.IQDetectionRunBatchResult `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &runResp))
	require.Equal(t, 1, runResp.Data.ExecutedGroups)
	require.Len(t, runResp.Data.Runs, 1)
	require.Equal(t, service.IQVerdictNormal, runResp.Data.Runs[0].Verdict)

	// 7. GET /overview & GET /runs
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/overview", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/runs?page=1&page_size=20&group_id=11&verdict=normal", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	// Invalid verdict query -> 400
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/runs?verdict=unknown_status", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// Invalid benchmark_type query -> 400
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/runs?benchmark_type=invalid_type", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// PUT /config with pelican_svg -> 200
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 4,
		"enabled": false,
		"interval_minutes": 720,
		"benchmark_type": "pelican_svg",
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"benchmark_type":"pelican_svg"`)

	// PUT /config with invalid benchmark_type -> 400
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 5,
		"enabled": false,
		"interval_minutes": 720,
		"benchmark_type": "unknown",
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestIQDetectionHandler_ServePelicanSandboxOverridesNonceCSP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewIQDetectionHandler(nil)

	r := gin.New()
	r.Use(middleware.SecurityHeaders(config.CSPConfig{
		Enabled: true,
		Policy:  config.DefaultCSPPolicy,
	}, nil))
	r.GET("/api/v1/iq-detection-sandbox", h.ServePelicanSandbox)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/iq-detection-sandbox", nil)
	r.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	require.Equal(t, "SAMEORIGIN", rec.Header().Get("X-Frame-Options"))
	require.Equal(t, "no-referrer", rec.Header().Get("Referrer-Policy"))
	require.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))

	csp := rec.Header().Get("Content-Security-Policy")
	require.Contains(t, csp, "sandbox allow-scripts")
	require.NotContains(t, csp, "allow-same-origin")
	require.Contains(t, csp, "default-src 'none'")
	require.Contains(t, csp, "script-src 'unsafe-inline'")
	require.Contains(t, csp, "style-src 'unsafe-inline'")
	require.Contains(t, csp, "frame-ancestors 'self'")
	require.NotContains(t, csp, "'nonce-")

	body := rec.Body.String()
	require.Contains(t, body, "iq-pelican-sandbox-ready")
	require.Contains(t, body, "iq-pelican-sandbox-render")
	require.Contains(t, body, "window.self === window.top")
}

func TestIQDetectionHandler_UserVisibleConfigRoundTrip(t *testing.T) {
	router, repo := setupIQDetectionTestRouter()

	put := func(body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(rec, req)
		return rec
	}

	// 默认关闭，GET 返回 user_visible:false
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/config", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"user_visible":false`)

	// 显式开启
	rec = put(`{"version": 1, "user_visible": true, "group_ids": [11]}`)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"user_visible":true`)
	require.True(t, repo.cfg.UserVisible)

	// 省略 user_visible → 保持当前值（true）
	rec = put(`{"version": 2, "enabled": true, "group_ids": [11]}`)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"user_visible":true`)
	require.True(t, repo.cfg.UserVisible)

	// 显式关闭
	rec = put(`{"version": 3, "user_visible": false, "group_ids": [11]}`)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"user_visible":false`)
	require.False(t, repo.cfg.UserVisible)

	// 乐观锁语义不变：过期 version → 409，且不改变 user_visible
	rec = put(`{"version": 1, "user_visible": true, "group_ids": [11]}`)
	require.Equal(t, http.StatusConflict, rec.Code)
	require.False(t, repo.cfg.UserVisible)

	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/admin/iq-detection/config", nil))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"user_visible":false`)
}
