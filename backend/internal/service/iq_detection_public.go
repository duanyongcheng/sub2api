package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

// 用户侧只读智商检测视图（/iq-detection）。
//
// 安全边界：
//   - 仅当管理员打开 IQDetectionConfig.UserVisible 时可访问，否则返回 ErrIQDetectionNotPublic（403）。
//   - 仅展示「已配置检测分组 ∩ 用户可用分组（APIKeyService.GetAvailableGroups）」。
//   - 所有返回结构均为显式白名单 DTO，绝不嵌入管理端 IQDetectionRun / IQDetectionSample，
//     隐藏账号 ID/名称、error_message、token 统计、answer_preview / 原始样本、response_model、trigger_type、updated_by。
//   - 用户侧永远不能触发检测或修改配置。

var (
	// ErrIQDetectionNotPublic 管理员未开启「对用户可见」时用户侧接口统一拒绝。
	ErrIQDetectionNotPublic = infraerrors.Forbidden("IQ_DETECTION_NOT_PUBLIC", "iq detection is not visible to users")
	// ErrIQDetectionGroupNotVisible 用户请求了不在其可见范围内的分组。
	ErrIQDetectionGroupNotVisible = infraerrors.Forbidden("IQ_DETECTION_GROUP_NOT_VISIBLE", "group is not visible for iq detection")
)

// IQDetectionPublicVisibility GET /api/v1/iq-detection/visibility 返回结构。
type IQDetectionPublicVisibility struct {
	Enabled bool `json:"enabled"`
}

// IQDetectionPublicArtifact 用户侧可见的鹈鹕 SVG 工件（仅 pelican_svg）。
type IQDetectionPublicArtifact struct {
	HTML             string  `json:"html"`
	Score            float64 `json:"score"`
	OfflineCompliant bool    `json:"offline_compliant"`
}

// IQDetectionPublicRun 用户侧只读检测记录（显式白名单字段）。
type IQDetectionPublicRun struct {
	ID              int64                       `json:"id"`
	GroupID         int64                       `json:"group_id"`
	GroupName       string                      `json:"group_name"`
	BenchmarkType   string                      `json:"benchmark_type"`
	RequestedModel  string                      `json:"requested_model"`
	ReasoningEffort string                      `json:"reasoning_effort"`
	TestsCount      int                         `json:"tests_count"`
	GradedCount     int                         `json:"graded_count"`
	CorrectCount    int                         `json:"correct_count"`
	AvgScore        float64                     `json:"avg_score"`
	Verdict         string                      `json:"verdict"`
	AvgLatencyMs    int                         `json:"avg_latency_ms"`
	AvgTPS          float64                     `json:"avg_tps"`
	StartedAt       time.Time                   `json:"started_at"`
	CompletedAt     time.Time                   `json:"completed_at"`
	Artifacts       []IQDetectionPublicArtifact `json:"artifacts"`
}

// IQDetectionPublicGroup 用户侧概览中的单个分组。
type IQDetectionPublicGroup struct {
	GroupID   int64   `json:"group_id"`
	GroupName string  `json:"group_name"`
	Platform  string  `json:"platform"`
	Health    *string `json:"health"`
	// LatestRunsByBenchmark 每个有记录的题型对应的最新一条记录（恒为非 nil 对象）。
	LatestRunsByBenchmark map[string]*IQDetectionPublicRun `json:"latest_runs_by_benchmark"`
}

// IQDetectionPublicOverview GET /api/v1/iq-detection/overview 返回结构。
type IQDetectionPublicOverview struct {
	BenchmarkTypes  []string                 `json:"benchmark_types"`
	IntervalMinutes int                      `json:"interval_minutes"`
	Model           string                   `json:"model"`
	ReasoningEffort string                   `json:"reasoning_effort"`
	LastScheduledAt *time.Time               `json:"last_scheduled_at"`
	Groups          []IQDetectionPublicGroup `json:"groups"`
}

