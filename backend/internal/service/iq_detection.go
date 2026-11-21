package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Wei-Shaw/sub2api/internal/pkg/openai"
	"golang.org/x/sync/errgroup"
)

const (
	IQDetectionDefaultModel              = openai.DefaultTestModel
	IQDetectionDefaultEffort             = "medium"
	IQDetectionDefaultIntervalMinutes    = 720
	IQDetectionDefaultTestsPerGroup      = 1
	IQDetectionMaxTestsPerGroup          = 5
	IQDetectionMaxRetentionPerGroup      = 50
	IQDetectionMaxAnswerPreviewRune      = 400
	IQDetectionMaxConcurrentGroups       = 3
	IQDetectionSingleProbeTimeout        = 3 * time.Minute
	IQDetectionPelicanSingleProbeTimeout = 8 * time.Minute
	IQDetectionBatchExecutionTimeout     = 30 * time.Minute

	IQDetectionTriggerManual    = "manual"
	IQDetectionTriggerScheduled = "scheduled"

	IQVerdictNormal   = "normal"
	IQVerdictWarning  = "warning"
	IQVerdictDegraded = "degraded"
	IQVerdictError    = "error"

	IQDetectionCandyExpectedAnswer = "21"
)

// IQDetectionCandyPrompt 为社区广泛采用的 Codex 抽屉原理黑袋摸糖推理题（标准答案：21）。
// 来源参考：haowang02/codex-candy-eval。
const IQDetectionCandyPrompt = `不使用任何外部工具回答以下问题：

在一个黑色的袋子里放有三种口味的糖果，每种糖果有两种不同的形状（圆形和五角星形，不同的形状靠手感可以分辨）。现已知不同口味的糖和不同形状的数量统计如下表。参赛者需要在活动前决定摸出的糖果数目，那么，最少取出多少个糖果才能保证手中同时拥有不同形状的苹果味和桃子味的糖？（同时手中有圆形苹果味匹配五角星桃子味糖果，或者有圆形桃子味匹配五角星苹果味糖果都满足要求）

        苹果味  桃子味  西瓜味
圆形       7      9      8
五角星形   7      6      4`

var (
	ErrIQDetectionConfigConflict = errors.New("iq detection config version conflict")
	ErrIQDetectionInvalidConfig  = errors.New("invalid iq detection config")
	ErrIQDetectionNoGroups       = errors.New("no target groups configured for iq detection")
)

