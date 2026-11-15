package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type iqDetectionRepoMemoryStub struct {
	mu      sync.Mutex
	cfg     IQDetectionConfig
	runs    []IQDetectionRun
	nextID  int64
	claimed bool
}

func newIQDetectionRepoMemoryStub() *iqDetectionRepoMemoryStub {
	cfg := DefaultIQDetectionConfig()
	cfg.UpdatedAt = time.Now().UTC()
	return &iqDetectionRepoMemoryStub{
		cfg:    cfg,
		runs:   []IQDetectionRun{},
		nextID: 1,
	}
}

func (r *iqDetectionRepoMemoryStub) GetConfig(_ context.Context) (*IQDetectionConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	copied := r.cfg
	copied.GroupIDs = append([]int64(nil), r.cfg.GroupIDs...)
	return &copied, nil
}

func (r *iqDetectionRepoMemoryStub) UpdateConfig(_ context.Context, cfg IQDetectionConfig, expectedVersion int64) (*IQDetectionConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cfg.Version != expectedVersion {
		return nil, ErrIQDetectionConfigConflict
	}
	cfg.Version = expectedVersion + 1
	cfg.UpdatedAt = time.Now().UTC()
	cfg.GroupIDs = append([]int64(nil), cfg.GroupIDs...)
	r.cfg = cfg
	copied := r.cfg
	copied.GroupIDs = append([]int64(nil), r.cfg.GroupIDs...)
	return &copied, nil
}

func (r *iqDetectionRepoMemoryStub) ClaimScheduledWindow(_ context.Context, now time.Time) (*IQDetectionConfig, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.cfg.Enabled || r.claimed {
		return nil, false, nil
	}
	r.claimed = true
	r.cfg.LastScheduledAt = &now
	copied := r.cfg
	copied.GroupIDs = append([]int64(nil), r.cfg.GroupIDs...)
	return &copied, true, nil
}

func (r *iqDetectionRepoMemoryStub) CreateRun(_ context.Context, run *IQDetectionRun) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	run.ID = r.nextID
	r.nextID++
	copied := *run
	copied.Samples = append([]IQDetectionSample(nil), run.Samples...)
	r.runs = append([]IQDetectionRun{copied}, r.runs...)
	return nil
}

func (r *iqDetectionRepoMemoryStub) GetLatestRunsByGroupIDs(_ context.Context, groupIDs []int64) (map[int64]*IQDetectionRun, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	wanted := make(map[int64]struct{}, len(groupIDs))
	for _, gid := range groupIDs {
		wanted[gid] = struct{}{}
	}
	out := make(map[int64]*IQDetectionRun)
	for i := range r.runs {
		gid := r.runs[i].GroupID
		if _, ok := wanted[gid]; !ok {
			continue
		}
		if _, exists := out[gid]; !exists {
			copied := r.runs[i]
			out[gid] = &copied
		}
	}
	return out, nil
}

func (r *iqDetectionRepoMemoryStub) ListRuns(_ context.Context, filter IQDetectionRunFilter) ([]IQDetectionRun, int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	filtered := make([]IQDetectionRun, 0, len(r.runs))
	for _, run := range r.runs {
		if filter.GroupID > 0 && run.GroupID != filter.GroupID {
			continue
		}
		if filter.Verdict != "" && run.Verdict != filter.Verdict {
			continue
		}
		filtered = append(filtered, run)
	}
	return filtered, int64(len(filtered)), nil
}

func (r *iqDetectionRepoMemoryStub) PruneGroupRuns(_ context.Context, _ int64, _ int) error {
	return nil
}

type iqDetectionGroupRepoStub struct {
	GroupRepository
	groups map[int64]*Group
}

func (g *iqDetectionGroupRepoStub) GetByIDLite(_ context.Context, id int64) (*Group, error) {
	if grp, ok := g.groups[id]; ok {
		return grp, nil
	}
	return nil, errors.New("group not found")
}

type iqDetectionAccountRepoStub struct {
	AccountRepository
	byGroup map[int64][]Account
}

func (a *iqDetectionAccountRepoStub) ListSchedulableByGroupIDAndPlatform(_ context.Context, groupID int64, platform string) ([]Account, error) {
	list := a.byGroup[groupID]
	out := make([]Account, 0, len(list))
	for _, acc := range list {
		if acc.Platform == platform {
			out = append(out, acc)
		}
	}
	return out, nil
}