// ToIQDetectionPublicRun 将管理端记录映射为用户侧白名单 DTO。
func ToIQDetectionPublicRun(run *IQDetectionRun) *IQDetectionPublicRun {
	if run == nil {
		return nil
	}
	benchmarkType := NormalizeIQBenchmarkType(run.BenchmarkType)
	out := &IQDetectionPublicRun{
		ID:              run.ID,
		GroupID:         run.GroupID,
		GroupName:       run.GroupName,
		BenchmarkType:   benchmarkType,
		RequestedModel:  run.RequestedModel,
		ReasoningEffort: run.ReasoningEffort,
		TestsCount:      run.TestsCount,
		GradedCount:     run.GradedCount,
		CorrectCount:    run.CorrectCount,
		AvgScore:        run.AvgScore,
		Verdict:         run.Verdict,
		AvgLatencyMs:    run.AvgLatencyMs,
		AvgTPS:          run.AvgTPS,
		StartedAt:       run.StartedAt,
		CompletedAt:     run.CompletedAt,
		Artifacts:       []IQDetectionPublicArtifact{},
	}
	if benchmarkType == IQBenchmarkPelicanSVG {
		for i := range run.Samples {
			sample := &run.Samples[i]
			if strings.TrimSpace(sample.ArtifactHTML) == "" {
				continue
			}
			artifact := IQDetectionPublicArtifact{
				HTML:  sample.ArtifactHTML,
				Score: float64(sample.Score),
			}
			if sample.PelicanEval != nil {
				artifact.Score = float64(sample.PelicanEval.Score)
				artifact.OfflineCompliant = sample.PelicanEval.OfflineCompliant
			}
			out.Artifacts = append(out.Artifacts, artifact)
		}
	}
	return out
}

// GetUserVisibility 返回用户侧入口是否开放（GET /iq-detection/visibility）。
func (s *IQDetectionService) GetUserVisibility(ctx context.Context) (*IQDetectionPublicVisibility, error) {
	cfg, err := s.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &IQDetectionPublicVisibility{Enabled: cfg.UserVisible}, nil
}

// getPublicConfig 读取配置并执行「对用户可见」守卫。
func (s *IQDetectionService) getPublicConfig(ctx context.Context) (*IQDetectionConfig, error) {
	cfg, err := s.GetConfig(ctx)
	if err != nil {
		return nil, err
	}
	if !cfg.UserVisible {
		return nil, ErrIQDetectionNotPublic
	}
	return cfg, nil
}

// visiblePublicGroups 计算「已配置检测分组 ∩ 用户可用分组」，保持配置中的分组顺序。
func visiblePublicGroups(cfg *IQDetectionConfig, allowedGroups []Group) ([]int64, map[int64]*Group) {
	allowed := make(map[int64]*Group, len(allowedGroups))
	for i := range allowedGroups {
		g := &allowedGroups[i]
		if g.ID > 0 {
			allowed[g.ID] = g
		}
	}
	ids := make([]int64, 0, len(cfg.GroupIDs))
	visible := make(map[int64]*Group, len(cfg.GroupIDs))
	for _, gid := range cfg.GroupIDs {
		g, ok := allowed[gid]
		if !ok {
			continue
		}
		if _, dup := visible[gid]; dup {
			continue
		}
		ids = append(ids, gid)
		visible[gid] = g
	}
	return ids, visible
}

