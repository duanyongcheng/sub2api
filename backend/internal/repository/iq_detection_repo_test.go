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

	// 1. UpdateConfig with 30 minutes interval
	mock.ExpectQuery(`UPDATE iq_detection_config\s+SET version = version \+ 1,\s+enabled = \$1,\s+interval_minutes = \$2,\s+interval_hours = \$3`).
		WithArgs(
			true,
			30,
			0,
			pq.Array([]int64{10}),
			"gpt-5.4",
			"medium",
			1,
			&actorID,
			int64(1),
		).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"version", "enabled", "interval_minutes", "group_ids",
				"model", "reasoning_effort", "tests_per_group",
				"last_scheduled_at", "updated_at", "updated_by",
			}).AddRow(int64(2), true, 30, pq.Array([]int64{10}), "gpt-5.4", "medium", 1, nil, now, actorID),
		)

	updated, err := repo.UpdateConfig(context.Background(), service.IQDetectionConfig{
		Enabled:         true,
		IntervalMinutes: 30,
		GroupIDs:        []int64{10},
		Model:           "gpt-5.4",
		ReasoningEffort: "medium",
		TestsPerGroup:   1,
		UpdatedBy:       &actorID,
	}, 1)
	require.NoError(t, err)
	require.Equal(t, 30, updated.IntervalMinutes)
	require.Equal(t, int64(2), updated.Version)

	// 2. ClaimScheduledWindow uses interval_minutes * INTERVAL '1 minute'
	mock.ExpectQuery(`last_scheduled_at \+ \(interval_minutes \* INTERVAL '1 minute'\) <= \$1`).
		WithArgs(now).
		WillReturnRows(
			sqlmock.NewRows([]string{
				"version", "enabled", "interval_minutes", "group_ids",
				"model", "reasoning_effort", "tests_per_group",
				"last_scheduled_at", "updated_at", "updated_by",
			}).AddRow(int64(2), true, 60, pq.Array([]int64{10}), "gpt-5.4", "medium", 1, now, now, actorID),
		)

	claimedCfg, claimed, err := repo.ClaimScheduledWindow(context.Background(), now)
	require.NoError(t, err)
	require.True(t, claimed)
	require.Equal(t, 60, claimedCfg.IntervalMinutes)
	require.NoError(t, mock.ExpectationsWereMet())
}
