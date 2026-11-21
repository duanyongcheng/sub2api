package service

import (
	"context"
	"errors"
	"io"
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

func (r *iqDetectionRepoMemoryStub) GetLatestRunsByGroupAndBenchmark(_ context.Context, groupIDs []int64) (map[int64]map[string]*IQDetectionRun, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	wanted := make(map[int64]struct{}, len(groupIDs))
	for _, gid := range groupIDs {
		wanted[gid] = struct{}{}
	}
	out := make(map[int64]map[string]*IQDetectionRun)
	for i := range r.runs {
		gid := r.runs[i].GroupID
		if _, ok := wanted[gid]; !ok {
			continue
		}
		bt := NormalizeIQBenchmarkType(r.runs[i].BenchmarkType)
		if out[gid] == nil {
			out[gid] = make(map[string]*IQDetectionRun)
		}
		if _, exists := out[gid][bt]; !exists {
			copied := r.runs[i]
			out[gid][bt] = &copied
		}
	}
	return out, nil
}

func (r *iqDetectionRepoMemoryStub) ListRuns(_ context.Context, filter IQDetectionRunFilter) ([]IQDetectionRun, int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	filtered := make([]IQDetectionRun, 0, len(r.runs))
	var scope map[int64]struct{}
	if filter.GroupIDs != nil {
		scope = make(map[int64]struct{}, len(filter.GroupIDs))
		for _, gid := range filter.GroupIDs {
			scope[gid] = struct{}{}
		}
	}
	for _, run := range r.runs {
		if scope != nil {
			if _, ok := scope[run.GroupID]; !ok {
				continue
			}
		}
		if filter.GroupID > 0 && run.GroupID != filter.GroupID {
			continue
		}
		if filter.Verdict != "" && run.Verdict != filter.Verdict {
			continue
		}
		if filter.BenchmarkType != "" && NormalizeIQBenchmarkType(run.BenchmarkType) != filter.BenchmarkType {
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

func sampleRichPelicanHTML() string {
	return "```html\n" + `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>鹈鹕骑自行车 2D 动画</title>
  <style>
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes bob { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
    @keyframes road { from { transform: translateX(0); } to { transform: translateX(-80px); } }
    .wheel-spin { animation: spin 1.2s linear infinite; transform-origin: center; }
    .pelican-bob { animation: bob 0.8s ease-in-out infinite; }
    .road-move { animation: road 1s linear infinite; }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#87ceeb"/>
        <stop offset="100%" stop-color="#e0f2fe"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="800" height="500" fill="url(#sky)"/>
    <g id="road" class="road-move">
      <rect x="0" y="390" width="900" height="110" fill="#64748b"/>
      <line x1="20" y1="440" x2="90" y2="440" stroke="#f8fafc" stroke-width="6"/>
      <line x1="150" y1="440" x2="220" y2="440" stroke="#f8fafc" stroke-width="6"/>
      <line x1="280" y1="440" x2="350" y2="440" stroke="#f8fafc" stroke-width="6"/>
      <line x1="410" y1="440" x2="480" y2="440" stroke="#f8fafc" stroke-width="6"/>
      <line x1="540" y1="440" x2="610" y2="440" stroke="#f8fafc" stroke-width="6"/>
    </g>
    <g id="rear-wheel" transform="translate(240, 340)">
      <g class="wheel-spin">
        <circle cx="0" cy="0" r="62" fill="none" stroke="#1e293b" stroke-width="10"/>
        <circle cx="0" cy="0" r="52" fill="none" stroke="#cbd5e1" stroke-width="3"/>
        <circle cx="0" cy="0" r="8" fill="#475569"/>
        <line x1="-52" y1="0" x2="52" y2="0" stroke="#94a3b8" stroke-width="2"/>
        <line x1="0" y1="-52" x2="0" y2="52" stroke="#94a3b8" stroke-width="2"/>
        <line x1="-37" y1="-37" x2="37" y2="37" stroke="#94a3b8" stroke-width="2"/>
        <line x1="-37" y1="37" x2="37" y2="-37" stroke="#94a3b8" stroke-width="2"/>
      </g>
    </g>
    <g id="front-wheel" transform="translate(520, 340)">
      <g class="wheel-spin">
        <circle cx="0" cy="0" r="62" fill="none" stroke="#1e293b" stroke-width="10"/>
        <circle cx="0" cy="0" r="52" fill="none" stroke="#cbd5e1" stroke-width="3"/>
        <circle cx="0" cy="0" r="8" fill="#475569"/>
        <line x1="-52" y1="0" x2="52" y2="0" stroke="#94a3b8" stroke-width="2"/>
        <line x1="0" y1="-52" x2="0" y2="52" stroke="#94a3b8" stroke-width="2"/>
        <line x1="-37" y1="-37" x2="37" y2="37" stroke="#94a3b8" stroke-width="2"/>
        <line x1="-37" y1="37" x2="37" y2="-37" stroke="#94a3b8" stroke-width="2"/>
      </g>
    </g>
    <g id="bike-frame">
      <path d="M240 340 L355 340 L470 245 L320 245 Z" fill="none" stroke="#ef4444" stroke-width="8"/>
      <path d="M470 245 L520 340 M470 245 Q485 210 515 210 C530 210 535 225 520 230" fill="none" stroke="#dc2626" stroke-width="7"/>
      <path d="M300 235 Q325 225 350 235 C345 245 305 245 300 235 Z" fill="#1e293b"/>
      <line x1="320" y1="245" x2="355" y2="340" stroke="#ef4444" stroke-width="7"/>
    </g>
    <g id="pedal-crank" transform="translate(355, 340)">
      <circle cx="0" cy="0" r="18" fill="#334155"/>
      <line x1="0" y1="0" x2="28" y2="20" stroke="#0f172a" stroke-width="5"/>
      <rect x="20" y="16" width="22" height="8" rx="3" fill="#f59e0b"/>
      <animateTransform attributeName="transform" type="rotate" from="0 355 340" to="360 355 340" dur="1.2s" repeatCount="indefinite"/>
    </g>
    <g id="pelican" class="pelican-bob">
      <path id="pelican-body" d="M290 220 C260 190 280 140 340 145 C395 150 430 185 415 225 C395 255 320 250 290 220 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
      <path id="pelican-wing" d="M315 170 C340 155 390 165 400 198 C375 215 330 212 315 170 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <path id="pelican-tail" d="M285 205 Q255 190 245 212 Q265 225 288 218 Z" fill="#cbd5e1"/>
      <path id="pelican-neck" d="M390 165 C405 130 415 100 435 95 C455 90 465 110 450 135 C435 160 420 175 405 182 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="445" cy="105" r="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="452" cy="100" r="4" fill="#0f172a"/>
      <circle cx="453" cy="99" r="1.5" fill="#ffffff"/>
      <path id="pelican-beak" d="M462 100 C495 96 530 102 555 112 C530 116 490 114 462 110 Z" fill="#f97316"/>
      <path id="pelican-pouch" d="M462 110 C495 114 535 114 550 114 C535 148 485 156 458 128 Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>
      <path d="M350 240 Q360 285 378 330" fill="none" stroke="#f97316" stroke-width="6"/>
      <path d="M335 242 Q325 285 340 318" fill="none" stroke="#ea580c" stroke-width="6"/>
      <path d="M402 185 Q450 205 495 215" fill="none" stroke="#e2e8f0" stroke-width="8"/>
    </g>
    <g id="clouds">
      <ellipse cx="140" cy="80" rx="45" ry="20" fill="#ffffff"/>
      <ellipse cx="170" cy="75" rx="35" ry="18" fill="#ffffff"/>
      <ellipse cx="640" cy="95" rx="50" ry="22" fill="#ffffff"/>
      <ellipse cx="675" cy="88" rx="35" ry="16" fill="#ffffff"/>
    </g>
  </svg>
</body>
</html>` + "\n```"
}

func TestIQDetection_EvaluatePelicanSVG(t *testing.T) {
	// 1. 高质量完整 HTML + SVG 2D 动画应得高分并通过
	richEval, richHTML := EvaluatePelicanSVG(sampleRichPelicanHTML())
	require.NotEmpty(t, richHTML)
	require.True(t, richEval.HasCompleteHTML)
	require.True(t, richEval.HasSVG)
	require.True(t, richEval.HasViewBox)
	require.True(t, richEval.OfflineCompliant)
	require.True(t, richEval.HasAnimation)
	require.True(t, richEval.WheelPairDetected)
	require.GreaterOrEqual(t, richEval.PrimitiveCount, 35)
	require.GreaterOrEqual(t, richEval.CurveCommandCount, 15)
	require.GreaterOrEqual(t, richEval.Score, 90)
	require.Equal(t, IQVerdictNormal, EvaluatePelicanVerdict(1, 1, float64(richEval.Score)))

	// 2. 静态 SVG（完全没有动画）分数被硬上限限制 <= 55，不能判为 normal
	staticHTML := `<!DOCTYPE html><html><body><svg viewBox="0 0 600 400">` +
		`<circle cx="150" cy="300" r="50" fill="none" stroke="#111"/><circle cx="420" cy="300" r="50" fill="none" stroke="#111"/>` +
		`<path d="M150 300 C200 200 350 200 420 300 Q300 100 200 180" fill="#fff" stroke="#f90"/>` +
		`<rect x="10" y="10" width="50" height="20" fill="#09f"/><line x1="150" y1="300" x2="420" y2="300" stroke="#e11"/>` +
		`<ellipse cx="260" cy="180" rx="40" ry="25" fill="#eee"/><polygon points="280,170 340,180 280,195" fill="#fb0"/>` +
		`</svg></body></html>`
	staticEval, _ := EvaluatePelicanSVG(staticHTML)
	require.False(t, staticEval.HasAnimation)
	require.Contains(t, staticEval.Issues, "missing_animation")
	require.LessOrEqual(t, staticEval.Score, 55)

	// 3. 严重降智：极简火柴图且无动画 -> degraded
	degradedHTML := `<svg viewBox="0 0 200 200"><circle cx="50" cy="150" r="20"/><line x1="50" y1="150" x2="120" y2="150"/></svg>`
	degradedEval, wrappedHTML := EvaluatePelicanSVG(degradedHTML)
	require.NotEmpty(t, wrappedHTML)
	require.False(t, degradedEval.HasCompleteHTML)
	require.LessOrEqual(t, degradedEval.Score, 40)
	require.Equal(t, IQVerdictDegraded, EvaluatePelicanVerdict(1, 0, float64(degradedEval.Score)))

	// 4. 违反“不要联网”引用外部 CDN -> OfflineCompliant=false
	onlineHTML := `<!DOCTYPE html><html><head><script src="https://cdn.example.com/gsap.min.js"></script></head><body><svg viewBox="0 0 400 300"><circle cx="100" cy="200" r="40"/><circle cx="280" cy="200" r="40"/></svg></body></html>`
	onlineEval, _ := EvaluatePelicanSVG(onlineHTML)
	require.False(t, onlineEval.OfflineCompliant)
	require.Contains(t, onlineEval.Issues, "external_network_resource")
}

func TestIQDetection_ServicePelicanBenchmarkOverrideAndFilter(t *testing.T) {
	ctx := context.Background()
	repo := newIQDetectionRepoMemoryStub()
	repo.cfg.GroupIDs = []int64{10}
	repo.cfg.BenchmarkType = IQBenchmarkCandyLogic

	groupRepo := &iqDetectionGroupRepoStub{
		groups: map[int64]*Group{
			10: {ID: 10, Name: "codex-pelican", Platform: PlatformOpenAI, Status: StatusActive},
		},
	}
	accountRepo := &iqDetectionAccountRepoStub{
		byGroup: map[int64][]Account{
			10: {{ID: 1, Name: "acc-1", Platform: PlatformOpenAI, Type: AccountTypeOAuth, Status: StatusActive, Schedulable: true}},
		},
	}

	var receivedPrompt string
	prober := &iqDetectionProberStub{
		fn: func(_ context.Context, _ *Account, model string, _ string, prompt string) (*IQDetectionProbeResult, error) {
			receivedPrompt = prompt
			return &IQDetectionProbeResult{
				Protocol:        "codex_oauth_responses",
				InputTokens:     80,
				OutputTokens:    2400,
				ReasoningTokens: 1100,
				ResponseModel:   model,
				AnswerText:      sampleRichPelicanHTML(),
			}, nil
		},
	}

	svc := NewIQDetectionService(repo, groupRepo, accountRepo, prober)

	// 校验非法 benchmark_type 拒绝
	_, err := NormalizeAndValidateIQDetectionConfig(IQDetectionConfig{BenchmarkType: "unknown_bench"})
	require.ErrorIs(t, err, ErrIQDetectionInvalidConfig)

	// 临时按 pelican_svg 发起单次抽检（不改配置）
	res, err := svc.RunNow(ctx, IQDetectionRunNowInput{
		GroupIDs:      []int64{10},
		BenchmarkType: IQBenchmarkPelicanSVG,
	})
	require.NoError(t, err)
	require.Equal(t, IQDetectionPelicanPrompt, receivedPrompt)
	require.Len(t, res.Runs, 1)
	require.Equal(t, IQBenchmarkPelicanSVG, res.Runs[0].BenchmarkType)
	require.Equal(t, IQVerdictNormal, res.Runs[0].Verdict)
	require.GreaterOrEqual(t, res.Runs[0].AvgScore, 90.0)
	require.Len(t, res.Runs[0].Samples, 1)
	require.NotEmpty(t, res.Runs[0].Samples[0].ArtifactHTML)
	require.NotNil(t, res.Runs[0].Samples[0].PelicanEval)
	require.True(t, res.Runs[0].Samples[0].OK)

	// 按 benchmark_type 过滤历史记录
	pelicanRuns, totalPelican, err := svc.ListRuns(ctx, IQDetectionRunFilter{BenchmarkType: IQBenchmarkPelicanSVG})
	require.NoError(t, err)
	require.Equal(t, int64(1), totalPelican)
	require.Len(t, pelicanRuns, 1)

	candyRuns, totalCandy, err := svc.ListRuns(ctx, IQDetectionRunFilter{BenchmarkType: IQBenchmarkCandyLogic})
	require.NoError(t, err)
	require.Equal(t, int64(0), totalCandy)
	require.Empty(t, candyRuns)
}

func TestOpenAIIQDetectionProber_SyntheticUITestSupportsPelicanAndCandy(t *testing.T) {
	prober := &OpenAIIQDetectionProber{}
	acc := &Account{
		ID:       99,
		Platform: PlatformOpenAI,
		Type:     AccountTypeOAuth,
		Extra:    map[string]any{"synthetic_ui_test": true},
	}

	pelicanRes, err := prober.ProbeAccount(context.Background(), acc, "gpt-5.4", "medium", IQDetectionPelicanPrompt)
	require.NoError(t, err)
	eval, html := EvaluatePelicanSVG(pelicanRes.AnswerText)
	require.NotEmpty(t, html)
	require.True(t, eval.HasAnimation)
	require.True(t, eval.WheelPairDetected)
	require.GreaterOrEqual(t, eval.Score, 90)

	candyRes, err := prober.ProbeAccount(context.Background(), acc, "gpt-5.4", "medium", IQDetectionCandyPrompt)
	require.NoError(t, err)
	require.True(t, MatchStandaloneNumber(candyRes.AnswerText, IQDetectionCandyExpectedAnswer))
}

func TestParseResponsesIQStream_ReturnsImmediatelyOnCompletedWithoutEOF(t *testing.T) {
	pr, pw := io.Pipe()
	t.Cleanup(func() { _ = pw.Close() })

	go func() {
		_, _ = pw.Write([]byte("data: {\"type\":\"response.created\",\"response\":{\"model\":\"gpt-6.1-sol\"}}\n\n"))
		_, _ = pw.Write([]byte("data: {\"type\":\"response.output_text.delta\",\"delta\":\"<svg viewBox=\\\"0 0 10 10\\\"></svg>\"}\n\n"))
		_, _ = pw.Write([]byte("data: {\"type\":\"response.completed\",\"response\":{\"model\":\"gpt-6.1-sol\",\"usage\":{\"input_tokens\":88,\"output_tokens\":2400,\"output_tokens_details\":{\"reasoning_tokens\":1200}}}}\n\n"))
		// 故意不关闭 pw（模拟上游/代理在 response.completed 后保持连接未发 EOF）
	}()

	done := make(chan struct{})
	var (
		res *IQDetectionProbeResult
		err error
	)
	go func() {
		res, err = parseResponsesIQStream(pr, "gpt-5.4")
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("parseResponsesIQStream blocked waiting for EOF after response.completed")
	}
	require.NoError(t, err)
	require.Equal(t, "gpt-6.1-sol", res.ResponseModel)
	require.Equal(t, 88, res.InputTokens)
	require.Equal(t, 2400, res.OutputTokens)
	require.Equal(t, 1200, res.ReasoningTokens)
	require.Contains(t, res.AnswerText, "<svg")

	// 同时验证单包 JSON 响应回退未被破坏
	unaryRes, err := parseResponsesIQStream(
		strings.NewReader(`  {"model":"gpt-6.1-sol","usage":{"input_tokens":12,"output_tokens":34,"reasoning_tokens":20},"output":[{"content":[{"type":"output_text","text":"21"}]}]}`),
		"gpt-5.4",
	)
	require.NoError(t, err)
	require.Equal(t, "21", unaryRes.AnswerText)
	require.Equal(t, 20, unaryRes.ReasoningTokens)
}

func TestIQDetection_SimultaneousDualBenchmarksAndPelicanFixedSingleRound(t *testing.T) {
	ctx := context.Background()
	repo := newIQDetectionRepoMemoryStub()
	groupRepo := &iqDetectionGroupRepoStub{
		groups: map[int64]*Group{
			10: {ID: 10, Name: "codex-dual", Platform: PlatformOpenAI, Status: StatusActive},
		},
	}
	accountRepo := &iqDetectionAccountRepoStub{
		byGroup: map[int64][]Account{
			10: {
				{ID: 1, Name: "acc-1", Platform: PlatformOpenAI, Type: AccountTypeOAuth, Status: StatusActive, Schedulable: true},
				{ID: 2, Name: "acc-2", Platform: PlatformOpenAI, Type: AccountTypeOAuth, Status: StatusActive, Schedulable: true},
				{ID: 3, Name: "acc-3", Platform: PlatformOpenAI, Type: AccountTypeOAuth, Status: StatusActive, Schedulable: true},
			},
		},
	}

	prober := &iqDetectionProberStub{
		fn: func(_ context.Context, _ *Account, model string, _ string, prompt string) (*IQDetectionProbeResult, error) {
			if prompt == IQDetectionPelicanPrompt {
				return &IQDetectionProbeResult{
					Protocol:        "codex_oauth",
					InputTokens:     80,
					OutputTokens:    2400,
					ReasoningTokens: 1100,
					ResponseModel:   model,
					AnswerText:      sampleRichPelicanHTML(),
				}, nil
			}
			return &IQDetectionProbeResult{
				Protocol:        "codex_oauth",
				InputTokens:     120,
				OutputTokens:    450,
				ReasoningTokens: 320,
				ResponseModel:   model,
				AnswerText:      "答案是 21 颗糖果。",
			}, nil
		},
	}

	svc := NewIQDetectionService(repo, groupRepo, accountRepo, prober)

	// 保存同时启用双题型，且配置 tests_per_group = 3
	updatedCfg, err := svc.UpdateConfig(ctx, IQDetectionConfig{
		Enabled:         true,
		IntervalMinutes: 60,
		BenchmarkTypes:  []string{IQBenchmarkPelicanSVG, IQBenchmarkCandyLogic},
		GroupIDs:        []int64{10},
		Model:           "gpt-5.4",
		ReasoningEffort: "high",
		TestsPerGroup:   3,
	}, 1, 1)
	require.NoError(t, err)
	require.Equal(t, []string{IQBenchmarkCandyLogic, IQBenchmarkPelicanSVG}, updatedCfg.BenchmarkTypes)

	// 手动触发全量配置题型：验证摸糖跑 3 轮，而鹈鹕强制只跑 1 轮
	batchRes, err := svc.RunNow(ctx, IQDetectionRunNowInput{})
	require.NoError(t, err)
	require.Equal(t, 1, batchRes.ExecutedGroups)
	require.Len(t, batchRes.Runs, 2)

	byBench := map[string]IQDetectionRun{}
	for _, r := range batchRes.Runs {
		byBench[r.BenchmarkType] = r
	}
	require.Equal(t, 3, byBench[IQBenchmarkCandyLogic].TestsCount)
	require.Len(t, byBench[IQBenchmarkCandyLogic].Samples, 3)
	require.Equal(t, 1, byBench[IQBenchmarkPelicanSVG].TestsCount)
	require.Len(t, byBench[IQBenchmarkPelicanSVG].Samples, 1)

	// 验证 Overview 同时保留两个题型的最新记录，互不覆盖
	ov, err := svc.GetOverview(ctx)
	require.NoError(t, err)
	require.Len(t, ov.Groups, 1)
	require.NotNil(t, ov.Groups[0].LatestRunsByBenchmark[IQBenchmarkCandyLogic])
	require.NotNil(t, ov.Groups[0].LatestRunsByBenchmark[IQBenchmarkPelicanSVG])
	require.Equal(t, 1, ov.Summary.NormalCount)
}