// GetPublicOverview 返回用户侧只读概览：仅包含用户可用且已配置检测的分组。
// allowedGroups 必须来自 APIKeyService.GetAvailableGroups（与站内其他「可用分组」口径一致）。
func (s *IQDetectionService) GetPublicOverview(ctx context.Context, allowedGroups []Group) (*IQDetectionPublicOverview, error) {
	cfg, err := s.getPublicConfig(ctx)
	if err != nil {
		return nil, err
	}

	groupIDs, visible := visiblePublicGroups(cfg, allowedGroups)
	enabledBenchmarks := EffectiveIQBenchmarkTypes(cfg)
	out := &IQDetectionPublicOverview{
		BenchmarkTypes:  append([]string(nil), enabledBenchmarks...),
		IntervalMinutes: cfg.IntervalMinutes,
		Model:           cfg.Model,
		ReasoningEffort: cfg.ReasoningEffort,
		LastScheduledAt: cfg.LastScheduledAt,
		Groups:          make([]IQDetectionPublicGroup, 0, len(groupIDs)),
	}
	if len(groupIDs) == 0 {
		return out, nil
	}

	latestByBench, err := s.repo.GetLatestRunsByGroupAndBenchmark(ctx, groupIDs)
	if err != nil {
		return nil, err
	}

	for _, gid := range groupIDs {
		g := visible[gid]
		item := IQDetectionPublicGroup{
			GroupID:               gid,
			GroupName:             g.Name,
			Platform:              g.Platform,
			LatestRunsByBenchmark: map[string]*IQDetectionPublicRun{},
		}
		if item.GroupName == "" {
			item.GroupName = fmt.Sprintf("#%d", gid)
		}

		benchMap := latestByBench[gid]
		var primaryRun *IQDetectionRun
		for _, r := range benchMap {
			if r == nil || r.GroupID != gid {
				continue
			}
			bt := NormalizeIQBenchmarkType(r.BenchmarkType)
			item.LatestRunsByBenchmark[bt] = ToIQDetectionPublicRun(r)
			if primaryRun == nil || r.CompletedAt.After(primaryRun.CompletedAt) || (r.CompletedAt.Equal(primaryRun.CompletedAt) && r.ID > primaryRun.ID) {
				primaryRun = r
			}
		}

		// 与管理端概览一致：按当前启用题型取最差结论；启用题型均无记录时回退该组最近一条。
		var worst string
		for _, bt := range enabledBenchmarks {
			if r := item.LatestRunsByBenchmark[bt]; r != nil {
				if worst == "" || verdictSeverityRank(r.Verdict) > verdictSeverityRank(worst) {
					worst = r.Verdict
				}
			}
		}
		if worst == "" && primaryRun != nil {
			worst = primaryRun.Verdict
		}
		if worst != "" {
			health := worst
			item.Health = &health
		}

		out.Groups = append(out.Groups, item)
	}
	return out, nil
}

// ListPublicRuns 分页返回用户可见分组的检测历史（白名单 DTO）。
// filter.GroupID 不在可见范围内时返回 ErrIQDetectionGroupNotVisible；verdict 过滤在用户侧不开放。
func (s *IQDetectionService) ListPublicRuns(ctx context.Context, allowedGroups []Group, filter IQDetectionRunFilter) ([]IQDetectionPublicRun, int64, error) {
	cfg, err := s.getPublicConfig(ctx)
	if err != nil {
		return nil, 0, err
	}

	groupIDs, visible := visiblePublicGroups(cfg, allowedGroups)
	if filter.GroupID < 0 {
		return nil, 0, fmt.Errorf("%w: invalid group_id", ErrIQDetectionInvalidConfig)
	}
	if filter.GroupID > 0 {
		if _, ok := visible[filter.GroupID]; !ok {
			return nil, 0, ErrIQDetectionGroupNotVisible
		}
		groupIDs = []int64{filter.GroupID}
	}
	filter.Verdict = ""
	filter.GroupIDs = groupIDs
	if filter.GroupIDs == nil {
		filter.GroupIDs = []int64{}
	}

	if len(filter.GroupIDs) == 0 {
		// 仍需校验 benchmark_type，保持与有分组时一致的 400 语义
		bt := strings.ToLower(strings.TrimSpace(filter.BenchmarkType))
		if bt != "" && !IsValidIQBenchmarkType(bt) {
			return nil, 0, fmt.Errorf("%w: invalid benchmark_type filter %q", ErrIQDetectionInvalidConfig, filter.BenchmarkType)
		}
		return []IQDetectionPublicRun{}, 0, nil
	}

	items, total, err := s.ListRuns(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	out := make([]IQDetectionPublicRun, 0, len(items))
	for i := range items {
		// 纵深防御：即使仓储层未正确过滤，也绝不返回可见范围外的分组数据。
		if _, ok := visible[items[i].GroupID]; !ok {
			continue
		}
		if filter.GroupID > 0 && items[i].GroupID != filter.GroupID {
			continue
		}
		out = append(out, *ToIQDetectionPublicRun(&items[i]))
	}
	return out, total, nil
}
