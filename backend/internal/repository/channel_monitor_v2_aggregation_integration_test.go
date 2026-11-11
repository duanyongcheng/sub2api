//go:build integration

package repository

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// These source fixtures intentionally include nullable legacy model fields.
// The requested name takes precedence; only the exact unknown placeholder drops.
const channelMonitorV2ModelFixturesSQL = `VALUES
  (1, NULL::text, NULL::text),
  (2, '', ''),
  (3, '   ', '  '),
  (4, 'unknown', 'must-not-fall-back'),
  (5, NULL, ' fallback-model '),
  (6, ' ', ' second-fallback '),
  (7, ' requested-model ', 'upstream-model'),
  (8, '', 'ordinary-model'),
  (9, 'unknown-version', '')`

const channelMonitorV2UsageFixturesSQL = `
INSERT INTO usage_logs (
  id, user_id, group_id, account_id, request_id, requested_model, model,
  actual_cost, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
  first_token_ms, duration_ms, created_at
)
SELECT id, 7, 3, 5, 'usage:' || id::text, requested_model, model,
       1, 10, 20, 0, 0, 100, 1000, $1::timestamptz + INTERVAL '10 seconds'
FROM (` + channelMonitorV2ModelFixturesSQL + `) fixtures(id, requested_model, model)`

const channelMonitorV2ErrorFixturesSQL = `
INSERT INTO ops_error_logs (
  id, user_id, group_id, platform, request_id, requested_model, model,
  status_code, error_type, is_count_tokens, created_at
)
SELECT id, 7, 3, 'openai', 'error:' || id::text, requested_model, model,
       500, 'internal', FALSE, $1::timestamptz + INTERVAL '10 seconds'
FROM (` + channelMonitorV2ModelFixturesSQL + `) fixtures(id, requested_model, model)`

const channelMonitorV2ErrorDedupFixturesSQL = `
INSERT INTO ops_error_logs (
  id, user_id, group_id, platform, request_id, requested_model, model,
  status_code, error_type, is_count_tokens, created_at
)
SELECT id, 7, 3, 'openai', request_id, model, model,
       500, 'internal', FALSE, $1::timestamptz + offset_seconds * INTERVAL '1 second'
FROM (VALUES
  (10, 'named-then-unknown', 'must-not-revive', 10),
  (11, 'named-then-unknown', NULL, 70),
  (12, 'unknown-then-named', NULL, 10),
  (13, 'unknown-then-named', 'latest-named', 70),
  (14, 'same-time', 'must-not-revive-on-id-tie', 10),
  (15, 'same-time', '   ', 10),
  (16, NULL, 'anonymous-named', 10),
  (17, NULL, NULL, 10)
) fixtures(id, request_id, model, offset_seconds)`

func TestChannelMonitorV2UsageAggregationExcludesUnknownModels(t *testing.T) {
	ctx := context.Background()
	tx := channelMonitorV2AggregationTestTx(t)
	start := time.Date(2026, 1, 1, 1, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Minute)
	_, err := tx.ExecContext(ctx, channelMonitorV2UsageFixturesSQL, start)
	require.NoError(t, err)

	for _, query := range []string{
		fmt.Sprintf(channelMonitorV2UsageMetricsSQL, channelMonitorV2PlatformSQL, channelMonitorV2ModelSQL),
		fmt.Sprintf(channelMonitorV2UserMetricsSQL, channelMonitorV2PlatformSQL, channelMonitorV2ModelSQL),
		fmt.Sprintf(channelMonitorV2HistogramSQL, channelMonitorV2PlatformSQL, channelMonitorV2ModelSQL, channelMonitorV2HistogramBoundSQL("latency.value_ms")),
	} {
		_, err = tx.ExecContext(ctx, query, start, end)
		require.NoError(t, err)
	}
	want := map[string]int64{"fallback-model": 1, "second-fallback": 1, "requested-model": 1, "ordinary-model": 1, "unknown-version": 1}
	require.Equal(t, want, channelMonitorV2AggregationCounts(t, tx, "channel_monitor_v2_metrics_1m", "success_requests"))
	require.Equal(t, want, channelMonitorV2AggregationCounts(t, tx, "channel_monitor_v2_user_metrics_1m", "success_requests"))
	for model := range want {
		// Each request contributes both latency metrics for global and user scopes.
		want[model] = 4
	}
	require.Equal(t, want, channelMonitorV2AggregationCounts(t, tx, "channel_monitor_v2_latency_histograms_1m", "sample_count"))
	var sourceRows int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM usage_logs").Scan(&sourceRows))
	require.Equal(t, 9, sourceRows)
}

func TestChannelMonitorV2ErrorAggregationExcludesUnknownAfterDedup(t *testing.T) {
	ctx := context.Background()
	tx := channelMonitorV2AggregationTestTx(t)
	start := time.Date(2026, 1, 1, 1, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Minute)
	for _, query := range []string{channelMonitorV2ErrorFixturesSQL, channelMonitorV2ErrorDedupFixturesSQL} {
		_, err := tx.ExecContext(ctx, query, start)
		require.NoError(t, err)
	}
	_, err := tx.ExecContext(ctx, channelMonitorV2ErrorAggregationSQL, start, end)
	require.NoError(t, err)
	want := map[string]int64{
		"fallback-model": 1, "second-fallback": 1, "requested-model": 1, "ordinary-model": 1,
		"unknown-version": 1, "latest-named": 1, "anonymous-named": 1,
	}
	for _, table := range []string{"channel_monitor_v2_metrics_1m", "channel_monitor_v2_user_metrics_1m", "channel_monitor_v2_error_metrics_1m"} {
		require.Equal(t, want, channelMonitorV2AggregationCounts(t, tx, table, "error_requests"), table)
	}
	var sourceRows int
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM ops_error_logs").Scan(&sourceRows))
	require.Equal(t, 17, sourceRows)
}

