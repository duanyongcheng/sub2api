package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/stretchr/testify/require"
)

// iqDetectionPublicFilterCaptureRepo 记录传给仓储层的 ListRuns 过滤参数，用于断言分组范围下推。
type iqDetectionPublicFilterCaptureRepo struct {
	*iqDetectionRepoMemoryStub
	lastFilter *IQDetectionRunFilter
	listCalls  int
}

func (r *iqDetectionPublicFilterCaptureRepo) ListRuns(ctx context.Context, filter IQDetectionRunFilter) ([]IQDetectionRun, int64, error) {
	r.listCalls++
	cp := filter
	r.lastFilter = &cp
	return r.iqDetectionRepoMemoryStub.ListRuns(ctx, filter)
}

// iqDetectionLeakyRepo 故意忽略分组范围，验证服务层纵深防御过滤。
type iqDetectionLeakyRepo struct {
	*iqDetectionRepoMemoryStub
}

func (r *iqDetectionLeakyRepo) ListRuns(_ context.Context, _ IQDetectionRunFilter) ([]IQDetectionRun, int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]IQDetectionRun(nil), r.runs...), int64(len(r.runs)), nil
}

func (r *iqDetectionLeakyRepo) GetLatestRunsByGroupAndBenchmark(_ context.Context, _ []int64) (map[int64]map[string]*IQDetectionRun, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make(map[int64]map[string]*IQDetectionRun)
	for i := range r.runs {
		run := r.runs[i]
		if out[run.GroupID] == nil {
			out[run.GroupID] = map[string]*IQDetectionRun{}
		}
		if _, ok := out[run.GroupID][run.BenchmarkType]; !ok {
			out[run.GroupID][run.BenchmarkType] = &run
		}
	}
	return out, nil
}

const iqPublicTestArtifactHTML = `<!DOCTYPE html><html><body><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg></body></html>`

func seedIQDetectionPublicRuns(repo *iqDetectionRepoMemoryStub) {
	base := time.Date(2026, time.November, 20, 8, 0, 0, 0, time.UTC)
	mk := func(id, gid int64, name, bt, verdict string, offset time.Duration) IQDetectionRun {
		run := IQDetectionRun{
			ID:                 id,
			GroupID:            gid,
			GroupName:          name,
			Platform:           PlatformOpenAI,
			TriggerType:        IQDetectionTriggerScheduled,
			BenchmarkType:      bt,
			RequestedModel:     "gpt-5.4",
			ReasoningEffort:    "medium",
			TestsCount:         1,
			GradedCount:        1,
			CorrectCount:       1,
			AvgScore:           92,
			Verdict:            verdict,
			AvgInputTokens:     111,
			AvgOutputTokens:    222,
			AvgReasoningTokens: 333,
			AvgLatencyMs:       4567,
			AvgTPS:             48.5,
			ResponseModel:      "secret-response-model",
			AnswerPreview:      "SECRET_ANSWER_PREVIEW",
			ErrorMessage:       "SECRET_ERROR_MESSAGE upstream 401 account leaked",
			StartedAt:          base.Add(offset),
			CompletedAt:        base.Add(offset + time.Minute),
			CreatedAt:          base.Add(offset + time.Minute),
			Samples: []IQDetectionSample{{
				RunIndex:        1,
				AccountID:       9001,
				AccountName:     "SECRET_ACCOUNT_NAME",
				AccountType:     AccountTypeOAuth,
				Protocol:        "codex_oauth_responses",
				OK:              true,
				Graded:          true,
				Score:           92,
				InputTokens:     111,
				OutputTokens:    222,
				ReasoningTokens: 333,
				ResponseModel:   "secret-response-model",
				AnswerText:      "SECRET_RAW_SAMPLE_ANSWER",
				ErrorMessage:    "SECRET_SAMPLE_ERROR",
			}},
		}
		if bt == IQBenchmarkPelicanSVG {
			run.Samples[0].ArtifactHTML = iqPublicTestArtifactHTML
			run.Samples[0].PelicanEval = &IQDetectionPelicanEval{Score: 92, HasSVG: true, HasAnimation: true, OfflineCompliant: true, Issues: []string{"SECRET_EVAL_ISSUE"}}
		}
		return run
	}
	// runs 按 created_at DESC 排列（与真实仓储一致：最新在前）
	repo.runs = []IQDetectionRun{
		mk(5, 30, "hidden-group", IQBenchmarkCandyLogic, IQVerdictNormal, 5*time.Hour),
		mk(4, 10, "visible-a", IQBenchmarkPelicanSVG, IQVerdictWarning, 4*time.Hour),
		mk(3, 20, "visible-b", IQBenchmarkCandyLogic, IQVerdictDegraded, 3*time.Hour),
		mk(2, 10, "visible-a", IQBenchmarkCandyLogic, IQVerdictNormal, 2*time.Hour),
		mk(1, 40, "not-configured", IQBenchmarkCandyLogic, IQVerdictNormal, 1*time.Hour),
	}
	repo.nextID = 6
}

