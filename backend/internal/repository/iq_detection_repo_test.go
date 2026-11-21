package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestIQDetectionRepository_ConfigAndScheduledWindowIntervalMinutes(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	repo := NewIQDetectionRepository(db)
	now := time.Date(2026, time.November, 15, 10, 30, 0, 0, time.UTC)
	actorID := int64(1)

	// 1. UpdateConfig with 30 minutes interval and dual benchmarks enabled
	mock.ExpectQuery(`UPDATE iq_detection_config\s+SET version = version \+ 1,\s+enabled = \$1,\s+interval_minutes = \$2,\s+interval_hours = \$3,\s+benchmark_type = \$4,\s+benchmark_types = \$5`).
		WithArgs(
			true,
			30,
			0,
			service.IQBenchmarkCandyLogic,
			pq.Array([]string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG}),
			pq.Array([]int64{10}),
			"gpt-5.4",
			"medium",
			3,
			&actorID,
			int64(1),
			false,
		).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"version", "enabled", "interval_minutes", "benchmark_type", "benchmark_types", "group_ids",
				"model", "reasoning_effort", "tests_per_group",
				"last_scheduled_at", "updated_at", "updated_by", "user_visible",
			}).AddRow(
				int64(2),
				true,
				30,
				service.IQBenchmarkCandyLogic,
				pq.Array([]string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG}),
				pq.Array([]int64{10}),
				"gpt-5.4",
				"medium",
				3,
				nil,
				now,
				actorID,
				false,
			),
		)

	updated, err := repo.UpdateConfig(context.Background(), service.IQDetectionConfig{
		Enabled:         true,
		IntervalMinutes: 30,
		BenchmarkTypes:  []string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG},
		GroupIDs:        []int64{10},
		Model:           "gpt-5.4",
		ReasoningEffort: "medium",
		TestsPerGroup:   3,
		UpdatedBy:       &actorID,
	}, 1)
	require.NoError(t, err)
	require.Equal(t, 30, updated.IntervalMinutes)
	require.Equal(t, []string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG}, updated.BenchmarkTypes)
	require.Equal(t, int64(2), updated.Version)

	// 2. ClaimScheduledWindow uses interval_minutes * INTERVAL '1 minute' and returns benchmark_types
	mock.ExpectQuery(`last_scheduled_at \+ \(interval_minutes \* INTERVAL '1 minute'\) <= \$1`).
		WithArgs(now).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"version", "enabled", "interval_minutes", "benchmark_type", "benchmark_types", "group_ids",
				"model", "reasoning_effort", "tests_per_group",
				"last_scheduled_at", "updated_at", "updated_by", "user_visible",
			}).AddRow(
				int64(2),
				true,
				60,
				service.IQBenchmarkCandyLogic,
				pq.Array([]string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG}),
				pq.Array([]int64{10}),
				"gpt-5.4",
				"medium",
				3,
				now,
				now,
				actorID,
				false,
			),
		)

	claimedCfg, claimed, err := repo.ClaimScheduledWindow(context.Background(), now)
	require.NoError(t, err)
	require.True(t, claimed)
	require.Equal(t, 60, claimedCfg.IntervalMinutes)
	require.Equal(t, []string{service.IQBenchmarkCandyLogic, service.IQBenchmarkPelicanSVG}, claimedCfg.BenchmarkTypes)
	require.NoError(t, mock.ExpectationsWereMet())
}

func iqDetectionConfigRowColumns() []string {
	return []string{
		"version", "enabled", "interval_minutes", "benchmark_type", "benchmark_types", "group_ids",
		"model", "reasoning_effort", "tests_per_group",
		"last_scheduled_at", "updated_at", "updated_by", "user_visible",
	}
}

