package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/lib/pq"
)

type iqDetectionRepository struct {
	db *sql.DB
}

// NewIQDetectionRepository 创建基于 *sql.DB 的智商检测仓储实现。
func NewIQDetectionRepository(db *sql.DB) service.IQDetectionRepository {
	return &iqDetectionRepository{db: db}
}

func (r *iqDetectionRepository) GetConfig(ctx context.Context) (*service.IQDetectionConfig, error) {
	var (
		cfg       service.IQDetectionConfig
		lastSched sql.NullTime
		updatedBy sql.NullInt64
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT version, enabled, interval_minutes,
		       COALESCE(benchmark_type, 'candy_logic'),
		       COALESCE(benchmark_types, ARRAY[COALESCE(benchmark_type, 'candy_logic')]::TEXT[]),
		       COALESCE(group_ids, '{}'), model, reasoning_effort, tests_per_group,
		       last_scheduled_at, updated_at, updated_by, user_visible
		FROM iq_detection_config
		WHERE id = 1`,
	).Scan(
		&cfg.Version,
		&cfg.Enabled,
		&cfg.IntervalMinutes,
		&cfg.BenchmarkType,
		pq.Array(&cfg.BenchmarkTypes),
		pq.Array(&cfg.GroupIDs),
		&cfg.Model,
		&cfg.ReasoningEffort,
		&cfg.TestsPerGroup,
		&lastSched,
		&cfg.UpdatedAt,
		&updatedBy,
		&cfg.UserVisible,
	)
	if errors.Is(err, sql.ErrNoRows) {
		_, _ = r.db.ExecContext(ctx, `INSERT INTO iq_detection_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`)
		def := service.DefaultIQDetectionConfig()
		def.UpdatedAt = time.Now().UTC()
		return &def, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get iq detection config: %w", err)
	}
	if cfg.GroupIDs == nil {
		cfg.GroupIDs = []int64{}
	}
	if lastSched.Valid {
		t := lastSched.Time
		cfg.LastScheduledAt = &t
	}
	if updatedBy.Valid {
		uid := updatedBy.Int64
		cfg.UpdatedBy = &uid
	}
	cfg.BenchmarkTypes = service.EffectiveIQBenchmarkTypes(&cfg)
	cfg.BenchmarkType = cfg.BenchmarkTypes[0]
	cfg.BuiltinPrompt = service.IQDetectionPromptForBenchmark(cfg.BenchmarkType)
	cfg.BuiltinPrompts = service.BuiltinIQDetectionPrompts()
	return &cfg, nil
}

func (r *iqDetectionRepository) UpdateConfig(
	ctx context.Context,
	cfg service.IQDetectionConfig,
	expectedVersion int64,
) (*service.IQDetectionConfig, error) {
	if cfg.GroupIDs == nil {
		cfg.GroupIDs = []int64{}
	}
	cfg.BenchmarkTypes = service.EffectiveIQBenchmarkTypes(&cfg)
	cfg.BenchmarkType = cfg.BenchmarkTypes[0]

	var (
		updated   service.IQDetectionConfig
		lastSched sql.NullTime
		updatedBy sql.NullInt64
	)
	err := r.db.QueryRowContext(ctx, `
		UPDATE iq_detection_config
		SET version = version + 1,
		    enabled = $1,
		    interval_minutes = $2,
		    interval_hours = $3,
		    benchmark_type = $4,
		    benchmark_types = $5,
		    group_ids = $6,
		    model = $7,
		    reasoning_effort = $8,
		    tests_per_group = $9,
		    last_scheduled_at = CASE
		        WHEN COALESCE(benchmark_types, ARRAY[COALESCE(benchmark_type, 'candy_logic')]::TEXT[]) IS DISTINCT FROM $5::text[] THEN NULL
		        ELSE last_scheduled_at
		    END,
		    updated_by = $10,
		    user_visible = $12,
		    updated_at = NOW()
		WHERE id = 1 AND version = $11
		RETURNING version, enabled, interval_minutes,
		          COALESCE(benchmark_type, 'candy_logic'),
		          COALESCE(benchmark_types, ARRAY[COALESCE(benchmark_type, 'candy_logic')]::TEXT[]),
		          COALESCE(group_ids, '{}'), model, reasoning_effort, tests_per_group,
		          last_scheduled_at, updated_at, updated_by, user_visible`,
		cfg.Enabled,
		cfg.IntervalMinutes,
		cfg.IntervalMinutes/60,
		cfg.BenchmarkType,
		pq.Array(cfg.BenchmarkTypes),
		pq.Array(cfg.GroupIDs),
		cfg.Model,
		cfg.ReasoningEffort,
		cfg.TestsPerGroup,
		cfg.UpdatedBy,
		expectedVersion,
		cfg.UserVisible,
	).Scan(
		&updated.Version,
		&updated.Enabled,
		&updated.IntervalMinutes,
		&updated.BenchmarkType,
		pq.Array(&updated.BenchmarkTypes),
		pq.Array(&updated.GroupIDs),
		&updated.Model,
		&updated.ReasoningEffort,
		&updated.TestsPerGroup,
		&lastSched,
		&updated.UpdatedAt,
		&updatedBy,
		&updated.UserVisible,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, service.ErrIQDetectionConfigConflict
	}
	if err != nil {
		return nil, fmt.Errorf("update iq detection config: %w", err)
	}
	if updated.GroupIDs == nil {
		updated.GroupIDs = []int64{}
	}
	if lastSched.Valid {
		t := lastSched.Time
		updated.LastScheduledAt = &t
	}
	if updatedBy.Valid {
		uid := updatedBy.Int64
		updated.UpdatedBy = &uid
	}
	updated.BenchmarkTypes = service.EffectiveIQBenchmarkTypes(&updated)
	updated.BenchmarkType = updated.BenchmarkTypes[0]
	updated.BuiltinPrompt = service.IQDetectionPromptForBenchmark(updated.BenchmarkType)
	updated.BuiltinPrompts = service.BuiltinIQDetectionPrompts()
	return &updated, nil
}

func (r *iqDetectionRepository) ClaimScheduledWindow(
	ctx context.Context,
	now time.Time,
) (*service.IQDetectionConfig, bool, error) {
	var (
		cfg       service.IQDetectionConfig
		lastSched sql.NullTime
		updatedBy sql.NullInt64
	)
	err := r.db.QueryRowContext(ctx, `
		UPDATE iq_detection_config
		SET last_scheduled_at = $1
		WHERE id = 1
		  AND enabled = TRUE
		  AND COALESCE(array_length(group_ids, 1), 0) > 0
		  AND (
		      last_scheduled_at IS NULL
		      OR last_scheduled_at + (interval_minutes * INTERVAL '1 minute') <= $1
		  )
		RETURNING version, enabled, interval_minutes,
		          COALESCE(benchmark_type, 'candy_logic'),
		          COALESCE(benchmark_types, ARRAY[COALESCE(benchmark_type, 'candy_logic')]::TEXT[]),
		          COALESCE(group_ids, '{}'), model, reasoning_effort, tests_per_group,
		          last_scheduled_at, updated_at, updated_by, user_visible`,
		now.UTC(),
	).Scan(
		&cfg.Version,
		&cfg.Enabled,
		&cfg.IntervalMinutes,
		&cfg.BenchmarkType,
		pq.Array(&cfg.BenchmarkTypes),
		pq.Array(&cfg.GroupIDs),
		&cfg.Model,
		&cfg.ReasoningEffort,
		&cfg.TestsPerGroup,
		&lastSched,
		&cfg.UpdatedAt,
		&updatedBy,
		&cfg.UserVisible,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("claim iq detection scheduled window: %w", err)
	}
	if cfg.GroupIDs == nil {
		cfg.GroupIDs = []int64{}
	}
	if lastSched.Valid {
		t := lastSched.Time
		cfg.LastScheduledAt = &t
	}
	if updatedBy.Valid {
		uid := updatedBy.Int64
		cfg.UpdatedBy = &uid
	}
	cfg.BenchmarkTypes = service.EffectiveIQBenchmarkTypes(&cfg)
	cfg.BenchmarkType = cfg.BenchmarkTypes[0]
	cfg.BuiltinPrompt = service.IQDetectionPromptForBenchmark(cfg.BenchmarkType)
	cfg.BuiltinPrompts = service.BuiltinIQDetectionPrompts()
	return &cfg, true, nil
}

func (r *iqDetectionRepository) CreateRun(ctx context.Context, run *service.IQDetectionRun) error {
	if run == nil {
		return errors.New("iq detection run is nil")
	}
	samples := run.Samples
	if samples == nil {
		samples = []service.IQDetectionSample{}
	}
	samplesBytes, err := json.Marshal(samples)
	if err != nil {
		return fmt.Errorf("marshal iq detection samples: %w", err)
	}
	run.BenchmarkType = service.NormalizeIQBenchmarkType(run.BenchmarkType)

	err = r.db.QueryRowContext(ctx, `
		INSERT INTO iq_detection_runs (
			group_id, group_name, platform, trigger_type, benchmark_type,
			requested_model, reasoning_effort,
			tests_count, graded_count, correct_count, avg_score, verdict,
			avg_input_tokens, avg_output_tokens, avg_reasoning_tokens,
			avg_latency_ms, avg_tps, response_model,
			answer_preview, error_message, samples,
			started_at, completed_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, $15,
			$16, $17, $18,
			$19, $20, $21,
			$22, $23
		)
		RETURNING id, created_at`,
		run.GroupID,
		run.GroupName,
		run.Platform,
		run.TriggerType,
		run.BenchmarkType,
		run.RequestedModel,
		run.ReasoningEffort,
		run.TestsCount,
		run.GradedCount,
		run.CorrectCount,
		run.AvgScore,
		run.Verdict,
		run.AvgInputTokens,
		run.AvgOutputTokens,
		run.AvgReasoningTokens,
		run.AvgLatencyMs,
		run.AvgTPS,
		run.ResponseModel,
		run.AnswerPreview,
		run.ErrorMessage,
		samplesBytes,
		run.StartedAt.UTC(),
		run.CompletedAt.UTC(),
	).Scan(&run.ID, &run.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert iq detection run: %w", err)
	}
	return nil
}

func (r *iqDetectionRepository) GetLatestRunsByGroupIDs(
	ctx context.Context,
	groupIDs []int64,
) (map[int64]*service.IQDetectionRun, error) {
	result := make(map[int64]*service.IQDetectionRun, len(groupIDs))
	if len(groupIDs) == 0 {
		return result, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT ON (group_id)
			id, group_id, group_name, platform, trigger_type, COALESCE(benchmark_type, 'candy_logic'),
			requested_model, reasoning_effort,
			tests_count, graded_count, correct_count, avg_score, verdict,
			avg_input_tokens, avg_output_tokens, avg_reasoning_tokens,
			avg_latency_ms, avg_tps, response_model,
			answer_preview, error_message, COALESCE(samples, '[]'::jsonb),
			started_at, completed_at, created_at
		FROM iq_detection_runs
		WHERE group_id = ANY($1)
		ORDER BY group_id, created_at DESC, id DESC`,
		pq.Array(groupIDs),
	)
	if err != nil {
		return nil, fmt.Errorf("query latest iq detection runs: %w", err)
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		run, scanErr := scanIQDetectionRunRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		result[run.GroupID] = &run
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate latest iq detection runs: %w", err)
	}
	return result, nil
}