// IQDetectionConfig 管理端智商检测单例配置。
type IQDetectionConfig struct {
	Version         int64             `json:"version"`
	Enabled         bool              `json:"enabled"`
	UserVisible     bool              `json:"user_visible"`
	IntervalMinutes int               `json:"interval_minutes"`
	BenchmarkType   string            `json:"benchmark_type"`
	BenchmarkTypes  []string          `json:"benchmark_types"`
	GroupIDs        []int64           `json:"group_ids"`
	Model           string            `json:"model"`
	ReasoningEffort string            `json:"reasoning_effort"`
	TestsPerGroup   int               `json:"tests_per_group"`
	LastScheduledAt *time.Time        `json:"last_scheduled_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	UpdatedBy       *int64            `json:"updated_by"`
	BuiltinPrompt   string            `json:"builtin_prompt"`
	BuiltinPrompts  map[string]string `json:"builtin_prompts,omitempty"`
}

// IQDetectionSample 单次抽检请求样本明细。
type IQDetectionSample struct {
	RunIndex        int                     `json:"run_index"`
	AccountID       int64                   `json:"account_id,omitempty"`
	AccountName     string                  `json:"account_name,omitempty"`
	AccountType     string                  `json:"account_type,omitempty"`
	Protocol        string                  `json:"protocol,omitempty"`
	OK              bool                    `json:"ok"`
	Graded          bool                    `json:"graded"`
	Score           int                     `json:"score,omitempty"`
	InputTokens     int                     `json:"input_tokens"`
	OutputTokens    int                     `json:"output_tokens"`
	ReasoningTokens int                     `json:"reasoning_tokens"`
	LatencyMs       int                     `json:"latency_ms"`
	TPS             float64                 `json:"tps"`
	ResponseModel   string                  `json:"response_model"`
	AnswerText      string                  `json:"answer_text"`
	ArtifactHTML    string                  `json:"artifact_html,omitempty"`
	PelicanEval     *IQDetectionPelicanEval `json:"pelican_eval,omitempty"`
	ErrorMessage    string                  `json:"error_message,omitempty"`
}

// IQDetectionRun 单个分组一次抽检批次的聚合记录。
type IQDetectionRun struct {
	ID                 int64               `json:"id"`
	GroupID            int64               `json:"group_id"`
	GroupName          string              `json:"group_name"`
	Platform           string              `json:"platform"`
	TriggerType        string              `json:"trigger_type"`
	BenchmarkType      string              `json:"benchmark_type"`
	RequestedModel     string              `json:"requested_model"`
	ReasoningEffort    string              `json:"reasoning_effort"`
	TestsCount         int                 `json:"tests_count"`
	GradedCount        int                 `json:"graded_count"`
	CorrectCount       int                 `json:"correct_count"`
	AvgScore           float64             `json:"avg_score"`
	Verdict            string              `json:"verdict"`
	AvgInputTokens     int                 `json:"avg_input_tokens"`
	AvgOutputTokens    int                 `json:"avg_output_tokens"`
	AvgReasoningTokens int                 `json:"avg_reasoning_tokens"`
	AvgLatencyMs       int                 `json:"avg_latency_ms"`
	AvgTPS             float64             `json:"avg_tps"`
	ResponseModel      string              `json:"response_model"`
	AnswerPreview      string              `json:"answer_preview"`
	ErrorMessage       string              `json:"error_message"`
	Samples            []IQDetectionSample `json:"samples"`
	StartedAt          time.Time           `json:"started_at"`
	CompletedAt        time.Time           `json:"completed_at"`
	CreatedAt          time.Time           `json:"created_at"`
}

// IQDetectionGroupStatus 已配置分组的实时抽检状态视图。
type IQDetectionGroupStatus struct {
	GroupID                 int64                      `json:"group_id"`
	GroupName               string                     `json:"group_name"`
	Platform                string                     `json:"platform"`
	GroupStatus             string                     `json:"group_status"`
	SchedulableAccountCount int                        `json:"schedulable_account_count"`
	InFlight                bool                       `json:"in_flight"`
	LatestRun               *IQDetectionRun            `json:"latest_run"`
	LatestRunsByBenchmark   map[string]*IQDetectionRun `json:"latest_runs_by_benchmark,omitempty"`
}

// IQDetectionOverviewSummary 管理端概览指标卡片汇总。
type IQDetectionOverviewSummary struct {
	ConfiguredCount int `json:"configured_count"`
	TestedCount     int `json:"tested_count"`
	NormalCount     int `json:"normal_count"`
	WarningCount    int `json:"warning_count"`
	DegradedCount   int `json:"degraded_count"`
	ErrorCount      int `json:"error_count"`
	UntestedCount   int `json:"untested_count"`
}

// IQDetectionOverview 概览页完整返回结构。
type IQDetectionOverview struct {
	Config  *IQDetectionConfig         `json:"config"`
	Summary IQDetectionOverviewSummary `json:"summary"`
	Groups  []IQDetectionGroupStatus   `json:"groups"`
}

// IQDetectionRunFilter 抽检历史分页过滤参数。
type IQDetectionRunFilter struct {
	GroupID int64
	// GroupIDs 非 nil 时将结果限制在该分组集合内（用户侧只读视图的可见分组范围）；nil 表示不限制（管理端）。
	GroupIDs      []int64
	Verdict       string
	BenchmarkType string
	Page          int
	PageSize      int
}

// IQDetectionRunNowInput 手动立即触发抽检入参（空字段回退当前已保存配置）。
type IQDetectionRunNowInput struct {
	GroupIDs        []int64  `json:"group_ids"`
	BenchmarkType   string   `json:"benchmark_type"`
	BenchmarkTypes  []string `json:"benchmark_types"`
	Model           string   `json:"model"`
	ReasoningEffort string   `json:"reasoning_effort"`
	TestsPerGroup   int      `json:"tests_per_group"`
}

// IQDetectionRunBatchResult 触发分组抽检后的批量结果。
type IQDetectionRunBatchResult struct {
	RequestedGroups       int              `json:"requested_groups"`
	ExecutedGroups        int              `json:"executed_groups"`
	SkippedInFlightGroups []int64          `json:"skipped_in_flight_groups"`
	Runs                  []IQDetectionRun `json:"runs"`
}

// IQDetectionRepository 智商检测持久化接口（由 repository 层实现，不引入 ent/redis）。
type IQDetectionRepository interface {
	GetConfig(ctx context.Context) (*IQDetectionConfig, error)
	UpdateConfig(ctx context.Context, cfg IQDetectionConfig, expectedVersion int64) (*IQDetectionConfig, error)
	ClaimScheduledWindow(ctx context.Context, now time.Time) (*IQDetectionConfig, bool, error)
	CreateRun(ctx context.Context, run *IQDetectionRun) error
	GetLatestRunsByGroupIDs(ctx context.Context, groupIDs []int64) (map[int64]*IQDetectionRun, error)
	GetLatestRunsByGroupAndBenchmark(ctx context.Context, groupIDs []int64) (map[int64]map[string]*IQDetectionRun, error)
	ListRuns(ctx context.Context, filter IQDetectionRunFilter) ([]IQDetectionRun, int64, error)
	PruneGroupRuns(ctx context.Context, groupID int64, keepLatest int) error
}

// IQDetectionProbeResult 单次上游探测原始观测值。
type IQDetectionProbeResult struct {
	Protocol        string
	InputTokens     int
	OutputTokens    int
	ReasoningTokens int
	ResponseModel   string
	AnswerText      string
}

// IQDetectionProber 抽象账号级单次推理题探测执行器，便于单元测试与真实上游解耦。
type IQDetectionProber interface {
	ProbeAccount(ctx context.Context, account *Account, model string, effort string, prompt string) (*IQDetectionProbeResult, error)
}

// DefaultIQDetectionConfig 返回默认智商检测配置。
func DefaultIQDetectionConfig() IQDetectionConfig {
	return IQDetectionConfig{
		Version:         1,
		Enabled:         false,
		IntervalMinutes: IQDetectionDefaultIntervalMinutes,
		BenchmarkType:   IQBenchmarkCandyLogic,
		BenchmarkTypes:  []string{IQBenchmarkCandyLogic},
		GroupIDs:        []int64{},
		Model:           IQDetectionDefaultModel,
		ReasoningEffort: IQDetectionDefaultEffort,
		TestsPerGroup:   IQDetectionDefaultTestsPerGroup,
		BuiltinPrompt:   IQDetectionCandyPrompt,
		BuiltinPrompts:  BuiltinIQDetectionPrompts(),
	}
}

// NormalizeAndValidateIQDetectionConfig 归一化并校验配置。
func NormalizeAndValidateIQDetectionConfig(input IQDetectionConfig) (IQDetectionConfig, error) {
	cfg := input

	if cfg.IntervalMinutes == 0 {
		cfg.IntervalMinutes = IQDetectionDefaultIntervalMinutes
	}
	switch cfg.IntervalMinutes {
	case 30, 60, 360, 720, 1440:
	default:
		return cfg, fmt.Errorf("%w: interval_minutes must be one of 30, 60, 360, 720, 1440", ErrIQDetectionInvalidConfig)
	}

	benchTypes, err := NormalizeAndValidateIQBenchmarkTypes(cfg.BenchmarkTypes, cfg.BenchmarkType)
	if err != nil {
		return cfg, err
	}
	cfg.BenchmarkTypes = benchTypes
	cfg.BenchmarkType = benchTypes[0]

	cfg.Model = strings.TrimSpace(cfg.Model)
	if cfg.Model == "" {
		cfg.Model = IQDetectionDefaultModel
	}
	if len(cfg.Model) > 128 {
		return cfg, fmt.Errorf("%w: model exceeds 128 characters", ErrIQDetectionInvalidConfig)
	}

	cfg.ReasoningEffort = strings.ToLower(strings.TrimSpace(cfg.ReasoningEffort))
	if cfg.ReasoningEffort == "" {
		cfg.ReasoningEffort = IQDetectionDefaultEffort
	}
	if !isValidIQDetectionEffort(cfg.ReasoningEffort) {
		return cfg, fmt.Errorf("%w: reasoning_effort must be one of low, medium, high, xhigh, max", ErrIQDetectionInvalidConfig)
	}

	if cfg.TestsPerGroup == 0 {
		cfg.TestsPerGroup = IQDetectionDefaultTestsPerGroup
	}
	if cfg.TestsPerGroup < 1 || cfg.TestsPerGroup > IQDetectionMaxTestsPerGroup {
		return cfg, fmt.Errorf("%w: tests_per_group must be between 1 and %d", ErrIQDetectionInvalidConfig, IQDetectionMaxTestsPerGroup)
	}

	cfg.GroupIDs = deduplicatePositiveInt64s(cfg.GroupIDs)
	cfg.BuiltinPrompt = IQDetectionPromptForBenchmark(cfg.BenchmarkType)
	cfg.BuiltinPrompts = BuiltinIQDetectionPrompts()
	return cfg, nil
}

func isValidIQDetectionEffort(effort string) bool {
	switch effort {
	case "low", "medium", "high", "xhigh", "max":
		return true
	default:
		return false
	}
}

func deduplicatePositiveInt64s(values []int64) []int64 {
	if len(values) == 0 {
		return []int64{}
	}
	seen := make(map[int64]struct{}, len(values))
	out := make([]int64, 0, len(values))
	for _, v := range values {
		if v <= 0 {
			continue
		}
		if _, exists := seen[v]; exists {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// MatchStandaloneNumber 等价于正则 (?<!\d)<target>(?!\d)，但不依赖 RE2 不支持的前后向断言。
func MatchStandaloneNumber(text, target string) bool {
	if target == "" || text == "" {
		return false
	}
	offset := 0
	for offset < len(text) {
		idx := strings.Index(text[offset:], target)
		if idx < 0 {
			return false
		}
		absStart := offset + idx
		absEnd := absStart + len(target)

		prevIsDigit := false
		if absStart > 0 {
			r, _ := utf8.DecodeLastRuneInString(text[:absStart])
			prevIsDigit = unicode.IsDigit(r)
		}

		nextIsDigit := false
		if absEnd < len(text) {
			r, _ := utf8.DecodeRuneInString(text[absEnd:])
			nextIsDigit = unicode.IsDigit(r)
		}

		if !prevIsDigit && !nextIsDigit {
			return true
		}
		offset = absStart + 1
	}
	return false
}

// EvaluateIQDetectionVerdict 根据本轮已评分样本的正确数给出分组级结论（仅依据答案是否正确，不对 reasoning_tokens 做截断判罚）。
func EvaluateIQDetectionVerdict(gradedCount, correctCount int) string {
	if gradedCount <= 0 {
		return IQVerdictError
	}
	if correctCount == gradedCount {
		return IQVerdictNormal
	}
	if correctCount == 0 || correctCount*2 < gradedCount {
		return IQVerdictDegraded
	}
	return IQVerdictWarning
}

func computeSampleTPS(outputTokens, reasoningTokens, latencyMs int) float64 {
	if latencyMs <= 0 {
		return 0
	}
	genTokens := outputTokens
	if reasoningTokens > genTokens {
		genTokens = reasoningTokens
	}
	if genTokens <= 0 {
		return 0
	}
	raw := float64(genTokens) / (float64(latencyMs) / 1000.0)
	return math.Round(raw*10) / 10
}

func truncateRunes(s string, maxRunes int) string {
	trimmed := strings.TrimSpace(s)
	if maxRunes <= 0 || utf8.RuneCountInString(trimmed) <= maxRunes {
		return trimmed
	}
	runes := []rune(trimmed)
	return string(runes[:maxRunes]) + "…"
}

type iqInFlightKey struct {
	groupID       int64
	benchmarkType string
}

// IQDetectionService 管理端智商检测核心服务。
type IQDetectionService struct {
	repo        IQDetectionRepository
	groupRepo   GroupRepository
	accountRepo AccountRepository
	prober      IQDetectionProber

	inFlightMu sync.Mutex
	inFlight   map[iqInFlightKey]struct{}
}

// NewIQDetectionService 创建 IQDetectionService。
func NewIQDetectionService(
	repo IQDetectionRepository,
	groupRepo GroupRepository,
	accountRepo AccountRepository,
	prober IQDetectionProber,
) *IQDetectionService {
	return &IQDetectionService{
		repo:        repo,
		groupRepo:   groupRepo,
		accountRepo: accountRepo,
		prober:      prober,
		inFlight:    make(map[iqInFlightKey]struct{}),
	}
}

// GetConfig 获取单例配置。
func (s *IQDetectionService) GetConfig(ctx context.Context) (*IQDetectionConfig, error) {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	if cfg.GroupIDs == nil {
		cfg.GroupIDs = []int64{}
	}
	cfg.BenchmarkTypes = EffectiveIQBenchmarkTypes(cfg)
	cfg.BenchmarkType = cfg.BenchmarkTypes[0]
	cfg.BuiltinPrompt = IQDetectionPromptForBenchmark(cfg.BenchmarkType)
	cfg.BuiltinPrompts = BuiltinIQDetectionPrompts()
	return cfg, nil
}

// UpdateConfig 校验并持久化配置（带乐观锁 version 校验 + 目标分组平台合法性校验）。
func (s *IQDetectionService) UpdateConfig(
	ctx context.Context,
	input IQDetectionConfig,
	expectedVersion int64,
	actorUserID int64,
) (*IQDetectionConfig, error) {
	if expectedVersion <= 0 {
		return nil, fmt.Errorf("%w: version must be positive", ErrIQDetectionInvalidConfig)
	}
	normalized, err := NormalizeAndValidateIQDetectionConfig(input)
	if err != nil {
		return nil, err
	}

	if s.groupRepo != nil && len(normalized.GroupIDs) > 0 {
		for _, gid := range normalized.GroupIDs {
			group, getErr := s.groupRepo.GetByIDLite(ctx, gid)
			if getErr != nil || group == nil {
				return nil, fmt.Errorf("%w: group %d does not exist", ErrIQDetectionInvalidConfig, gid)
			}
			if group.Platform != PlatformOpenAI {
				return nil, fmt.Errorf("%w: group %q (%d) platform is %s, only openai groups are supported", ErrIQDetectionInvalidConfig, group.Name, gid, group.Platform)
			}
		}
	}

	if actorUserID > 0 {
		normalized.UpdatedBy = &actorUserID
	}
	updated, err := s.repo.UpdateConfig(ctx, normalized, expectedVersion)
	if err != nil {
		return nil, err
	}
	if updated.GroupIDs == nil {
		updated.GroupIDs = []int64{}
	}
	updated.BenchmarkTypes = EffectiveIQBenchmarkTypes(updated)
	updated.BenchmarkType = updated.BenchmarkTypes[0]
	updated.BuiltinPrompt = IQDetectionPromptForBenchmark(updated.BenchmarkType)
	updated.BuiltinPrompts = BuiltinIQDetectionPrompts()
	return updated, nil
}

func verdictSeverityRank(verdict string) int {
	switch verdict {
	case IQVerdictError:
		return 4
	case IQVerdictDegraded:
		return 3
	case IQVerdictWarning:
		return 2
	case IQVerdictNormal:
		return 1
	default:
		return 4
	}
}

// GetOverview 返回管理端概览页所需的完整状态卡片与分组快照（包含每个分组各题型的最新记录）。
func (s *IQDetectionService) GetOverview(ctx context.Context) (*IQDetectionOverview, error) {
	cfg, err := s.GetConfig(ctx)
	if err != nil {
		return nil, err
	}

	latestByBench, err := s.repo.GetLatestRunsByGroupAndBenchmark(ctx, cfg.GroupIDs)
	if err != nil {
		return nil, err
	}

	enabledBenchmarks := EffectiveIQBenchmarkTypes(cfg)
	groups := make([]IQDetectionGroupStatus, 0, len(cfg.GroupIDs))
	summary := IQDetectionOverviewSummary{
		ConfiguredCount: len(cfg.GroupIDs),
	}

	for _, gid := range cfg.GroupIDs {
		benchMap := latestByBench[gid]
		if benchMap == nil {
			benchMap = map[string]*IQDetectionRun{}
		}
		for k, r := range benchMap {
			if r != nil {
				r.BenchmarkType = NormalizeIQBenchmarkType(r.BenchmarkType)
				benchMap[k] = r
			}
		}

		// 选取已启用题型中最近完成的一条作为 LatestRun（若启用题型均未跑过则回退该组整体最近一条）
		var primaryRun *IQDetectionRun
		for _, bt := range enabledBenchmarks {
			if candidate := benchMap[bt]; candidate != nil {
				if primaryRun == nil || candidate.CompletedAt.After(primaryRun.CompletedAt) || (candidate.CompletedAt.Equal(primaryRun.CompletedAt) && candidate.ID > primaryRun.ID) {
					primaryRun = candidate
				}
			}
		}
		if primaryRun == nil {
			for _, candidate := range benchMap {
				if candidate != nil {
					if primaryRun == nil || candidate.CompletedAt.After(primaryRun.CompletedAt) || (candidate.CompletedAt.Equal(primaryRun.CompletedAt) && candidate.ID > primaryRun.ID) {
						primaryRun = candidate
					}
				}
			}
		}

		item := IQDetectionGroupStatus{
			GroupID:               gid,
			GroupName:             fmt.Sprintf("#%d", gid),
			Platform:              PlatformOpenAI,
			GroupStatus:           "missing",
			InFlight:              s.isGroupInFlight(gid),
			LatestRun:             primaryRun,
			LatestRunsByBenchmark: benchMap,
		}

		if s.groupRepo != nil {
			if g, getErr := s.groupRepo.GetByIDLite(ctx, gid); getErr == nil && g != nil {
				item.GroupName = g.Name
				item.Platform = g.Platform
				item.GroupStatus = g.Status
				if s.accountRepo != nil && g.Platform == PlatformOpenAI {
					eligible, _ := s.listEligibleGroupAccounts(ctx, g, cfg.Model)
					item.SchedulableAccountCount = len(eligible)
				}
			}
		}

		// 按当前启用的题型汇总该组健康状态（双题型同开时取最差结论）
		var worstVerdict string
		for _, bt := range enabledBenchmarks {
			if r := benchMap[bt]; r != nil {
				if worstVerdict == "" || verdictSeverityRank(r.Verdict) > verdictSeverityRank(worstVerdict) {
					worstVerdict = r.Verdict
				}
			}
		}
		if worstVerdict == "" && primaryRun != nil {
			worstVerdict = primaryRun.Verdict
		}

		if worstVerdict == "" {
			summary.UntestedCount++
		} else {
			summary.TestedCount++
			switch worstVerdict {
			case IQVerdictNormal:
				summary.NormalCount++
			case IQVerdictWarning:
				summary.WarningCount++
			case IQVerdictDegraded:
				summary.DegradedCount++
			default:
				summary.ErrorCount++
			}
		}

		groups = append(groups, item)
	}

	return &IQDetectionOverview{
		Config:  cfg,
		Summary: summary,
		Groups:  groups,
	}, nil
}

// ListRuns 分页查询历史检测记录。
func (s *IQDetectionService) ListRuns(ctx context.Context, filter IQDetectionRunFilter) ([]IQDetectionRun, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}
	filter.Verdict = strings.ToLower(strings.TrimSpace(filter.Verdict))
	switch filter.Verdict {
	case "", IQVerdictNormal, IQVerdictWarning, IQVerdictDegraded, IQVerdictError:
	default:
		return nil, 0, fmt.Errorf("%w: invalid verdict filter %q", ErrIQDetectionInvalidConfig, filter.Verdict)
	}
	filter.BenchmarkType = strings.ToLower(strings.TrimSpace(filter.BenchmarkType))
	if filter.BenchmarkType != "" && !IsValidIQBenchmarkType(filter.BenchmarkType) {
		return nil, 0, fmt.Errorf("%w: invalid benchmark_type filter %q", ErrIQDetectionInvalidConfig, filter.BenchmarkType)
	}

	items, total, err := s.repo.ListRuns(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = []IQDetectionRun{}
	}
	for i := range items {
		items[i].BenchmarkType = NormalizeIQBenchmarkType(items[i].BenchmarkType)
	}
	return items, total, nil
}

// RunNow 手动触发指定或全部已配置分组的智商抽检。
func (s *IQDetectionService) RunNow(ctx context.Context, input IQDetectionRunNowInput) (*IQDetectionRunBatchResult, error) {
	cfg, err := s.GetConfig(ctx)
	if err != nil {
		return nil, err
	}

	targetGroupIDs := deduplicatePositiveInt64s(input.GroupIDs)
	if len(targetGroupIDs) == 0 {
		targetGroupIDs = cfg.GroupIDs
	}
	if len(targetGroupIDs) == 0 {
		return nil, ErrIQDetectionNoGroups
	}

	var benchmarkTypes []string
	switch {
	case len(input.BenchmarkTypes) > 0:
		validated, valErr := NormalizeAndValidateIQBenchmarkTypes(input.BenchmarkTypes, "")
		if valErr != nil {
			return nil, valErr
		}
		benchmarkTypes = validated
	case strings.TrimSpace(input.BenchmarkType) != "":
		single := strings.ToLower(strings.TrimSpace(input.BenchmarkType))
		if !IsValidIQBenchmarkType(single) {
			return nil, fmt.Errorf("%w: benchmark_type must be one of candy_logic, pelican_svg", ErrIQDetectionInvalidConfig)
		}
		benchmarkTypes = []string{single}
	default:
		benchmarkTypes = EffectiveIQBenchmarkTypes(cfg)
	}

	model := strings.TrimSpace(input.Model)
	if model == "" {
		model = cfg.Model
	}
	if model == "" {
		model = IQDetectionDefaultModel
	}

	effort := strings.ToLower(strings.TrimSpace(input.ReasoningEffort))
	if effort == "" {
		effort = cfg.ReasoningEffort
	}
	if effort == "" {
		effort = IQDetectionDefaultEffort
	}
	if !isValidIQDetectionEffort(effort) {
		return nil, fmt.Errorf("%w: reasoning_effort must be one of low, medium, high, xhigh, max", ErrIQDetectionInvalidConfig)
	}

	testsPerGroup := input.TestsPerGroup
	if testsPerGroup == 0 {
		testsPerGroup = cfg.TestsPerGroup
	}
	if testsPerGroup < 1 || testsPerGroup > IQDetectionMaxTestsPerGroup {
		return nil, fmt.Errorf("%w: tests_per_group must be between 1 and %d", ErrIQDetectionInvalidConfig, IQDetectionMaxTestsPerGroup)
	}

	// 与前端 HTTP 连接断开解耦，防止长耗时的鹈鹕 SVG 抽检因浏览器刷新或代理超时被中途取消
	batchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), IQDetectionBatchExecutionTimeout)
	defer cancel()

	return s.executeGroupBatch(batchCtx, targetGroupIDs, benchmarkTypes, model, effort, testsPerGroup, IQDetectionTriggerManual)
}

// RunScheduledPatrol 由后台定时巡检调用：原子抢占巡检窗口后并发执行配置内所有分组及所有已启用题型。
func (s *IQDetectionService) RunScheduledPatrol(ctx context.Context, now time.Time) (*IQDetectionRunBatchResult, bool, error) {
	cfg, claimed, err := s.repo.ClaimScheduledWindow(ctx, now)
	if err != nil || !claimed || cfg == nil {
		return nil, claimed, err
	}
	targetGroupIDs := deduplicatePositiveInt64s(cfg.GroupIDs)
	if len(targetGroupIDs) == 0 {
		return &IQDetectionRunBatchResult{
			SkippedInFlightGroups: []int64{},
			Runs:                  []IQDetectionRun{},
		}, true, nil
	}
	benchmarkTypes := EffectiveIQBenchmarkTypes(cfg)
	res, runErr := s.executeGroupBatch(ctx, targetGroupIDs, benchmarkTypes, cfg.Model, cfg.ReasoningEffort, cfg.TestsPerGroup, IQDetectionTriggerScheduled)
	return res, true, runErr
}

func (s *IQDetectionService) executeGroupBatch(
	ctx context.Context,
	groupIDs []int64,
	benchmarkTypes []string,
	model string,
	effort string,
	testsPerGroup int,
	triggerType string,
) (*IQDetectionRunBatchResult, error) {
	if len(benchmarkTypes) == 0 {
		benchmarkTypes = []string{IQBenchmarkCandyLogic}
	}

	claimedTasks := make([]iqInFlightKey, 0, len(groupIDs)*len(benchmarkTypes))
	executedGroupSet := make(map[int64]struct{}, len(groupIDs))
	skippedIDs := make([]int64, 0)

	for _, gid := range groupIDs {
		groupClaimed := false
		for _, bt := range benchmarkTypes {
			normBT := NormalizeIQBenchmarkType(bt)
			key := iqInFlightKey{groupID: gid, benchmarkType: normBT}
			if s.tryAcquireInFlight(key) {
				claimedTasks = append(claimedTasks, key)
				groupClaimed = true
			}
		}
		if groupClaimed {
			executedGroupSet[gid] = struct{}{}
		} else {
			skippedIDs = append(skippedIDs, gid)
		}
	}

	if len(claimedTasks) == 0 {
		return &IQDetectionRunBatchResult{
			RequestedGroups:       len(groupIDs),
			ExecutedGroups:        0,
			SkippedInFlightGroups: skippedIDs,
			Runs:                  []IQDetectionRun{},
		}, nil
	}

	results := make([]IQDetectionRun, len(claimedTasks))
	var eg errgroup.Group
	eg.SetLimit(IQDetectionMaxConcurrentGroups)

	for idx, taskKey := range claimedTasks {
		i, tk := idx, taskKey
		eg.Go(func() error {
			defer s.releaseInFlight(tk)
			effectiveRounds := EffectiveTestsPerGroupForBenchmark(tk.benchmarkType, testsPerGroup)
			run := s.probeSingleGroup(ctx, tk.groupID, tk.benchmarkType, model, effort, effectiveRounds, triggerType)
			if s.repo != nil {
				if createErr := s.repo.CreateRun(ctx, &run); createErr == nil {
					_ = s.repo.PruneGroupRuns(ctx, tk.groupID, IQDetectionMaxRetentionPerGroup)
				}
			}
			results[i] = run
			return nil
		})
	}

	_ = eg.Wait()

	return &IQDetectionRunBatchResult{
		RequestedGroups:       len(groupIDs),
		ExecutedGroups:        len(executedGroupSet),
		SkippedInFlightGroups: skippedIDs,
		Runs:                  results,
	}, nil
}

func (s *IQDetectionService) probeSingleGroup(
	ctx context.Context,
	groupID int64,
	benchmarkType string,
	model string,
	effort string,
	testsPerGroup int,
	triggerType string,
) IQDetectionRun {
	benchmarkType = NormalizeIQBenchmarkType(benchmarkType)
	testsPerGroup = EffectiveTestsPerGroupForBenchmark(benchmarkType, testsPerGroup)
	prompt := IQDetectionPromptForBenchmark(benchmarkType)

	startedAt := time.Now()
	run := IQDetectionRun{
		GroupID:         groupID,
		GroupName:       fmt.Sprintf("#%d", groupID),
		Platform:        PlatformOpenAI,
		TriggerType:     triggerType,
		BenchmarkType:   benchmarkType,
		RequestedModel:  model,
		ReasoningEffort: effort,
		TestsCount:      testsPerGroup,
		Verdict:         IQVerdictError,
		Samples:         []IQDetectionSample{},
		StartedAt:       startedAt,
	}

	if s.groupRepo == nil {
		run.ErrorMessage = "group repository unavailable"
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}

	group, err := s.groupRepo.GetByIDLite(ctx, groupID)
	if err != nil || group == nil {
		run.ErrorMessage = fmt.Sprintf("分组 #%d 不存在或已被删除", groupID)
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}
	run.GroupName = group.Name
	run.Platform = group.Platform

	if group.Platform != PlatformOpenAI {
		run.ErrorMessage = fmt.Sprintf("分组 %q 平台为 %s，仅支持 openai 平台分组", group.Name, group.Platform)
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}

	if !group.IsActive() {
		run.ErrorMessage = fmt.Sprintf("分组 %q 当前未启用（status=%s）", group.Name, group.Status)
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}

	eligible, err := s.listEligibleGroupAccounts(ctx, group, model)
	if err != nil {
		run.ErrorMessage = fmt.Sprintf("查询分组可调度账号失败: %v", err)
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}
	if len(eligible) == 0 {
		run.ErrorMessage = fmt.Sprintf("分组 %q 下暂无支持模型 %s 的可调度账号", group.Name, model)
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}

	if s.prober == nil {
		run.ErrorMessage = "iq detection prober unavailable"
		run.CompletedAt = time.Now()
		run.CreatedAt = run.CompletedAt
		return run
	}

	samples := make([]IQDetectionSample, 0, testsPerGroup)
	var (
		gradedCount        int
		correctCount       int
		totalScore         int
		totalInputTokens   int
		totalOutputTokens  int
		totalReasonTokens  int
		totalLatencyMs     int
		totalTPS           float64
		firstResponseModel string
		firstAnswerPreview string
		firstErrorMsg      string
	)

	probeTimeout := IQDetectionSingleProbeTimeout
	if benchmarkType == IQBenchmarkPelicanSVG {
		probeTimeout = IQDetectionPelicanSingleProbeTimeout
	}

	for i := 0; i < testsPerGroup; i++ {
		account := eligible[i%len(eligible)]
		sampleStart := time.Now()
		probeCtx, cancel := context.WithTimeout(ctx, probeTimeout)
		probeRes, probeErr := s.prober.ProbeAccount(probeCtx, &account, model, effort, prompt)
		cancel()
		latencyMs := int(time.Since(sampleStart).Milliseconds())
		if latencyMs < 1 {
			latencyMs = 1
		}

		sample := IQDetectionSample{
			RunIndex:    i + 1,
			AccountID:   account.ID,
			AccountName: account.Name,
			AccountType: account.Type,
			LatencyMs:   latencyMs,
		}

		if probeErr != nil {
			sample.ErrorMessage = probeErr.Error()
			if firstErrorMsg == "" {
				firstErrorMsg = sample.ErrorMessage
			}
			samples = append(samples, sample)
			continue
		}

		sample.Graded = true
		sample.Protocol = probeRes.Protocol
		sample.InputTokens = probeRes.InputTokens
		sample.OutputTokens = probeRes.OutputTokens
		sample.ReasoningTokens = probeRes.ReasoningTokens
		sample.ResponseModel = probeRes.ResponseModel
		rawAnswer := strings.TrimSpace(probeRes.AnswerText)
		sample.TPS = computeSampleTPS(sample.OutputTokens, sample.ReasoningTokens, sample.LatencyMs)

		if benchmarkType == IQBenchmarkPelicanSVG {
			eval, artifactHTML := EvaluatePelicanSVG(rawAnswer)
			sample.Score = eval.Score
			sample.PelicanEval = &eval
			sample.ArtifactHTML = artifactHTML
			sample.OK = eval.Score >= IQPelicanPassScore && eval.HasSVG && eval.HasAnimation && eval.OfflineCompliant
			if artifactHTML != "" {
				// 避免在 AnswerText 与 ArtifactHTML 中重复保存几十 KB 的 HTML 源码
				sample.AnswerText = formatPelicanAnswerSummary(eval)
			} else {
				sample.AnswerText = truncateRunes(rawAnswer, 2000)
			}
			totalScore += eval.Score
			if firstAnswerPreview == "" {
				firstAnswerPreview = formatPelicanAnswerSummary(eval)
			}
		} else {
			sample.AnswerText = rawAnswer
			sample.OK = MatchStandaloneNumber(sample.AnswerText, IQDetectionCandyExpectedAnswer)
			if sample.OK {
				sample.Score = 100
				totalScore += 100
			}
			if firstAnswerPreview == "" && sample.AnswerText != "" {
				firstAnswerPreview = truncateRunes(sample.AnswerText, IQDetectionMaxAnswerPreviewRune)
			}
		}

		gradedCount++
		if sample.OK {
			correctCount++
		}
		totalInputTokens += sample.InputTokens
		totalOutputTokens += sample.OutputTokens
		totalReasonTokens += sample.ReasoningTokens
		totalLatencyMs += sample.LatencyMs
		totalTPS += sample.TPS

		if firstResponseModel == "" && sample.ResponseModel != "" {
			firstResponseModel = sample.ResponseModel
		}

		samples = append(samples, sample)
	}

	run.Samples = samples
	run.GradedCount = gradedCount
	run.CorrectCount = correctCount
	run.ResponseModel = firstResponseModel
	run.AnswerPreview = firstAnswerPreview

	if gradedCount > 0 {
		run.AvgScore = math.Round((float64(totalScore)/float64(gradedCount))*10) / 10
		run.AvgInputTokens = int(math.Round(float64(totalInputTokens) / float64(gradedCount)))
		run.AvgOutputTokens = int(math.Round(float64(totalOutputTokens) / float64(gradedCount)))
		run.AvgReasoningTokens = int(math.Round(float64(totalReasonTokens) / float64(gradedCount)))
		run.AvgLatencyMs = int(math.Round(float64(totalLatencyMs) / float64(gradedCount)))
		run.AvgTPS = math.Round((totalTPS/float64(gradedCount))*10) / 10
	} else {
		run.ErrorMessage = firstErrorMsg
	}

	if benchmarkType == IQBenchmarkPelicanSVG {
		run.Verdict = EvaluatePelicanVerdict(gradedCount, correctCount, run.AvgScore)
	} else {
		run.Verdict = EvaluateIQDetectionVerdict(gradedCount, correctCount)
	}

	if run.ErrorMessage == "" && firstErrorMsg != "" && gradedCount < testsPerGroup {
		run.ErrorMessage = fmt.Sprintf("部分样本请求异常（%d/%d 失败）：%s", testsPerGroup-gradedCount, testsPerGroup, firstErrorMsg)
	}

	run.CompletedAt = time.Now()
	run.CreatedAt = run.CompletedAt
	return run
}

func formatPelicanAnswerSummary(eval IQDetectionPelicanEval) string {
	animState := "无动画"
	if eval.HasAnimation {
		animState = fmt.Sprintf("%d 组动画", eval.AnimationDriverCount)
	}
	wheelState := "未检出双轮"
	if eval.WheelPairDetected {
		wheelState = "双轮已检出"
	}
	summary := fmt.Sprintf("结构评分 %d/100 · %d 图元 · %d 曲线 · %s · %s",
		eval.Score, eval.PrimitiveCount, eval.CurveCommandCount, animState, wheelState)
	if !eval.OfflineCompliant {
		summary += " · 含外链"
	}
	return summary
}

// listEligibleGroupAccounts 筛选分组下满足平台、OAuth-only、Privacy 与模型映射约束的可调度账号，
// 同优先级内部随机打散以保证多轮抽检覆盖池内不同账号。
func (s *IQDetectionService) listEligibleGroupAccounts(ctx context.Context, group *Group, model string) ([]Account, error) {
	if s.accountRepo == nil || group == nil {
		return nil, nil
	}
	accounts, err := s.accountRepo.ListSchedulableByGroupIDAndPlatform(ctx, group.ID, PlatformOpenAI)
	if err != nil {
		return nil, err
	}
	eligible := make([]Account, 0, len(accounts))
	for _, acc := range accounts {
		if !acc.IsSchedulable() {
			continue
		}
		if group.RequireOAuthOnly && strings.EqualFold(acc.Type, AccountTypeAPIKey) {
			continue
		}
		if group.RequirePrivacySet && !acc.IsPrivacySet() {
			continue
		}
		if strings.TrimSpace(model) != "" && !acc.IsModelSupported(model) {
			continue
		}
		eligible = append(eligible, acc)
	}
	if len(eligible) <= 1 {
		return eligible, nil
	}

	// 先整体洗牌，再按 Priority 稳定升序排列：高优先级优先，同优先级均匀随机抽样。
	rand.Shuffle(len(eligible), func(i, j int) {
		eligible[i], eligible[j] = eligible[j], eligible[i]
	})
	sort.SliceStable(eligible, func(i, j int) bool {
		return eligible[i].Priority < eligible[j].Priority
	})
	return eligible, nil
}

func (s *IQDetectionService) tryAcquireInFlight(key iqInFlightKey) bool {
	s.inFlightMu.Lock()
	defer s.inFlightMu.Unlock()
	if _, exists := s.inFlight[key]; exists {
		return false
	}
	s.inFlight[key] = struct{}{}
	return true
}

func (s *IQDetectionService) releaseInFlight(key iqInFlightKey) {
	s.inFlightMu.Lock()
	defer s.inFlightMu.Unlock()
	delete(s.inFlight, key)
}

func (s *IQDetectionService) isGroupInFlight(groupID int64) bool {
	s.inFlightMu.Lock()
	defer s.inFlightMu.Unlock()
	for key := range s.inFlight {
		if key.groupID == groupID {
			return true
		}
	}
	return false
}