func newIQDetectionPublicTestService(t *testing.T, userVisible bool) (*IQDetectionService, *iqDetectionPublicFilterCaptureRepo) {
	t.Helper()
	mem := newIQDetectionRepoMemoryStub()
	mem.cfg.UserVisible = userVisible
	mem.cfg.GroupIDs = []int64{10, 20, 30}
	mem.cfg.BenchmarkTypes = []string{IQBenchmarkCandyLogic, IQBenchmarkPelicanSVG}
	mem.cfg.BenchmarkType = IQBenchmarkCandyLogic
	seedIQDetectionPublicRuns(mem)
	repo := &iqDetectionPublicFilterCaptureRepo{iqDetectionRepoMemoryStub: mem}
	return NewIQDetectionService(repo, nil, nil, nil), repo
}

// 用户可用分组：10、20、40（40 未配置检测），不含 30
func iqPublicAllowedGroups() []Group {
	return []Group{
		{ID: 10, Name: "Visible A", Platform: PlatformOpenAI},
		{ID: 20, Name: "Visible B", Platform: PlatformOpenAI},
		{ID: 40, Name: "Not Configured", Platform: PlatformOpenAI},
	}
}

func requireIQDetectionNoHiddenFields(t *testing.T, payload any) {
	t.Helper()
	raw, err := json.Marshal(payload)
	require.NoError(t, err)
	body := string(raw)
	for _, forbidden := range []string{
		"account_id", "account_name", "account_type", "error_message",
		"avg_input_tokens", "avg_output_tokens", "avg_reasoning_tokens",
		"input_tokens", "output_tokens", "reasoning_tokens",
		"answer_preview", "answer_text", "samples", "response_model",
		"trigger_type", "updated_by", "pelican_eval", "protocol",
		"SECRET_", "secret-response-model", "9001",
	} {
		require.NotContains(t, body, forbidden, "public payload leaked %q", forbidden)
	}
}

func TestIQDetectionPublic_DisabledGuard(t *testing.T) {
	svc, repo := newIQDetectionPublicTestService(t, false)
	ctx := context.Background()

	vis, err := svc.GetUserVisibility(ctx)
	require.NoError(t, err)
	require.False(t, vis.Enabled)

	_, err = svc.GetPublicOverview(ctx, iqPublicAllowedGroups())
	require.ErrorIs(t, err, ErrIQDetectionNotPublic)
	require.Equal(t, 403, infraerrors.Code(err))
	require.Equal(t, "IQ_DETECTION_NOT_PUBLIC", infraerrors.Reason(err))

	_, _, err = svc.ListPublicRuns(ctx, iqPublicAllowedGroups(), IQDetectionRunFilter{})
	require.ErrorIs(t, err, ErrIQDetectionNotPublic)
	require.Zero(t, repo.listCalls, "disabled guard must short-circuit before querying runs")
}