type iqDetectionProberStub struct {
	fn func(ctx context.Context, account *Account, model string, effort string, prompt string) (*IQDetectionProbeResult, error)
}

func (p *iqDetectionProberStub) ProbeAccount(ctx context.Context, account *Account, model string, effort string, prompt string) (*IQDetectionProbeResult, error) {
	return p.fn(ctx, account, model, effort, prompt)
}

func TestIQDetection_MatchStandaloneNumber(t *testing.T) {
	require.True(t, MatchStandaloneNumber("21", "21"))
	require.True(t, MatchStandaloneNumber("最少需要取出 21 个糖果。", "21"))
	require.True(t, MatchStandaloneNumber("答案：21。", "21"))
	require.True(t, MatchStandaloneNumber("**21**", "21"))
	require.False(t, MatchStandaloneNumber("210", "21"))
	require.False(t, MatchStandaloneNumber("121", "21"))
	require.False(t, MatchStandaloneNumber("总共 2021 个", "21"))
	require.True(t, MatchStandaloneNumber("总糖果 41 个，答案是 21！", "21"))
}

func TestIQDetection_EvaluateVerdict(t *testing.T) {
	require.Equal(t, IQVerdictError, EvaluateIQDetectionVerdict(0, 0))
	require.Equal(t, IQVerdictNormal, EvaluateIQDetectionVerdict(1, 1))
	require.Equal(t, IQVerdictDegraded, EvaluateIQDetectionVerdict(1, 0))

	require.Equal(t, IQVerdictNormal, EvaluateIQDetectionVerdict(3, 3))
	require.Equal(t, IQVerdictWarning, EvaluateIQDetectionVerdict(3, 2))
	require.Equal(t, IQVerdictWarning, EvaluateIQDetectionVerdict(2, 1))
	require.Equal(t, IQVerdictDegraded, EvaluateIQDetectionVerdict(3, 1))
	require.Equal(t, IQVerdictDegraded, EvaluateIQDetectionVerdict(3, 0))
}

func TestIQDetection_CodexOAuthPayloadAndStreamParsers(t *testing.T) {
	payload := buildCodexOAuthIQProbePayload("gpt-5.4", "high", IQDetectionCandyPrompt)
	require.Equal(t, "gpt-5.4", payload["model"])
	require.Equal(t, false, payload["store"])
	require.Equal(t, true, payload["stream"])
	require.NotEmpty(t, payload["instructions"])
	require.NotContains(t, payload, "temperature")
	require.NotContains(t, payload, "top_p")
	require.NotContains(t, payload, "max_output_tokens")

	responsesSSE := strings.Join([]string{
		`event: response.created`,
		`data: {"type":"response.created","response":{"model":"gpt-5.4-2026"}}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","delta":"最少需要取出 "}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","delta":"21 个糖果。"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"model":"gpt-5.4-2026","usage":{"input_tokens":188,"output_tokens":1060,"output_tokens_details":{"reasoning_tokens":1034}}}}`,
		`data: [DONE]`,
	}, "\n")

	parsedResp, err := parseResponsesIQStream(strings.NewReader(responsesSSE), "gpt-5.4")
	require.NoError(t, err)
	require.Equal(t, "gpt-5.4-2026", parsedResp.ResponseModel)
	require.Equal(t, 188, parsedResp.InputTokens)
	require.Equal(t, 1060, parsedResp.OutputTokens)
	require.Equal(t, 1034, parsedResp.ReasoningTokens)
	require.Equal(t, "最少需要取出 21 个糖果。", parsedResp.AnswerText)

	chatSSE := strings.Join([]string{
		`data: {"model":"gpt-5.4","choices":[{"delta":{"content":"答案："}}]}`,
		`data: {"model":"gpt-5.4","choices":[{"delta":{"content":"21"}}],"usage":{"prompt_tokens":150,"completion_tokens":620,"completion_tokens_details":{"reasoning_tokens":580}}}`,
		`data: [DONE]`,
	}, "\n")

	parsedChat, err := parseChatCompletionsIQStream(strings.NewReader(chatSSE), "gpt-5.4")
	require.NoError(t, err)
	require.Equal(t, "gpt-5.4", parsedChat.ResponseModel)
	require.Equal(t, 150, parsedChat.InputTokens)
	require.Equal(t, 620, parsedChat.OutputTokens)
	require.Equal(t, 580, parsedChat.ReasoningTokens)
	require.Equal(t, "答案：21", parsedChat.AnswerText)
}