func TestChannelMonitorV2RollupsExcludeLegacyUnknownFacts(t *testing.T) {
	ctx := context.Background()
	tx := channelMonitorV2AggregationTestTx(t)
	start := time.Date(2026, 1, 1, 1, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Minute)
	for _, statement := range []string{
		`INSERT INTO channel_monitor_v2_metrics_1m (bucket_start, platform, group_id, model, success_requests, error_requests)
		 SELECT $1, 'openai', 3, model, 2, 1 FROM (VALUES ('unknown'), ('valid-model')) models(model)`,
		`INSERT INTO channel_monitor_v2_user_metrics_1m (bucket_start, platform, group_id, model, user_id, success_requests, error_requests)
		 SELECT $1, 'openai', 3, model, 7, 2, 1 FROM (VALUES ('unknown'), ('valid-model')) models(model)`,
		`INSERT INTO channel_monitor_v2_latency_histograms_1m (bucket_start, platform, group_id, model, metric, upper_bound_ms, sample_count)
		 SELECT $1, 'openai', 3, model, 'duration', 1000, 3 FROM (VALUES ('unknown'), ('valid-model')) models(model)`,
		`INSERT INTO channel_monitor_v2_error_metrics_1m (bucket_start, platform, group_id, model, error_category, taxonomy_version, error_requests)
		 SELECT $1, 'openai', 3, model, 'internal', 1, 1 FROM (VALUES ('unknown'), ('valid-model')) models(model)`,
	} {
		_, err := tx.ExecContext(ctx, statement, start)
		require.NoError(t, err)
	}
	for _, seconds := range channelMonitorV2FixedRollupSeconds {
		for _, query := range []string{channelMonitorV2MetricsRollupSQL, channelMonitorV2UserMetricsRollupSQL, channelMonitorV2HistogramRollupSQL, channelMonitorV2ErrorRollupSQL} {
			_, err := tx.ExecContext(ctx, query, fmt.Sprintf("%d seconds", seconds), seconds, start, end)
			require.NoError(t, err)
		}
	}
	for _, sample := range []struct {
		table, column string
		want          int64
	}{
		{"channel_monitor_v2_metrics_rollup", "success_requests", 8},
		{"channel_monitor_v2_user_metrics_rollup", "success_requests", 8},
		{"channel_monitor_v2_latency_histograms_rollup", "sample_count", 12},
		{"channel_monitor_v2_error_metrics_rollup", "error_requests", 4},
	} {
		require.Equal(t, map[string]int64{"valid-model": sample.want}, channelMonitorV2AggregationCounts(t, tx, sample.table, sample.column), sample.table)
	}
}

func channelMonitorV2AggregationTestTx(t *testing.T) *sql.Tx {
	t.Helper()
	tx := testTx(t)
	ctx := context.Background()
	// Shadow only this transaction's source tables, preserving actual column
	// types while allowing nullable legacy fixtures without unrelated FK setup.
	for _, table := range []string{"usage_logs", "ops_error_logs", "groups", "accounts"} {
		_, err := tx.ExecContext(ctx, fmt.Sprintf("CREATE TEMP TABLE %s ON COMMIT DROP AS TABLE public.%s WITH NO DATA", table, table))
		require.NoError(t, err)
	}
	for _, table := range []string{
		"channel_monitor_v2_metrics_1m", "channel_monitor_v2_user_metrics_1m",
		"channel_monitor_v2_latency_histograms_1m", "channel_monitor_v2_error_metrics_1m",
		"channel_monitor_v2_metrics_rollup", "channel_monitor_v2_user_metrics_rollup",
		"channel_monitor_v2_latency_histograms_rollup", "channel_monitor_v2_error_metrics_rollup",
	} {
		_, err := tx.ExecContext(ctx, fmt.Sprintf("CREATE TEMP TABLE %s (LIKE public.%s INCLUDING ALL) ON COMMIT DROP", table, table))
		require.NoError(t, err)
	}
	_, err := tx.ExecContext(ctx, "INSERT INTO groups (id, platform) VALUES (3, 'openai')")
	require.NoError(t, err)
	_, err = tx.ExecContext(ctx, "INSERT INTO accounts (id, platform) VALUES (5, 'openai')")
	require.NoError(t, err)
	return tx
}

func channelMonitorV2AggregationCounts(t *testing.T, tx *sql.Tx, table, column string) map[string]int64 {
	t.Helper()
	rows, err := tx.QueryContext(context.Background(), fmt.Sprintf("SELECT model, SUM(%s) FROM %s GROUP BY model", column, table))
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	counts := map[string]int64{}
	for rows.Next() {
		var model string
		var count int64
		require.NoError(t, rows.Scan(&model, &count))
		counts[model] = count
	}
	require.NoError(t, rows.Err())
	return counts
}