func (r *iqDetectionRepository) GetLatestRunsByGroupAndBenchmark(
	ctx context.Context,
	groupIDs []int64,
) (map[int64]map[string]*service.IQDetectionRun, error) {
	result := make(map[int64]map[string]*service.IQDetectionRun, len(groupIDs))
	if len(groupIDs) == 0 {
		return result, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT ON (group_id, COALESCE(benchmark_type, 'candy_logic'))
			id, group_id, group_name, platform, trigger_type, COALESCE(benchmark_type, 'candy_logic'),
			requested_model, reasoning_effort,
			tests_count, graded_count, correct_count, avg_score, verdict,
			avg_input_tokens, avg_output_tokens, avg_reasoning_tokens,
			avg_latency_ms, avg_tps, response_model,
			answer_preview, error_message, COALESCE(samples, '[]'::jsonb),
			started_at, completed_at, created_at
		FROM iq_detection_runs
		WHERE group_id = ANY($1)
		ORDER BY group_id, COALESCE(benchmark_type, 'candy_logic'), created_at DESC, id DESC`,
		pq.Array(groupIDs),
	)
	if err != nil {
		return nil, fmt.Errorf("query latest iq detection runs by benchmark: %w", err)
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		run, scanErr := scanIQDetectionRunRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		if result[run.GroupID] == nil {
			result[run.GroupID] = make(map[string]*service.IQDetectionRun, 2)
		}
		result[run.GroupID][run.BenchmarkType] = &run
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate latest iq detection runs by benchmark: %w", err)
	}
	return result, nil
}

func (r *iqDetectionRepository) ListRuns(
	ctx context.Context,
	filter service.IQDetectionRunFilter,
) ([]service.IQDetectionRun, int64, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// GroupIDs == nil 表示不限制分组（管理端）；非 nil（含空切片）表示仅返回该集合内的分组记录。
	var groupScope any
	if filter.GroupIDs != nil {
		if len(filter.GroupIDs) == 0 {
			return []service.IQDetectionRun{}, 0, nil
		}
		groupScope = pq.Array(filter.GroupIDs)
	}

	var total int64
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM iq_detection_runs
		WHERE ($1::bigint = 0 OR group_id = $1)
		  AND ($2::text = '' OR verdict = $2)
		  AND ($3::text = '' OR COALESCE(benchmark_type, 'candy_logic') = $3)
		  AND ($4::bigint[] IS NULL OR group_id = ANY($4))`,
		filter.GroupID,
		filter.Verdict,
		filter.BenchmarkType,
		groupScope,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count iq detection runs: %w", err)
	}
	if total == 0 {
		return []service.IQDetectionRun{}, 0, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			id, group_id, group_name, platform, trigger_type, COALESCE(benchmark_type, 'candy_logic'),
			requested_model, reasoning_effort,
			tests_count, graded_count, correct_count, avg_score, verdict,
			avg_input_tokens, avg_output_tokens, avg_reasoning_tokens,
			avg_latency_ms, avg_tps, response_model,
			answer_preview, error_message, COALESCE(samples, '[]'::jsonb),
			started_at, completed_at, created_at
		FROM iq_detection_runs
		WHERE ($1::bigint = 0 OR group_id = $1)
		  AND ($2::text = '' OR verdict = $2)
		  AND ($3::text = '' OR COALESCE(benchmark_type, 'candy_logic') = $3)
		  AND ($4::bigint[] IS NULL OR group_id = ANY($4))
		ORDER BY created_at DESC, id DESC
		LIMIT $5 OFFSET $6`,
		filter.GroupID,
		filter.Verdict,
		filter.BenchmarkType,
		groupScope,
		pageSize,
		offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list iq detection runs: %w", err)
	}
	defer func() { _ = rows.Close() }()

	items := make([]service.IQDetectionRun, 0, pageSize)
	for rows.Next() {
		run, scanErr := scanIQDetectionRunRow(rows)
		if scanErr != nil {
			return nil, 0, scanErr
		}
		items = append(items, run)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate iq detection runs: %w", err)
	}
	return items, total, nil
}

func (r *iqDetectionRepository) PruneGroupRuns(ctx context.Context, groupID int64, keepLatest int) error {
	if keepLatest <= 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM iq_detection_runs
		WHERE id IN (
		    SELECT id FROM (
		        SELECT id,
		               ROW_NUMBER() OVER (
		                   PARTITION BY COALESCE(benchmark_type, 'candy_logic')
		                   ORDER BY created_at DESC, id DESC
		               ) AS rn
		        FROM iq_detection_runs
		        WHERE group_id = $1
		    ) ranked
		    WHERE ranked.rn > $2
		)`,
		groupID,
		keepLatest,
	)
	if err != nil {
		return fmt.Errorf("prune iq detection runs: %w", err)
	}
	return nil
}