func TestIQDetection_ServiceConfigValidationAndGroupSampling(t *testing.T) {
	ctx := context.Background()
	repo := newIQDetectionRepoMemoryStub()
	groupRepo := &iqDetectionGroupRepoStub{
		groups: map[int64]*Group{
			10: {ID: 10, Name: "codex-pro", Platform: PlatformOpenAI, Status: StatusActive, RequireOAuthOnly: true},
			20: {ID: 20, Name: "claude-team", Platform: PlatformAnthropic, Status: StatusActive},
		},
	}
	accountRepo := &iqDetectionAccountRepoStub{
		byGroup: map[int64][]Account{
			10: {
				{
					ID:          101,
					Name:        "oauth-acc-1",
					Platform:    PlatformOpenAI,
					Type:        AccountTypeOAuth,
					Status:      StatusActive,
					Schedulable: true,
					Priority:    1,
				},
				{
					ID:          102,
					Name:        "oauth-acc-2",
					Platform:    PlatformOpenAI,
					Type:        AccountTypeOAuth,
					Status:      StatusActive,
					Schedulable: true,
					Priority:    2,
				},
				{
					ID:          103,
					Name:        "apikey-filtered-out",
					Platform:    PlatformOpenAI,
					Type:        AccountTypeAPIKey,
					Status:      StatusActive,
					Schedulable: true,
					Priority:    1,
				},
			},
		},
	}

	var probedAccountIDs []int64
	prober := &iqDetectionProberStub{
		fn: func(_ context.Context, account *Account, model string, effort string, _ string) (*IQDetectionProbeResult, error) {
			probedAccountIDs = append(probedAccountIDs, account.ID)
			if account.ID == 102 {
				return nil, errors.New("upstream 502 bad gateway")
			}
			return &IQDetectionProbeResult{
				Protocol:        "codex_oauth_responses",
				InputTokens:     180,
				OutputTokens:    920,
				ReasoningTokens: 860,
				ResponseModel:   model + "-2026",
				AnswerText:      "最终答案是 21（effort=" + effort + "）",
			}, nil
		},
	}

	svc := NewIQDetectionService(repo, groupRepo, accountRepo, prober)

	// 0. 巡检间隔周期校验：支持 30 分钟、1 小时、6 小时、12 小时、24 小时，默认 720 分钟（12h）
	defNorm, err := NormalizeAndValidateIQDetectionConfig(IQDetectionConfig{})
	require.NoError(t, err)
	require.Equal(t, 720, defNorm.IntervalMinutes)

	for _, allowed := range []int{30, 60, 360, 720, 1440} {
		norm, normErr := NormalizeAndValidateIQDetectionConfig(IQDetectionConfig{
			IntervalMinutes: allowed,
		})
		require.NoError(t, normErr, "expected interval_minutes=%d to be valid", allowed)
		require.Equal(t, allowed, norm.IntervalMinutes)
	}

	for _, invalid := range []int{-1, 15, 45, 120, 180} {
		_, normErr := NormalizeAndValidateIQDetectionConfig(IQDetectionConfig{
			IntervalMinutes: invalid,
		})
		require.ErrorIs(t, normErr, ErrIQDetectionInvalidConfig, "expected interval_minutes=%d to be rejected", invalid)
	}

	// 1. 拒绝非 openai 平台分组
	_, err = svc.UpdateConfig(ctx, IQDetectionConfig{
		Version:         1,
		Enabled:         false,
		IntervalMinutes: 720,
		GroupIDs:        []int64{20},
		Model:           "gpt-5.4",
		ReasoningEffort: "medium",
		TestsPerGroup:   1,
	}, 1, 99)
	require.ErrorIs(t, err, ErrIQDetectionInvalidConfig)

	// 2. 保存合法 openai 分组配置（30 分钟巡检周期）+ 乐观锁递增
	saved, err := svc.UpdateConfig(ctx, IQDetectionConfig{
		Version:         1,
		Enabled:         true,
		IntervalMinutes: 30,
		GroupIDs:        []int64{10, 10},
		Model:           "gpt-5.4",
		ReasoningEffort: "high",
		TestsPerGroup:   2,
	}, 1, 99)
	require.NoError(t, err)
	require.Equal(t, int64(2), saved.Version)
	require.Equal(t, 30, saved.IntervalMinutes)
	require.Equal(t, []int64{10}, saved.GroupIDs)

	// 旧版本号再次提交应触发 409 冲突错误
	_, err = svc.UpdateConfig(ctx, *saved, 1, 99)
	require.ErrorIs(t, err, ErrIQDetectionConfigConflict)

	// 3. 执行抽检：验证 RequireOAuthOnly 过滤掉 APIKey 账号，按优先级采样 2 轮，且单轮报错不污染账号状态
	batchRes, err := svc.RunNow(ctx, IQDetectionRunNowInput{})
	require.NoError(t, err)
	require.Equal(t, 1, batchRes.ExecutedGroups)
	require.Equal(t, []int64{101, 102}, probedAccountIDs)
	require.Len(t, batchRes.Runs, 1)
	require.Equal(t, IQVerdictNormal, batchRes.Runs[0].Verdict)
	require.Equal(t, 1, batchRes.Runs[0].GradedCount)
	require.Equal(t, 1, batchRes.Runs[0].CorrectCount)
	require.Contains(t, batchRes.Runs[0].ErrorMessage, "部分样本请求异常")

	// 验证池内原账号状态与可调度标记完全未被修改
	for _, acc := range accountRepo.byGroup[10] {
		require.Equal(t, StatusActive, acc.Status)
		require.True(t, acc.Schedulable)
	}

	// 4. Overview 汇总验证
	overview, err := svc.GetOverview(ctx)
	require.NoError(t, err)
	require.Equal(t, 1, overview.Summary.ConfiguredCount)
	require.Equal(t, 1, overview.Summary.NormalCount)
	require.Len(t, overview.Groups, 1)
	require.Equal(t, 2, overview.Groups[0].SchedulableAccountCount)
}