func TestIQDetectionPublic_OverviewScopesGroupsAndHidesInternalFields(t *testing.T) {
	svc, _ := newIQDetectionPublicTestService(t, true)
	ctx := context.Background()

	vis, err := svc.GetUserVisibility(ctx)
	require.NoError(t, err)
	require.True(t, vis.Enabled)

	overview, err := svc.GetPublicOverview(ctx, iqPublicAllowedGroups())
	require.NoError(t, err)
	require.Equal(t, []string{IQBenchmarkCandyLogic, IQBenchmarkPelicanSVG}, overview.BenchmarkTypes)
	require.Equal(t, IQDetectionDefaultIntervalMinutes, overview.IntervalMinutes)

	// 只包含「已配置 ∩ 可用」= 10、20（30 不可用，40 未配置），保持配置顺序
	require.Len(t, overview.Groups, 2)
	require.Equal(t, int64(10), overview.Groups[0].GroupID)
	require.Equal(t, "Visible A", overview.Groups[0].GroupName)
	require.Equal(t, int64(20), overview.Groups[1].GroupID)

	// 10：candy normal + pelican warning → 最差 warning
	g10 := overview.Groups[0]
	require.NotNil(t, g10.Health)
	require.Equal(t, IQVerdictWarning, *g10.Health)
	require.Len(t, g10.LatestRunsByBenchmark, 2)
	pelican := g10.LatestRunsByBenchmark[IQBenchmarkPelicanSVG]
	require.NotNil(t, pelican)
	require.Len(t, pelican.Artifacts, 1)
	require.Equal(t, iqPublicTestArtifactHTML, pelican.Artifacts[0].HTML)
	require.Equal(t, float64(92), pelican.Artifacts[0].Score)
	require.True(t, pelican.Artifacts[0].OfflineCompliant)
	candy := g10.LatestRunsByBenchmark[IQBenchmarkCandyLogic]
	require.NotNil(t, candy)
	require.NotNil(t, candy.Artifacts)
	require.Empty(t, candy.Artifacts)

	require.NotNil(t, overview.Groups[1].Health)
	require.Equal(t, IQVerdictDegraded, *overview.Groups[1].Health)

	requireIQDetectionNoHiddenFields(t, overview)
	raw, err := json.Marshal(overview)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "hidden-group")
	require.NotContains(t, string(raw), "not-configured")
}

func TestIQDetectionPublic_OverviewUntestedGroupHasNullHealth(t *testing.T) {
	svc, repo := newIQDetectionPublicTestService(t, true)
	repo.runs = nil

	overview, err := svc.GetPublicOverview(context.Background(), iqPublicAllowedGroups())
	require.NoError(t, err)
	require.Len(t, overview.Groups, 2)
	require.Nil(t, overview.Groups[0].Health)
	require.NotNil(t, overview.Groups[0].LatestRunsByBenchmark)
	require.Empty(t, overview.Groups[0].LatestRunsByBenchmark)

	raw, err := json.Marshal(overview.Groups[0])
	require.NoError(t, err)
	require.Contains(t, string(raw), `"health":null`)
	require.Contains(t, string(raw), `"latest_runs_by_benchmark":{}`)
}

func TestIQDetectionPublic_ListRunsScopesToVisibleGroups(t *testing.T) {
	svc, repo := newIQDetectionPublicTestService(t, true)
	ctx := context.Background()

	items, total, err := svc.ListPublicRuns(ctx, iqPublicAllowedGroups(), IQDetectionRunFilter{Page: 1, PageSize: 20, Verdict: IQVerdictNormal})
	require.NoError(t, err)
	require.NotNil(t, repo.lastFilter)
	require.ElementsMatch(t, []int64{10, 20}, repo.lastFilter.GroupIDs, "visible group scope must be pushed down to the repository")
	require.Empty(t, repo.lastFilter.Verdict, "verdict filter is not exposed to users")
	require.Equal(t, int64(3), total)
	require.Len(t, items, 3)
	for _, item := range items {
		require.Contains(t, []int64{10, 20}, item.GroupID)
	}
	requireIQDetectionNoHiddenFields(t, items)

	// 指定可见分组 + 题型
	items, total, err = svc.ListPublicRuns(ctx, iqPublicAllowedGroups(), IQDetectionRunFilter{GroupID: 10, BenchmarkType: IQBenchmarkPelicanSVG})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, IQBenchmarkPelicanSVG, items[0].BenchmarkType)
	require.Len(t, items[0].Artifacts, 1)

	// 已配置但用户不可用的分组 → 403，绝不返回数据
	calls := repo.listCalls
	_, _, err = svc.ListPublicRuns(ctx, iqPublicAllowedGroups(), IQDetectionRunFilter{GroupID: 30})
	require.ErrorIs(t, err, ErrIQDetectionGroupNotVisible)
	require.Equal(t, 403, infraerrors.Code(err))
	// 用户可用但未配置检测的分组 → 403
	_, _, err = svc.ListPublicRuns(ctx, iqPublicAllowedGroups(), IQDetectionRunFilter{GroupID: 40})
	require.ErrorIs(t, err, ErrIQDetectionGroupNotVisible)
	require.Equal(t, calls, repo.listCalls)

	// 非法题型 → 400 语义
	_, _, err = svc.ListPublicRuns(ctx, iqPublicAllowedGroups(), IQDetectionRunFilter{BenchmarkType: "bogus"})
	require.True(t, errors.Is(err, ErrIQDetectionInvalidConfig))

	// 用户无任何可见分组 → 空列表且不查询仓储
	calls = repo.listCalls
	items, total, err = svc.ListPublicRuns(ctx, []Group{{ID: 99}}, IQDetectionRunFilter{})
	require.NoError(t, err)
	require.Zero(t, total)
	require.NotNil(t, items)
	require.Empty(t, items)
	require.Equal(t, calls, repo.listCalls)
}