func scanIQDetectionRunRow(rows *sql.Rows) (service.IQDetectionRun, error) {
	var (
		run        service.IQDetectionRun
		rawSamples []byte
	)
	err := rows.Scan(
		&run.ID,
		&run.GroupID,
		&run.GroupName,
		&run.Platform,
		&run.TriggerType,
		&run.BenchmarkType,
		&run.RequestedModel,
		&run.ReasoningEffort,
		&run.TestsCount,
		&run.GradedCount,
		&run.CorrectCount,
		&run.AvgScore,
		&run.Verdict,
		&run.AvgInputTokens,
		&run.AvgOutputTokens,
		&run.AvgReasoningTokens,
		&run.AvgLatencyMs,
		&run.AvgTPS,
		&run.ResponseModel,
		&run.AnswerPreview,
		&run.ErrorMessage,
		&rawSamples,
		&run.StartedAt,
		&run.CompletedAt,
		&run.CreatedAt,
	)
	if err != nil {
		return run, fmt.Errorf("scan iq detection run: %w", err)
	}
	run.BenchmarkType = service.NormalizeIQBenchmarkType(run.BenchmarkType)
	if len(rawSamples) > 0 {
		_ = json.Unmarshal(rawSamples, &run.Samples)
	}
	if run.Samples == nil {
		run.Samples = []service.IQDetectionSample{}
	}
	return run, nil
}
