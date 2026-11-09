package repository

import (
	"context"
	"database/sql/driver"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
	"github.com/stretchr/testify/require"
)

func TestUsageTrendPreservesRangeWhenChoosingAggregates(t *testing.T) {
	previousTimezone := timezone.Name()
	previousLocal := time.Local
	t.Cleanup(func() {
		time.Local = previousLocal
		require.NoError(t, timezone.Init(previousTimezone))
	})

	tests := []struct {
		name        string
		timezone    string
		granularity string
		start       string
		end         string
		table       string
	}{
		{
			name: "rolling 24 hours includes partial hours", timezone: "Asia/Shanghai", granularity: "hour",
			start: "2026-11-08T15:30:00.123+08:00", end: "2026-11-09T15:30:00.123+08:00", table: "usage_logs",
		},
		{
			name: "partial last hour", timezone: "UTC", granularity: "hour",
			start: "2026-11-08T07:00:00Z", end: "2026-11-09T07:00:00.001Z", table: "usage_logs",
		},
		{
			name: "whole hours retain aggregates", timezone: "Asia/Shanghai", granularity: "hour",
			start: "2026-11-08T07:00:00Z", end: "2026-11-09T07:00:00Z", table: "usage_dashboard_hourly",
		},
		{
			name: "hour buckets follow configured timezone", timezone: "Asia/Kathmandu", granularity: "hour",
			start: "2026-11-08T15:00:00+05:45", end: "2026-11-09T15:00:00+05:45", table: "usage_dashboard_hourly",
		},
		{
			name: "UTC hours can split configured buckets", timezone: "Asia/Kathmandu", granularity: "hour",
			start: "2026-11-08T07:00:00Z", end: "2026-11-09T07:00:00Z", table: "usage_logs",
		},
		{
			name: "rolling 24 hours includes partial days", timezone: "Asia/Shanghai", granularity: "day",
			start: "2026-11-08T15:30:00+08:00", end: "2026-11-09T15:30:00+08:00", table: "usage_logs",
		},
		{
			name: "user midnight can split configured day", timezone: "Asia/Shanghai", granularity: "day",
			start: "2026-11-08T00:00:00Z", end: "2026-11-09T00:00:00Z", table: "usage_logs",
		},
		{
			name: "whole configured days retain aggregates", timezone: "Asia/Shanghai", granularity: "day",
			start: "2026-11-08T00:00:00+08:00", end: "2026-11-10T00:00:00+08:00", table: "usage_dashboard_daily",
		},
		{
			name: "daily query uses configured date for UTC inputs", timezone: "Asia/Shanghai", granularity: "day",
			start: "2026-11-07T16:00:00Z", end: "2026-11-09T16:00:00Z", table: "usage_dashboard_daily",
		},
		{
			name: "whole DST day remains eligible", timezone: "America/New_York", granularity: "day",
			start: "2026-03-08T00:00:00-05:00", end: "2026-03-09T00:00:00-04:00", table: "usage_dashboard_daily",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.NoError(t, timezone.Init(tt.timezone))
			start, err := time.Parse(time.RFC3339Nano, tt.start)
			require.NoError(t, err)
			end, err := time.Parse(time.RFC3339Nano, tt.end)
			require.NoError(t, err)

			var attemptedQueries []string
			matcher := sqlmock.QueryMatcherFunc(func(expected, actual string) error {
				attemptedQueries = append(attemptedQueries, actual)
				return sqlmock.QueryMatcherRegexp.Match(expected, actual)
			})
			db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(matcher))
			require.NoError(t, err)
			t.Cleanup(func() { _ = db.Close() })
			repo := &usageLogRepository{sql: db}
			args := []driver.Value{start, end}
			if tt.table == "usage_dashboard_daily" {
				args = []driver.Value{
					start.In(timezone.Location()).Format("2006-01-02"),
					end.In(timezone.Location()).Format("2006-01-02"),
				}
			}
			mock.ExpectQuery("FROM " + tt.table).
				WithArgs(args...).
				WillReturnRows(sqlmock.NewRows([]string{
					"date", "requests", "input_tokens", "output_tokens", "cache_creation_tokens",
					"cache_read_tokens", "total_tokens", "cost", "actual_cost",
				}).AddRow("2026-11-09", 1, 2, 3, 4, 5, 14, 0.6, 0.5))

			points, err := repo.GetUsageTrendWithFilters(context.Background(), start, end, tt.granularity, 0, 0, 0, 0, "", nil, nil, nil)
			require.NoError(t, err)
			require.Len(t, points, 1)
			require.EqualValues(t, 1, points[0].Requests)
			require.Len(t, attemptedQueries, 1, "partial buckets must skip aggregates rather than querying and expanding the range")
			require.Contains(t, attemptedQueries[0], "FROM "+tt.table)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}