func TestIQDetection_InFlightGroupDeduplication(t *testing.T) {
	ctx := context.Background()
	repo := newIQDetectionRepoMemoryStub()
	repo.cfg.GroupIDs = []int64{10}

	groupRepo := &iqDetectionGroupRepoStub{
		groups: map[int64]*Group{
			10: {ID: 10, Name: "codex-main", Platform: PlatformOpenAI, Status: StatusActive},
		},
	}
	accountRepo := &iqDetectionAccountRepoStub{
		byGroup: map[int64][]Account{
			10: {{ID: 1, Name: "acc-1", Platform: PlatformOpenAI, Type: AccountTypeOAuth, Status: StatusActive, Schedulable: true}},
		},
	}

	started := make(chan struct{})
	release := make(chan struct{})
	prober := &iqDetectionProberStub{
		fn: func(_ context.Context, _ *Account, _ string, _ string, _ string) (*IQDetectionProbeResult, error) {
			close(started)
			<-release
			return &IQDetectionProbeResult{
				Protocol:        "codex_oauth_responses",
				InputTokens:     100,
				OutputTokens:    300,
				ReasoningTokens: 516,
				ResponseModel:   "gpt-5.4",
				AnswerText:      "21",
			}, nil
		},
	}

	svc := NewIQDetectionService(repo, groupRepo, accountRepo, prober)

	doneFirst := make(chan *IQDetectionRunBatchResult, 1)
	go func() {
		res, _ := svc.RunNow(ctx, IQDetectionRunNowInput{GroupIDs: []int64{10}})
		doneFirst <- res
	}()

	<-started
	secondRes, err := svc.RunNow(ctx, IQDetectionRunNowInput{GroupIDs: []int64{10}})
	require.NoError(t, err)
	require.Equal(t, 0, secondRes.ExecutedGroups)
	require.Equal(t, []int64{10}, secondRes.SkippedInFlightGroups)

	close(release)
	firstRes := <-doneFirst
	require.Equal(t, 1, firstRes.ExecutedGroups)
	// 即使 reasoning_tokens 为 516（或 0），只要答案答对 21 即判定为 normal，仅保留 reasoning_tokens 遥测数值
	require.Equal(t, IQVerdictNormal, firstRes.Runs[0].Verdict)
	require.Equal(t, 516, firstRes.Runs[0].AvgReasoningTokens)
}