func TestIQDetectionPublic_DefenseInDepthAgainstLeakyRepository(t *testing.T) {
	mem := newIQDetectionRepoMemoryStub()
	mem.cfg.UserVisible = true
	mem.cfg.GroupIDs = []int64{10, 20, 30}
	seedIQDetectionPublicRuns(mem)
	svc := NewIQDetectionService(&iqDetectionLeakyRepo{iqDetectionRepoMemoryStub: mem}, nil, nil, nil)

	items, _, err := svc.ListPublicRuns(context.Background(), iqPublicAllowedGroups(), IQDetectionRunFilter{})
	require.NoError(t, err)
	for _, item := range items {
		require.Contains(t, []int64{10, 20}, item.GroupID)
	}

	overview, err := svc.GetPublicOverview(context.Background(), iqPublicAllowedGroups())
	require.NoError(t, err)
	require.Len(t, overview.Groups, 2)
	for _, g := range overview.Groups {
		for _, run := range g.LatestRunsByBenchmark {
			require.Equal(t, g.GroupID, run.GroupID)
		}
	}
}

func TestIQDetectionPublic_RunDTOAllowList(t *testing.T) {
	raw, err := json.Marshal(IQDetectionPublicRun{Artifacts: []IQDetectionPublicArtifact{{}}})
	require.NoError(t, err)
	var fields map[string]any
	require.NoError(t, json.Unmarshal(raw, &fields))
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	require.ElementsMatch(t, []string{
		"id", "group_id", "group_name", "benchmark_type", "requested_model", "reasoning_effort",
		"tests_count", "graded_count", "correct_count", "avg_score", "verdict",
		"avg_latency_ms", "avg_tps", "started_at", "completed_at", "artifacts",
	}, keys)

	artifacts := fields["artifacts"].([]any)
	artifactFields := artifacts[0].(map[string]any)
	artifactKeys := make([]string, 0, len(artifactFields))
	for k := range artifactFields {
		artifactKeys = append(artifactKeys, k)
	}
	require.ElementsMatch(t, []string{"html", "score", "offline_compliant"}, artifactKeys)
}

func TestIQDetectionPublic_UserVisibleConfigRoundTrip(t *testing.T) {
	repo := newIQDetectionRepoMemoryStub()
	svc := NewIQDetectionService(repo, nil, nil, nil)
	ctx := context.Background()

	cfg, err := svc.GetConfig(ctx)
	require.NoError(t, err)
	require.False(t, cfg.UserVisible, "user_visible must default to false")

	input := *cfg
	input.UserVisible = true
	updated, err := svc.UpdateConfig(ctx, input, cfg.Version, 1)
	require.NoError(t, err)
	require.True(t, updated.UserVisible)

	reloaded, err := svc.GetConfig(ctx)
	require.NoError(t, err)
	require.True(t, reloaded.UserVisible)
	vis, err := svc.GetUserVisibility(ctx)
	require.NoError(t, err)
	require.True(t, vis.Enabled)

	raw, err := json.Marshal(reloaded)
	require.NoError(t, err)
	require.Contains(t, string(raw), `"user_visible":true`)
}