func TestIQDetectionRepository_UserVisibleRoundTrip(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	repo := NewIQDetectionRepository(db)
	now := time.Date(2026, time.November, 20, 9, 0, 0, 0, time.UTC)

	mock.ExpectQuery(`SELECT version, enabled, interval_minutes,[\s\S]+updated_by, user_visible\s+FROM iq_detection_config`).
		WillReturnRows(sqlmock.NewRows(iqDetectionConfigRowColumns()).AddRow(
			int64(3), false, 720, service.IQBenchmarkCandyLogic,
			pq.Array([]string{service.IQBenchmarkCandyLogic}), pq.Array([]int64{10}),
			"gpt-5.4", "medium", 1, nil, now, nil, true,
		))
	cfg, err := repo.GetConfig(context.Background())
	require.NoError(t, err)
	require.True(t, cfg.UserVisible)

	mock.ExpectQuery(`UPDATE iq_detection_config[\s\S]+user_visible = \$12,[\s\S]+WHERE id = 1 AND version = \$11[\s\S]+updated_by, user_visible`).
		WithArgs(
			false, 720, 12, service.IQBenchmarkCandyLogic,
			pq.Array([]string{service.IQBenchmarkCandyLogic}), pq.Array([]int64{10}),
			"gpt-5.4", "medium", 1, nil, int64(3), true,
		).
		WillReturnRows(sqlmock.NewRows(iqDetectionConfigRowColumns()).AddRow(
			int64(4), false, 720, service.IQBenchmarkCandyLogic,
			pq.Array([]string{service.IQBenchmarkCandyLogic}), pq.Array([]int64{10}),
			"gpt-5.4", "medium", 1, nil, now, nil, true,
		))
	updated, err := repo.UpdateConfig(context.Background(), service.IQDetectionConfig{
		UserVisible:     true,
		IntervalMinutes: 720,
		BenchmarkTypes:  []string{service.IQBenchmarkCandyLogic},
		GroupIDs:        []int64{10},
		Model:           "gpt-5.4",
		ReasoningEffort: "medium",
		TestsPerGroup:   1,
	}, 3)
	require.NoError(t, err)
	require.True(t, updated.UserVisible)
	require.Equal(t, int64(4), updated.Version)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestIQDetectionRepository_ListRunsGroupScope(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	repo := NewIQDetectionRepository(db)

	// 非 nil 空集合：直接返回空，不查询数据库
	items, total, err := repo.ListRuns(context.Background(), service.IQDetectionRunFilter{GroupIDs: []int64{}})
	require.NoError(t, err)
	require.Zero(t, total)
	require.Empty(t, items)

	// 指定可见分组集合：作为 $4 bigint[] 下推到 COUNT 与 LIST
	mock.ExpectQuery(`SELECT COUNT\(\*\)[\s\S]+AND \(\$4::bigint\[\] IS NULL OR group_id = ANY\(\$4\)\)`).
		WithArgs(int64(0), "", "", pq.Array([]int64{10, 20})).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	items, total, err = repo.ListRuns(context.Background(), service.IQDetectionRunFilter{GroupIDs: []int64{10, 20}, Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.Zero(t, total)
	require.Empty(t, items)

	mock.ExpectQuery(`SELECT COUNT\(\*\)[\s\S]+group_id = ANY\(\$4\)`).
		WithArgs(int64(10), "", service.IQBenchmarkPelicanSVG, pq.Array([]int64{10})).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	mock.ExpectQuery(`FROM iq_detection_runs[\s\S]+AND \(\$4::bigint\[\] IS NULL OR group_id = ANY\(\$4\)\)\s+ORDER BY created_at DESC, id DESC\s+LIMIT \$5 OFFSET \$6`).
		WithArgs(int64(10), "", service.IQBenchmarkPelicanSVG, pq.Array([]int64{10}), 20, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	items, total, err = repo.ListRuns(context.Background(), service.IQDetectionRunFilter{GroupID: 10, BenchmarkType: service.IQBenchmarkPelicanSVG, GroupIDs: []int64{10}, Page: 2, PageSize: 20})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Empty(t, items)

	// nil：管理端不限制分组，$4 为 NULL
	mock.ExpectQuery(`SELECT COUNT\(\*\)`).
		WithArgs(int64(0), "", "", nil).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	_, _, err = repo.ListRuns(context.Background(), service.IQDetectionRunFilter{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}
