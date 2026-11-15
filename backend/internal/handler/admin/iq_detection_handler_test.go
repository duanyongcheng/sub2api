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
		"interval_hours": 12,
		"group_ids": [22],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)

	// 4. PUT /config with valid openai group -> 200
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 1,
		"enabled": true,
		"interval_hours": 12,
		"group_ids": [11],
		"model": "gpt-5.4",
		"reasoning_effort": "medium",
		"tests_per_group": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	// 5. PUT /config with stale version -> 409
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/api/v1/admin/iq-detection/config", bytes.NewBufferString(`{
		"version": 1,
		"enabled": false,
		"interval_hours": 12,
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
}
